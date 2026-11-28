const crypto = require("node:crypto");
const MarketplaceContaModel = require("../model/MarketplaceContaModel");
const { exigirLogin, exigirAdmin } = require("../middlewares/Autenticacao");
const MercadoLivreService = require("../services/marketplaces/MercadoLivreService");

function estadosIguais(esperado, recebido) {
    if (typeof esperado !== "string" || typeof recebido !== "string") return false;
    const a = Buffer.from(esperado);
    const b = Buffer.from(recebido);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

class MercadoLivreController {
    constructor(app, contaModel = new MarketplaceContaModel(), service = new MercadoLivreService()) {
        this.app = app;
        this.contaModel = contaModel;
        this.service = service;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/contas", exigirLogin, this.listar);
        this.app.get("/integracoes/mercadolivre/conectar", exigirLogin, exigirAdmin, this.iniciarAutorizacao);
        this.app.get("/integracoes/mercadolivre/callback", exigirLogin, exigirAdmin, this.callback);
    }

    listar = async (req, res) => {
        try {
            const contas = await this.contaModel.listarMercadoLivre();
            const status = {
                conectado: { tipo: "sucesso", texto: "Conta do Mercado Livre conectada." },
                cancelado: { tipo: "aviso", texto: "A autorização foi cancelada no Mercado Livre." },
                erro: { tipo: "erro", texto: "Não foi possível concluir a conexão. Confira a configuração e tente novamente." },
            }[req.query.status] || null;
            return res.render("Integracoes/contas", {
                contas,
                usuario: req.session.usuario,
                mensagem: status,
                oauthConfigurado: this.service.configurado(),
            });
        } catch (erro) {
            console.error("Erro ao listar contas de marketplace:", erro.code || erro.name);
            return res.status(500).send("Não foi possível carregar as contas de marketplace.");
        }
    };

    iniciarAutorizacao = (req, res) => {
        try {
            const state = crypto.randomBytes(32).toString("hex");
            req.session.mercadoLivreOAuthState = { value: state, createdAt: Date.now() };
            return res.redirect(this.service.urlAutorizacao(state));
        } catch (erro) {
            console.error("Configuração OAuth do Mercado Livre inválida:", erro.message);
            return res.redirect("/contas?status=erro");
        }
    };

    callback = async (req, res) => {
        const stateSalvo = req.session.mercadoLivreOAuthState;
        delete req.session.mercadoLivreOAuthState;
        const idadeStateMs = Date.now() - Number(stateSalvo?.createdAt);
        if (!estadosIguais(stateSalvo?.value, req.query.state) || idadeStateMs < 0 || idadeStateMs > 10 * 60 * 1000) {
            return res.redirect("/contas?status=erro");
        }
        if (req.query.error) return res.redirect("/contas?status=cancelado");
        if (typeof req.query.code !== "string" || req.query.code.length > 2048) {
            return res.redirect("/contas?status=erro");
        }

        try {
            const tokens = await this.service.trocarCodigoPorTokens(req.query.code);
            if (!tokens.user_id || !tokens.access_token || !tokens.refresh_token || !Number.isFinite(Number(tokens.expires_in))) {
                throw new Error("Resposta OAuth incompleta.");
            }
            await this.contaModel.salvarTokensMercadoLivre({
                sellerId: tokens.user_id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expires_in,
            });
            return res.redirect("/contas?status=conectado");
        } catch (erro) {
            // Não registrar code, tokens, credenciais nem o corpo da resposta remota.
            console.error("Falha na conexão OAuth do Mercado Livre:", erro.code || erro.name || "ERRO");
            return res.redirect("/contas?status=erro");
        }
    };
}

module.exports = MercadoLivreController;
module.exports.estadosIguais = estadosIguais;
