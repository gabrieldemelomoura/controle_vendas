const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const LoginModel = require("../model/LoginModel");
const EmailService = require("../services/EmailService");
const { validarTokenCsrf } = require("../middlewares/Csrf");

class LoginController {
    constructor(app, loginModel = new LoginModel(), emailService = new EmailService()) {
        this.app = app;
        this.loginModel = loginModel;
        this.emailService = emailService;
        this.configurarRotas();
    }

    configurarRotas() {
        const limitarLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
        const limitarRecuperacao = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

        this.app.get("/", (req, res) => res.redirect("/login"));
        this.app.get("/login", this.exibirLogin);
        this.app.post("/login", limitarLogin, validarTokenCsrf, this.autenticar);
        this.app.get("/cadastro", this.exibirCadastro);
        this.app.post("/cadastro", limitarLogin, validarTokenCsrf, this.cadastrar);
        this.app.get("/recuperar-senha", this.exibirSolicitacaoRedefinicao);
        this.app.post("/recuperar-senha", limitarRecuperacao, validarTokenCsrf, this.solicitarRedefinicao);
        this.app.get("/redefinir-senha", this.exibirRedefinicao);
        this.app.post("/redefinir-senha", limitarRecuperacao, validarTokenCsrf, this.redefinirSenha);
    }

    exibirLogin = (req, res) => res.render("Login/login", { erro: null, aba: "login" });

    exibirCadastro = (req, res) => res.render("Login/login", { erro: null, aba: "cadastro" });

    autenticar = async (req, res) => {
        try {
            const usuario = String(req.body?.usuario || "").trim().toLowerCase();
            const senha = req.body?.senha;
            if (!usuario || typeof senha !== "string" || !senha) {
                return res.status(400).render("Login/login", { erro: "Informe o usuário e a senha.", aba: "login" });
            }

            const usuarioEncontrado = await this.loginModel.buscarPorUsuario(usuario);
            const senhaValida = usuarioEncontrado && Number(usuarioEncontrado.ativo) === 1 &&
                await bcrypt.compare(senha, usuarioEncontrado.senha_hash);
            if (!senhaValida) {
                return res.status(401).render("Login/login", { erro: "Usuário ou senha inválidos.", aba: "login" });
            }

            await this.iniciarSessao(req, usuarioEncontrado);
            return res.redirect("/home");
        } catch (erro) {
            console.error("Erro ao autenticar:", erro);
            return res.status(500).render("Login/login", { erro: "Ocorreu um erro ao tentar entrar.", aba: "login" });
        }
    };

