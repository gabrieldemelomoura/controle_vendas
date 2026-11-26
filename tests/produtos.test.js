const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ejs = require("ejs");
const ProdutoModel = require("../mvc/model/ProdutoModel");
const ProdutoController = require("../mvc/controllers/ProdutoController");

test("ProdutoModel consulta o filtro pedido e os totais reais por status", async () => {
    const chamadas = [];
    const conexao = {
        async execute(sql, parametros = []) {
            chamadas.push({ sql, parametros });
            if (sql.includes("COUNT(*) AS total")) return [[{ total: 4, ativos: 3, inativos: 1 }]];
            return [[{ id: 2, sku: "P-2", ativo: 0 }]];
        },
    };
    const model = new ProdutoModel(conexao);
    await model.listar({ status: "inativos" });
    await model.listar({ status: "todos" });
    const contagem = await model.contarPorStatus();
    assert.match(chamadas[0].sql, /WHERE ativo = 0/);
    assert.doesNotMatch(chamadas[1].sql, /WHERE ativo =/);
    assert.deepEqual(contagem, { total: 4, ativos: 3, inativos: 1 });
});

test("reativação de produto atualiza somente o produto informado", async () => {
    let chamada;
    const model = new ProdutoModel({
        execute: async (sql, valores) => { chamada = { sql, valores }; return [{ affectedRows: 1 }]; },
    });
    assert.equal(await model.reativar(42), 1);
    assert.match(chamada.sql, /SET ativo = 1 WHERE id = \? AND ativo = 0/);
    assert.deepEqual(chamada.valores, [42]);
});

test("listagem entrega contagens e percentual do gráfico calculados pelo model", async () => {
    const app = { get() {}, post() {} };
    const model = {
        listar: async ({ status }) => { assert.equal(status, "inativos"); return [{ id: 8, ativo: 0 }]; },
        contarPorStatus: async () => ({ total: 4, ativos: 3, inativos: 1 }),
    };
    const controller = new ProdutoController(app, model);
    let resultado;
    const res = { render: (view, locals) => { resultado = { view, locals }; return resultado; } };
    await controller.listar({ query: { filtro: "inativos" }, session: { usuario: { id: 1, nome: "Admin", perfil: "admin" } } }, res);
    assert.equal(resultado.view, "produto/produto");
    assert.equal(resultado.locals.percentualAtivos, 75);
    assert.equal(resultado.locals.statusProdutos.inativos, 1);
    assert.equal(resultado.locals.produtos.length, 1);
});

test("telas de catálogo renderizam sidebar, gráfico, filtro e formulário com CSRF", async () => {
    const views = path.join(__dirname, "..", "mvc", "views");
    const common = {
        usuario: { id: 1, nome: "Gabriel", perfil: "admin" },
        csrfToken: "csrf-fixture",
        statusProdutos: { total: 4, ativos: 3, inativos: 1 },
        percentualAtivos: 75,
        produtos: [{ id: 8, sku: "SKU-8", nome: "Item de teste", descricao: "Exemplo", custo_atual: "20.00", ativo: 0 }],
        filtro: "inativos", erro: null, sucesso: null,
    };
    const lista = await ejs.renderFile(path.join(views, "produto", "produto.ejs"), common);
    assert.match(lista, /Distribuição atual dos produtos/);
    assert.match(lista, /--ativo-pct:75%/);
    assert.match(lista, /Usuários/);
    assert.match(lista, /\/produto\/8\/reativar/);
    assert.match(lista, /name="_csrf" value="csrf-fixture"/);

    const formulario = await ejs.renderFile(path.join(views, "produto", "formulario.ejs"), {
        produto: null, erro: null, usuario: common.usuario, csrfToken: common.csrfToken,
    });
    assert.match(formulario, /action="\/produto"/);
    assert.match(formulario, /Cadastrar produto/);
    assert.match(formulario, /nav-link is-active/);
});
