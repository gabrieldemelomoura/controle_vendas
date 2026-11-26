const ProdutoModel = require("../model/ProdutoModel");
const { exigirLogin } = require("../middlewares/Autenticacao");
const { validarTokenCsrf } = require("../middlewares/Csrf");

class ProdutoController {
    constructor(app, produtoModel = new ProdutoModel()) {
        this.app = app;
        this.produtoModel = produtoModel;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/produto", exigirLogin, this.listar);
        this.app.get("/produto/novo", exigirLogin, this.exibirFormularioNovo);
        this.app.post("/produto", exigirLogin, validarTokenCsrf, this.criar);
        this.app.get("/produto/:id/editar", exigirLogin, this.exibirFormularioEdicao);
        this.app.post("/produto/:id/editar", exigirLogin, validarTokenCsrf, this.atualizar);
        this.app.post("/produto/:id/inativar", exigirLogin, validarTokenCsrf, this.inativar);
        this.app.post("/produto/:id/reativar", exigirLogin, validarTokenCsrf, this.reativar);
    }

    listar = async (req, res) => {
        try {
            const filtrosPermitidos = ["ativos", "inativos", "todos"];
            const filtro = filtrosPermitidos.includes(req.query.filtro) ? req.query.filtro : "ativos";
            const [produtos, statusProdutos] = await Promise.all([
                this.produtoModel.listar({ status: filtro }),
                this.produtoModel.contarPorStatus(),
            ]);
            const percentualAtivos = statusProdutos.total
                ? Math.round((statusProdutos.ativos / statusProdutos.total) * 100)
                : 0;
            const mensagens = {
                criado: "Produto cadastrado com sucesso.",
                atualizado: "Produto atualizado com sucesso.",
                inativado: "Produto inativado com sucesso.",
                reativado: "Produto reativado com sucesso.",
            };
            return res.render("produto/produto", {
                produtos, statusProdutos, filtro, percentualAtivos,
                usuario: req.session.usuario,
                activePage: req.path === "/home" ? "dashboard" : "produtos",
                sucesso: mensagens[req.query.status] || null,
                erro: null,
            });
        } catch (erro) {
            console.error("Erro ao listar produtos:", erro);
            return res.status(500).render("produto/produto", {
                produtos: [], statusProdutos: { total: 0, ativos: 0, inativos: 0 }, filtro: "ativos", percentualAtivos: 0,
                usuario: req.session.usuario,
                activePage: "produtos",
                erro: "Não foi possível carregar os produtos.", sucesso: null,
            });
        }
    };

    exibirFormularioNovo = (req, res) => res.render("produto/formulario", {
        produto: null, erro: null, usuario: req.session.usuario,
    });

    exibirFormularioEdicao = async (req, res) => {
        try {
            const produto = await this.produtoModel.buscarPorId(req.params.id);
            if (!produto || !produto.ativo) return res.redirect("/produto");
            return res.render("produto/formulario", { produto, erro: null, usuario: req.session.usuario });
        } catch (erro) {
            console.error("Erro ao carregar produto para edição:", erro);
            return res.status(500).redirect("/produto");
        }
    };

    criar = async (req, res) => {
        const validacao = this.validarDados(req.body);
        if (validacao.erro) return res.status(400).render("produto/formulario", { produto: req.body, erro: validacao.erro, usuario: req.session.usuario });
        try {
            await this.produtoModel.criar(validacao.dados);
            return res.redirect("/produto?status=criado");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") return res.status(409).render("produto/formulario", { produto: req.body, erro: "Este SKU já está cadastrado.", usuario: req.session.usuario });
            console.error("Erro ao cadastrar produto:", erro);
            return res.status(500).render("produto/formulario", { produto: req.body, erro: "Não foi possível cadastrar o produto.", usuario: req.session.usuario });
        }
    };

    atualizar = async (req, res) => {
        const produto = { ...req.body, id: req.params.id };
        const validacao = this.validarDados(req.body);
        if (validacao.erro) return res.status(400).render("produto/formulario", { produto, erro: validacao.erro, usuario: req.session.usuario });
        try {
            const alterados = await this.produtoModel.atualizar(req.params.id, validacao.dados);
            if (!alterados) return res.redirect("/produto");
            return res.redirect("/produto?status=atualizado");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") return res.status(409).render("produto/formulario", { produto, erro: "Este SKU já está sendo usado por outro produto.", usuario: req.session.usuario });
            console.error("Erro ao atualizar produto:", erro);
            return res.status(500).render("produto/formulario", { produto, erro: "Não foi possível atualizar o produto.", usuario: req.session.usuario });
        }
    };

    inativar = async (req, res) => {
        try {
            const inativados = await this.produtoModel.inativar(req.params.id);
            if (!inativados) return res.redirect("/produto");
            return res.redirect("/produto?status=inativado");
        } catch (erro) {
            console.error("Erro ao inativar produto:", erro);
            return res.status(500).redirect("/produto");
        }
    };

    reativar = async (req, res) => {
        try {
            const reativados = await this.produtoModel.reativar(req.params.id);
            if (!reativados) return res.redirect("/produto?filtro=inativos");
            return res.redirect("/produto?status=reativado");
        } catch (erro) {
            console.error("Erro ao reativar produto:", erro);
            return res.status(500).redirect("/produto?filtro=inativos");
        }
    };

    validarDados = (entrada = {}) => {
        const sku = String(entrada.sku || "").trim().toUpperCase();
        const nome = String(entrada.nome || "").trim();
        const descricao = String(entrada.descricao || "").trim();
        const custoAtual = String(entrada.custo_atual ?? "0").trim().replace(",", ".");
        if (!sku || sku.length > 80) return { erro: "Informe um SKU com até 80 caracteres." };
        if (!nome || nome.length > 180) return { erro: "Informe o nome do produto (até 180 caracteres)." };
        if (descricao.length > 65535) return { erro: "A descrição excede o tamanho permitido." };
        if (!/^\d{1,11}(?:\.\d{1,2})?$/.test(custoAtual)) return { erro: "Informe um custo válido, não negativo e com até 2 casas decimais." };
        return { dados: { sku, nome, descricao, custoAtual }, erro: null };
    };
}

module.exports = ProdutoController;
