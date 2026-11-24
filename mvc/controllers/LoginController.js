const bcrypt = require("bcryptjs");
const LoginModel = require("../model/LoginModel");

class LoginController {
    constructor(app, loginModel = new LoginModel()) {
        this.app = app;
        this.loginModel = loginModel;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/", (req, res) => {
            res.redirect("/login");
        });

        this.app.get("/login", this.exibirLogin);
        this.app.post("/login", this.autenticar);
        this.app.get("/cadastro", this.exibirCadastro);
        this.app.post("/cadastro", this.cadastrar);
    }

    exibirLogin = (req, res) => {
        res.render("Login/login", { erro: null, aba: "login" });
    };

    exibirCadastro = (req, res) => {
        res.render("Login/login", { erro: null, aba: "cadastro" });
    };

    autenticar = async (req, res) => {
        try {
            const usuario = String(req.body?.usuario || "").trim();
            const senha = req.body?.senha;

            if (!usuario || typeof senha !== "string" || !senha) {
                return res.status(400).render("Login/login", {
                    erro: "Informe o usuário e a senha.",
                    aba: "login",
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
                    aba: "login",
                });
            }

            await this.iniciarSessao(req, usuarioEncontrado);
            return res.redirect("/home");
        } catch (erro) {
            console.error("Erro ao autenticar:", erro);

            return res.status(500).render("Login/login", {
                erro: "Ocorreu um erro ao tentar entrar.",
                aba: "login",
            });
        }
    };

    cadastrar = async (req, res) => {
        try {
            const nome = String(req.body?.nome || "").trim();
            const usuario = String(req.body?.usuario || "")
                .trim()
                .toLowerCase();
            const senha = req.body?.senha;

            if (!nome || !usuario || typeof senha !== "string") {
                return res.status(400).render("Login/login", {
                    erro: "Preencha todos os campos para criar sua conta.",
                    aba: "cadastro",
                });
            }

            const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario);
            const tamanhoSenha = Buffer.byteLength(senha, "utf8");

            if (nome.length > 100 || usuario.length > 150 || !emailValido) {
                return res.status(400).render("Login/login", {
                    erro: "Confira o nome e informe um e-mail válido.",
                    aba: "cadastro",
                });
            }

            if (tamanhoSenha < 8 || tamanhoSenha > 72) {
                return res.status(400).render("Login/login", {
                    erro: "A senha deve ter entre 8 e 72 bytes.",
                    aba: "cadastro",
                });
            }

            const senhaHash = await bcrypt.hash(senha, 12);
            const id = await this.loginModel.criarUsuario(
                nome,
                usuario,
                senhaHash
            );

            await this.iniciarSessao(req, { id, nome });
            return res.redirect("/home");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") {
                return res.status(409).render("Login/login", {
                    erro: "Já existe uma conta cadastrada com esse e-mail.",
                    aba: "cadastro",
                });
            }

            console.error("Erro ao cadastrar usuário:", erro);
            return res.status(500).render("Login/login", {
                erro: "Não foi possível criar a conta. Tente novamente.",
                aba: "cadastro",
            });
        }
    };

    iniciarSessao = (req, usuario) => {
        return new Promise((resolve, reject) => {
            req.session.regenerate((erro) => {
                if (erro) {
                    return reject(erro);
                }

                req.session.usuario = {
                    id: usuario.id,
                    nome: usuario.nome,
                };

                req.session.save((erroAoSalvar) => {
                    if (erroAoSalvar) {
                        return reject(erroAoSalvar);
                    }

                    resolve();
                });
            });
        });
    };
}

module.exports = LoginController;
