const ProdutoModel = require("../model/ProdutoModel");
const { exigirLogin } = require("../middlewares/Autenticacao");

class ProdutoController {
    constructor(app, produtoModel = new ProdutoModel()) {
        this.app = app;
        this.produtoModel = produtoModel;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/produto", exigirLogin, this.listar);
        this.app.get("/produto/novo", exigirLogin, this.exibirFormularioNovo);
        this.app.post("/produto", exigirLogin, this.criar);
        this.app.get("/produto/:id/editar", exigirLogin, this.exibirFormularioEdicao);
        this.app.post("/produto/:id/editar", exigirLogin, this.atualizar);
        this.app.post("/produto/:id/inativar", exigirLogin, this.inativar);
    }

    listar = async (req, res) => {
        try {
            const produtos = await this.produtoModel.listar();
            const mensagens = { criado: "Produto cadastrado com sucesso.", atualizado: "Produto atualizado com sucesso.", inativado: "Produto inativado com sucesso." };
            return res.render("produto/produto", { produtos, erro: null, sucesso: mensagens[req.query.status] || null });
        } catch (erro) {
            console.error("Erro ao listar produtos:", erro);
            return res.status(500).render("produto/produto", { produtos: [], erro: "Não foi possível carregar os produtos.", sucesso: null });
        }
    };

    exibirFormularioNovo = (req, res) => res.render("produto/formulario", { produto: null, erro: null });

    exibirFormularioEdicao = async (req, res) => {
        try {
            const produto = await this.produtoModel.buscarPorId(req.params.id);
            if (!produto || !produto.ativo) return res.redirect("/produto");
            return res.render("produto/formulario", { produto, erro: null });
        } catch (erro) {
            console.error("Erro ao carregar produto para edição:", erro);
            return res.status(500).redirect("/produto");
        }
    };

    criar = async (req, res) => {
        const validacao = this.validarDados(req.body);
        if (validacao.erro) return res.status(400).render("produto/formulario", { produto: req.body, erro: validacao.erro });
        try {
            await this.produtoModel.criar(validacao.dados);
            return res.redirect("/produto?status=criado");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") return res.status(409).render("produto/formulario", { produto: req.body, erro: "Este SKU já está cadastrado." });
            console.error("Erro ao cadastrar produto:", erro);
            return res.status(500).render("produto/formulario", { produto: req.body, erro: "Não foi possível cadastrar o produto." });
        }
    };

    atualizar = async (req, res) => {
        const produto = { ...req.body, id: req.params.id };
        const validacao = this.validarDados(req.body);
        if (validacao.erro) return res.status(400).render("produto/formulario", { produto, erro: validacao.erro });
        try {
            const alterados = await this.produtoModel.atualizar(req.params.id, validacao.dados);
            if (!alterados) return res.redirect("/produto");
            return res.redirect("/produto?status=atualizado");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") return res.status(409).render("produto/formulario", { produto, erro: "Este SKU já está sendo usado por outro produto." });
            console.error("Erro ao atualizar produto:", erro);
            return res.status(500).render("produto/formulario", { produto, erro: "Não foi possível atualizar o produto." });
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
