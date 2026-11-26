const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { criarMiddlewaresAutenticacao } = require("../mvc/middlewares/Autenticacao");
const { validarTokenCsrf } = require("../mvc/middlewares/Csrf");
const LoginController = require("../mvc/controllers/LoginController");

test("bloqueia acesso sem sessão e mantém rota pública para login", async () => {
    let destino;
    const { exigirLogin } = criarMiddlewaresAutenticacao({ execute: async () => [[]] });
    const req = { session: null };
    const res = { redirect: (url) => { destino = url; } };
    await exigirLogin(req, res, () => assert.fail("não deveria liberar"));
    assert.equal(destino, "/login");
});

test("bloqueia uma conta inativa e encerra a sessão", async () => {
    let destruida = false;
    let redirecionada = false;
    const conexao = { execute: async () => [[{ id: 7, nome: "Conta", perfil: "usuario", ativo: 0, versao_sessao: 0 }]] };
    const { exigirLogin } = criarMiddlewaresAutenticacao(conexao);
    const req = { session: { usuario: { id: 7, versaoSenha: 0 }, destroy: (cb) => { destruida = true; cb(); } } };
    const res = { clearCookie() {}, redirect: (url) => { redirecionada = url === "/login"; } };
    await exigirLogin(req, res, () => assert.fail("conta inativa foi liberada"));
    assert.equal(destruida, true);
    assert.equal(redirecionada, true);
});

test("encerra sessões cuja senha foi redefinida depois do login", async () => {
    let destruida = false;
    const conexao = { execute: async () => [[{ id: 7, nome: "Conta", perfil: "usuario", ativo: 1, versao_sessao: 2 }]] };
    const { exigirLogin } = criarMiddlewaresAutenticacao(conexao);
    const req = { session: { usuario: { id: 7, versaoSenha: 1 }, destroy: (cb) => { destruida = true; cb(); } } };
    const res = { clearCookie() {}, redirect: () => {} };
    await exigirLogin(req, res, () => assert.fail("sessão antiga foi liberada"));
    assert.equal(destruida, true);
});

test("valida tokens CSRF e rejeita valor divergente", () => {
    const token = crypto.randomBytes(32).toString("hex");
    const req = { session: { csrfToken: token }, body: { _csrf: token } };
    let passou = false;
    validarTokenCsrf(req, {}, () => { passou = true; });
    assert.equal(passou, true);

    let status;
    const res = { status: (value) => { status = value; return res; }, send() {} };
    validarTokenCsrf({ session: { csrfToken: token }, body: { _csrf: "errado" } }, res, () => assert.fail("CSRF inválido passou"));
    assert.equal(status, 403);
});

test("registra rotas de login, cadastro e recuperação com limites de tentativas", () => {
    const rotas = [];
    const app = { get: (...args) => rotas.push(["GET", ...args]), post: (...args) => rotas.push(["POST", ...args]) };
    new LoginController(app, {}, { enviarLinkRedefinicao: async () => {} });
    for (const [method, route] of [["GET", "/recuperar-senha"], ["POST", "/recuperar-senha"], ["GET", "/redefinir-senha"], ["POST", "/redefinir-senha"], ["POST", "/cadastro"]]) {
        assert.ok(rotas.some((item) => item[0] === method && item[1] === route), `${method} ${route} não foi registrada`);
    }
});

test("pedido de recuperação não revela se um endereço existe e envia token somente ao usuário ativo", async () => {
    const antigoBase = process.env.APP_BASE_URL;
    const antigoAmbiente = process.env.NODE_ENV;
    process.env.APP_BASE_URL = "https://sistema.exemplo.test";
    process.env.NODE_ENV = "test";
    const tokensSalvos = [];
    const emailsEnviados = [];
    const loginModel = {
        buscarUsuarioAtivoPorEmail: async (email) => email === "ativo@exemplo.test" ? { id: 9, usuario: email } : null,
        criarTokenRedefinicao: async (id, hash) => tokensSalvos.push({ id, hash }),
    };
    const app = { get() {}, post() {} };
    const controller = new LoginController(app, loginModel, { enviarLinkRedefinicao: async (email, url) => emailsEnviados.push({ email, url }) });
    const responder = () => ({
        render(view, locals) { this.view = view; this.locals = locals; return this; },
    });
    try {
        const ativoResponse = responder();
        await controller.solicitarRedefinicao({ body: { usuario: "ATIVO@EXEMPLO.TEST" } }, ativoResponse);
        assert.match(ativoResponse.locals.mensagem, /Se houver uma conta ativa/);
        assert.equal(tokensSalvos.length, 1);
        assert.equal(emailsEnviados[0].email, "ativo@exemplo.test");
        const tokenEnviado = new URL(emailsEnviados[0].url).searchParams.get("token");
        assert.equal(tokenEnviado.length, 43);
        assert.notEqual(tokensSalvos[0].hash, tokenEnviado);
        assert.equal(tokensSalvos[0].hash.length, 64);

        const desconhecidoResponse = responder();
        await controller.solicitarRedefinicao({ body: { usuario: "ausente@exemplo.test" } }, desconhecidoResponse);
        assert.equal(desconhecidoResponse.locals.mensagem, ativoResponse.locals.mensagem);
        assert.equal(emailsEnviados.length, 1);
    } finally {
        if (antigoBase === undefined) delete process.env.APP_BASE_URL;
        else process.env.APP_BASE_URL = antigoBase;
        if (antigoAmbiente === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = antigoAmbiente;
    }
});

test("administrador não pode inativar a própria conta", async () => {
    let chamouModel = false;
    const UsuarioController = require("../mvc/controllers/UsuarioController");
    const controller = new UsuarioController({ get() {}, post() {} }, { alterarAtivo: async () => { chamouModel = true; return { alterado: true }; } });
    let status;
    const res = { status: (value) => { status = value; return res; }, send() {} };
    await controller.alterarEstado({ params: { id: "4" }, session: { usuario: { id: 4, perfil: "admin" } } }, res, 0);
    assert.equal(status, 400);
    assert.equal(chamouModel, false);
});