    cadastrar = async (req, res) => {
        try {
            const nome = String(req.body?.nome || "").trim();
            const usuario = String(req.body?.usuario || "").trim().toLowerCase();
            const senha = req.body?.senha;
            if (!nome || !usuario || typeof senha !== "string") {
                return res.status(400).render("Login/login", { erro: "Preencha todos os campos para criar sua conta.", aba: "cadastro" });
            }

            const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario);
            const tamanhoSenha = Buffer.byteLength(senha, "utf8");
            if (nome.length > 100 || usuario.length > 150 || !emailValido) {
                return res.status(400).render("Login/login", { erro: "Confira o nome e informe um e-mail válido.", aba: "cadastro" });
            }
            if (tamanhoSenha < 8 || tamanhoSenha > 72) {
                return res.status(400).render("Login/login", { erro: "A senha deve ter entre 8 e 72 bytes.", aba: "cadastro" });
            }

            const senhaHash = await bcrypt.hash(senha, 12);
            const id = await this.loginModel.criarUsuario(nome, usuario, senhaHash);
            await this.iniciarSessao(req, { id, nome, perfil: "usuario" });
            return res.redirect("/home");
        } catch (erro) {
            if (erro.code === "ER_DUP_ENTRY") {
                return res.status(409).render("Login/login", { erro: "Já existe uma conta cadastrada com esse e-mail.", aba: "cadastro" });
            }
            console.error("Erro ao cadastrar usuário:", erro);
            return res.status(500).render("Login/login", { erro: "Não foi possível criar a conta. Tente novamente.", aba: "cadastro" });
        }
    };

    exibirSolicitacaoRedefinicao = (req, res) => res.render("Login/recuperar-senha", { mensagem: null, erro: null });

    solicitarRedefinicao = async (req, res) => {
        const email = String(req.body?.usuario || "").trim().toLowerCase();
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailValido || email.length > 150) {
            return res.status(400).render("Login/recuperar-senha", { mensagem: null, erro: "Informe um e-mail válido." });
        }

        const mensagem = "Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir a senha.";
        try {
            const usuario = await this.loginModel.buscarUsuarioAtivoPorEmail(email);
            if (usuario) {
                const token = crypto.randomBytes(32).toString("base64url");
                const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
                await this.loginModel.criarTokenRedefinicao(usuario.id, tokenHash);

                const base = process.env.APP_BASE_URL ||
                    (process.env.NODE_ENV === "production" ? null : `http://localhost:${process.env.PORT || 3000}`);
                if (!base) throw Object.assign(new Error("APP_BASE_URL não está configurada."), { code: "MAIL_CONFIG_MISSING" });
                const urlBase = new URL(base);
                if (process.env.NODE_ENV === "production" && urlBase.protocol !== "https:") {
                    throw Object.assign(new Error("APP_BASE_URL deve usar HTTPS em produção."), { code: "MAIL_CONFIG_MISSING" });
                }
                const link = new URL("/redefinir-senha", urlBase);
                link.searchParams.set("token", token);
                await this.emailService.enviarLinkRedefinicao(usuario.usuario, link.toString());
            }
        } catch (erro) {
            // A resposta continua genérica para não revelar se o e-mail está cadastrado.
            if (erro.code === "SMTP_NOT_CONFIGURED" || erro.code === "MAIL_CONFIG_MISSING") {
                console.warn("Recuperação de senha indisponível: configure o serviço de e-mail e APP_BASE_URL.");
            } else {
                console.error("Erro ao processar recuperação de senha:", erro.message);
            }
        }

        return res.render("Login/recuperar-senha", { mensagem, erro: null });
    };

    exibirRedefinicao = async (req, res) => {
        const token = String(req.query?.token || "");
        if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
            return res.status(400).render("Login/redefinir-senha", { token: "", erro: "Este link é inválido ou expirou." });
        }
        try {
            const hash = crypto.createHash("sha256").update(token).digest("hex");
            const valido = await this.loginModel.buscarTokenRedefinicaoValido(hash);
            if (!valido) return res.status(400).render("Login/redefinir-senha", { token: "", erro: "Este link é inválido ou expirou." });
            return res.render("Login/redefinir-senha", { token, erro: null });
        } catch (erro) {
            console.error("Erro ao validar link de redefinição:", erro);
            return res.status(500).render("Login/redefinir-senha", { token: "", erro: "Não foi possível validar o link agora." });
        }
    };

    redefinirSenha = async (req, res) => {
        const token = String(req.body?.token || "");
        const senha = req.body?.senha;
        const confirmarSenha = req.body?.confirmarSenha;
        if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
            return res.status(400).render("Login/redefinir-senha", { token: "", erro: "Este link é inválido ou expirou." });
        }
        if (typeof senha !== "string" || Buffer.byteLength(senha, "utf8") < 8 || Buffer.byteLength(senha, "utf8") > 72) {
            return res.status(400).render("Login/redefinir-senha", { token, erro: "A senha deve ter entre 8 e 72 bytes." });
        }
        if (senha !== confirmarSenha) {
            return res.status(400).render("Login/redefinir-senha", { token, erro: "As senhas não coincidem." });
        }

        try {
            const hashToken = crypto.createHash("sha256").update(token).digest("hex");
            const senhaHash = await bcrypt.hash(senha, 12);
            const atualizada = await this.loginModel.redefinirSenha(hashToken, senhaHash);
            if (!atualizada) return res.status(400).render("Login/redefinir-senha", { token: "", erro: "Este link é inválido ou expirou." });
            return res.render("Login/senha-redefinida", { erro: null });
        } catch (erro) {
            console.error("Erro ao redefinir senha:", erro);
            return res.status(500).render("Login/redefinir-senha", { token, erro: "Não foi possível salvar a nova senha." });
        }
    };

    iniciarSessao = (req, usuario) => new Promise((resolve, reject) => {
        req.session.regenerate((erro) => {
            if (erro) return reject(erro);
            req.session.usuario = {
                id: usuario.id,
                nome: usuario.nome,
                perfil: usuario.perfil || "usuario",
                versaoSenha: Number(usuario.versao_sessao || 0),
            };
            req.session.save((erroAoSalvar) => erroAoSalvar ? reject(erroAoSalvar) : resolve());
        });
    });
}

module.exports = LoginController;
