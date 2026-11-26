const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ejs = require("ejs");
const DashboardModel = require("../mvc/model/DashboardModel");
const HomeController = require("../mvc/controllers/HomeController");

test("DashboardModel agrega finanças, série diária e rankings sem alterar os dados", async () => {
    const chamadas = [];
    const conexao = {
        async execute(sql, parametros) {
            chamadas.push({ sql, parametros });
            if (sql.includes("AS faturamento") && sql.includes("AS custoProdutos")) {
                return [[{ faturamento: "1000.00", liquidoMarketplace: "800.00", custoProdutos: "300.00", lucroBruto: "700.00", lucroLiquido: "500.00" }]];
            }
            if (sql.includes("DATE_FORMAT")) {
                return [[{ data: "2026-11-25", faturamento: "1000.00", liquidoMarketplace: "800.00", lucroBruto: "700.00", lucroLiquido: "500.00" }]];
            }
            if (sql.includes("ORDER BY ranking.unidades_vendidas DESC")) {
                return [[{ id: 1, sku: "P-1", nome: "Produto 1", unidades_vendidas: "3", faturamento: "1000.00" }]];
            }
            return [[{ id: 2, sku: "P-2", nome: "Produto 2", unidades_vendidas: "0", faturamento: "0.00" }]];
        },
    };
    const resultado = await new DashboardModel(conexao).obterResumo(7);

    assert.equal(chamadas.length, 4);
    assert.equal(resultado.resumo.lucroBruto, 700);
    assert.equal(resultado.resumo.lucroLiquido, 500);
    assert.equal(resultado.pontos.length, 7);
    assert.ok(resultado.pontos.some((ponto) => ponto.faturamento === 1000));
    assert.equal(resultado.maisVendidos[0].unidades_vendidas, 3);
    assert.equal(resultado.menosVendidos[0].unidades_vendidas, 0);
    assert.ok(chamadas.every(({ sql }) => /status_normalizado IN/.test(sql)));
    assert.ok(chamadas.every(({ parametros }) => parametros.length === 2));
});

test("HomeController limita os períodos e renderiza o dashboard", async () => {
    const rotas = [];
    let periodoConsultado;
    let renderizado;
    const controller = new HomeController({ get: (...args) => rotas.push(args) }, {
        obterResumo: async (dias) => {
            periodoConsultado = dias;
            return { resumo: {}, pontos: [], maisVendidos: [], menosVendidos: [] };
        },
    });
    const rota = rotas.find(([caminho]) => caminho === "/home");
    assert.equal(typeof rota[1], "function");
    await controller.listar({ query: { dias: "999" }, session: { usuario: { id: 1 } } }, {
        render: (view, locals) => { renderizado = { view, locals }; },
    });
    assert.equal(periodoConsultado, 30);
    assert.equal(renderizado.view, "Home/Dashboard");
    assert.equal(renderizado.locals.dias, 30);
});

test("dashboard apresenta os quatro valores em reais e os dois rankings", async () => {
    const view = path.join(__dirname, "..", "mvc", "views", "Home", "Dashboard.ejs");
    const html = await ejs.renderFile(view, {
        usuario: { id: 1, nome: "Admin", perfil: "admin" },
        dias: 7,
        erro: null,
        resumo: { faturamento: 1000, liquidoMarketplace: 800, lucroBruto: 700, lucroLiquido: 500 },
        pontos: [{ data: "2026-11-25", faturamento: 1000, liquidoMarketplace: 800, lucroBruto: 700, lucroLiquido: 500 }],
        maisVendidos: [{ id: 1, sku: "P-1", nome: "Mais vendido", unidades_vendidas: 3, faturamento: 1000 }],
        menosVendidos: [{ id: 2, sku: "P-2", nome: "Menos vendido", unidades_vendidas: 0, faturamento: 0 }],
        csrfToken: "csrf-fixture",
    });

    assert.match(html, /FATURAMENTO/);
    assert.match(html, /LUCRO BRUTO/);
    assert.match(html, /LUCRO LÍQUIDO \/ MARGEM \(R\$\)/);
    assert.match(html, /Mais vendido/);
    assert.match(html, /Menos vendido/);
    assert.match(html, /href="\/home"/);
    assert.match(html, /Dashboard/);
});
