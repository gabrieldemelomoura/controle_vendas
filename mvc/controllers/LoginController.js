const bcrypt = require("bcryptjs");
const LoginModel = require("../model/LoginModel");

class LoginController {
    constructor(app) {
        this.app = app;
        this.loginModel = new LoginModel();
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/", (req, res) => {
            res.redirect("/login");
        });

        this.app.get("/login", this.exibirLogin);
        this.app.post("/login", this.autenticar);
    }

    exibirLogin = (req, res) => {
        res.render("Login/login", { erro: null });
    };

    autenticar = async (req, res) => {
        try {
        const { usuario, senha } = req.body;

        if (!usuario || !senha) {
            return res.status(400).render("Login/login", {
            erro: "Informe o usuário e a senha.",
            });
        }

        const usuarioEncontrado =
            await this.loginModel.buscarPorUsuario(usuario);

        const senhaValida =
            usuarioEncontrado &&
            await bcrypt.compare(senha, usuarioEncontrado.senha_hash);

        if (!senhaValida) {
            return res.status(401).render("Login/login", {
            erro: "Usuário ou senha inválidos.",
            });
        }

        req.session.usuario = {
            id: usuarioEncontrado.id,
            nome: usuarioEncontrado.nome,
        };

        return res.redirect("/home");
        } catch (erro) {
        console.error("Erro ao autenticar:", erro);

        return res.status(500).render("Login/login", {
            erro: "Ocorreu um erro ao tentar entrar.",
        });
        }
    };
}

module.exports = LoginController;