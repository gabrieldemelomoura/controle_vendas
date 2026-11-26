const UsuarioModel = require("../model/UsuarioModel");
const { exigirLogin, exigirAdmin } = require("../middlewares/Autenticacao");
const { validarTokenCsrf } = require("../middlewares/Csrf");

class UsuarioController {
    constructor(app, usuarioModel = new UsuarioModel()) {
        this.app = app;
        this.usuarioModel = usuarioModel;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/admin/usuarios", exigirLogin, exigirAdmin, this.listar);
        this.app.post("/admin/usuarios/:id/inativar", exigirLogin, exigirAdmin, validarTokenCsrf, this.inativar);
        this.app.post("/admin/usuarios/:id/reativar", exigirLogin, exigirAdmin, validarTokenCsrf, this.reativar);
    }

    listar = async (req, res) => {
        try {
            const usuarios = await this.usuarioModel.listar();
            const mensagens = {
                inativado: "Usuário inativado. O acesso dele foi bloqueado.",
                reativado: "Usuário reativado.",
            };
            return res.render("Admin/usuarios", {
                usuarios,
                usuarioAtualId: Number(req.session.usuario.id),
                usuario: req.session.usuario,
                sucesso: mensagens[req.query.status] || null,
                erro: null,
            });
        } catch (erro) {
            console.error("Erro ao listar usuários:", erro);
            return res.status(500).send("Não foi possível carregar a lista de usuários.");
        }
    };

    inativar = async (req, res) => this.alterarEstado(req, res, 0);
    reativar = async (req, res) => this.alterarEstado(req, res, 1);

    alterarEstado = async (req, res, ativo) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.redirect("/admin/usuarios");
        if (id === Number(req.session.usuario.id) && ativo === 0) {
            return res.status(400).send("Você não pode inativar sua própria conta.");
        }

        try {
            const resultado = await this.usuarioModel.alterarAtivo(id, ativo);
            if (!resultado.alterado && resultado.motivo === "ultimo_admin") {
                return res.status(409).send("Não é possível inativar o último administrador ativo.");
            }
            const status = ativo ? "reativado" : "inativado";
            return res.redirect(`/admin/usuarios?status=${status}`);
        } catch (erro) {
            console.error("Erro ao alterar estado do usuário:", erro);
            return res.status(500).send("Não foi possível alterar o estado do usuário.");
        }
    };
}

module.exports = UsuarioController;
