const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { criptografarToken, descriptografarToken } = require("../mvc/services/TokenCrypto");
const MercadoLivreService = require("../mvc/services/marketplaces/MercadoLivreService");
const MercadoLivreController = require("../mvc/controllers/MercadoLivreController");

const chave = crypto.randomBytes(32);
const chaveHex = chave.toString("hex");

test("criptografa tokens com AES-GCM, usa IV diferente e detecta alteração", () => {
    const token = "token-privado-de-teste";
    const primeiro = criptografarToken(token, chave);
    const segundo = criptografarToken(token, chave);
    assert.notEqual(primeiro, segundo);
    assert.notEqual(JSON.parse(primeiro).dados, token);
    assert.equal(descriptografarToken(primeiro, chave), token);
    const alterado = JSON.parse(primeiro);
    alterado.tag = `${alterado.tag.startsWith("00") ? "01" : "00"}${alterado.tag.slice(2)}`;
    assert.throws(() => descriptografarToken(JSON.stringify(alterado), chave));
});

test("OAuth monta URL oficial com state e URI cadastrado", () => {
    const service = new MercadoLivreService({ env: {
        MERCADOLIVRE_CLIENT_ID: "client-id",
        MERCADOLIVRE_CLIENT_SECRET: "client-secret",
        MERCADOLIVRE_REDIRECT_URI: "https://sistema.exemplo.test/integracoes/mercadolivre/callback",
        TOKEN_ENCRYPTION_KEY: chaveHex,
    } });
    const url = new URL(service.urlAutorizacao("state-aleatorio"));
    assert.equal(url.origin, "https://auth.mercadolivre.com.br");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "client-id");
    assert.equal(url.searchParams.get("redirect_uri"), "https://sistema.exemplo.test/integracoes/mercadolivre/callback");
    assert.equal(url.searchParams.get("state"), "state-aleatorio");
});

test("troca code por tokens via POST body sem incluir segredo na URL", async () => {
    let chamada;
    const service = new MercadoLivreService({
        env: {
            MERCADOLIVRE_CLIENT_ID: "client-id",
            MERCADOLIVRE_CLIENT_SECRET: "segredo-de-teste",
            MERCADOLIVRE_REDIRECT_URI: "https://app.exemplo.test/integracoes/mercadolivre/callback",
            TOKEN_ENCRYPTION_KEY: chaveHex,
        },
        fetchFn: async (url, options) => {
            chamada = { url, options };
            return { ok: true, json: async () => ({ access_token: "access", refresh_token: "refresh", user_id: 8, expires_in: 21600 }) };
        },
    });
    const resultado = await service.trocarCodigoPorTokens("code-test");
    assert.equal(chamada.url, "https://api.mercadolibre.com/oauth/token");
    assert.equal(chamada.options.method, "POST");
    assert.equal(chamada.options.body.get("client_secret"), "segredo-de-teste");
    assert.equal(chamada.options.body.get("code"), "code-test");
    assert.equal(chamada.options.body.get("redirect_uri"), "https://app.exemplo.test/integracoes/mercadolivre/callback");
    assert.equal(resultado.user_id, 8);
});

test("callback rejeita state ausente ou diferente antes de trocar o code", async () => {
    let trocouCodigo = false;
    const controller = new MercadoLivreController({ get() {} }, {}, {
        trocarCodigoPorTokens: async () => { trocouCodigo = true; },
        configurado: () => true,
    });
    let destino;
    const res = { redirect: (url) => { destino = url; } };
    await controller.callback({ session: { mercadoLivreOAuthState: { value: "state-correto", createdAt: Date.now() } }, query: { state: "state-errado", code: "code" } }, res);
    assert.equal(destino, "/contas?status=erro");
    assert.equal(trocouCodigo, false);
});

test("callback rejeita state expirado", async () => {
    let trocouCodigo = false;
    const controller = new MercadoLivreController({ get() {} }, {}, {
        trocarCodigoPorTokens: async () => { trocouCodigo = true; },
        configurado: () => true,
    });
    let destino;
    await controller.callback({
        session: { mercadoLivreOAuthState: { value: "state", createdAt: Date.now() - 11 * 60 * 1000 } },
        query: { state: "state", code: "code" },
    }, { redirect: (url) => { destino = url; } });
    assert.equal(destino, "/contas?status=erro");
    assert.equal(trocouCodigo, false);
});

test("callback salva tokens após state válido sem devolvê-los ao navegador", async () => {
    let salvo;
    let resposta;
    const contaModel = {
        salvarTokensMercadoLivre: async (dados) => { salvo = dados; },
        listarMercadoLivre: async () => [],
    };
    const service = {
        configurado: () => true,
        trocarCodigoPorTokens: async () => ({ user_id: 99, access_token: "access-secreto", refresh_token: "refresh-secreto", expires_in: 21600 }),
    };
    const controller = new MercadoLivreController({ get() {} }, contaModel, service);
    await controller.callback({ session: { mercadoLivreOAuthState: { value: "igual", createdAt: Date.now() } }, query: { state: "igual", code: "code-valido" } }, { redirect: (url) => { resposta = url; } });
    assert.equal(resposta, "/contas?status=conectado");
    assert.deepEqual(salvo, { sellerId: 99, accessToken: "access-secreto", refreshToken: "refresh-secreto", expiresIn: 21600 });
});

test("rotas de conectar e callback exigem login e administrador", () => {
    const rotas = [];
    const app = { get: (...args) => rotas.push(args) };
    const controller = new MercadoLivreController(app, { listarMercadoLivre: async () => [] }, { configurado: () => true });
    assert.ok(rotas.some((rota) => rota[0] === "/contas"));
    const { exigirLogin, exigirAdmin } = require("../mvc/middlewares/Autenticacao");
    for (const caminho of ["/integracoes/mercadolivre/conectar", "/integracoes/mercadolivre/callback"]) {
        const rota = rotas.find((item) => item[0] === caminho);
        assert.equal(rota[1], exigirLogin);
        assert.equal(rota[2], exigirAdmin);
    }
    assert.equal(controller.service.configurado(), true);
});

test("model armazena os tokens cifrados e nunca os envia em texto puro ao banco", async () => {
    const MarketplaceContaModel = require("../mvc/model/MarketplaceContaModel");
    const chaveAnterior = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = chaveHex;
    let consulta;
    try {
        const model = new MarketplaceContaModel({ execute: async (...args) => { consulta = args; return [{ affectedRows: 1 }]; } });
        await model.salvarTokensMercadoLivre({ sellerId: 31, accessToken: "access-plain", refreshToken: "refresh-plain", expiresIn: 3600 });
        assert.match(consulta[0], /ON DUPLICATE KEY UPDATE/);
        assert.ok(!consulta[1].includes("access-plain"));
        assert.ok(!consulta[1].includes("refresh-plain"));
        assert.equal(descriptografarToken(consulta[1][3], chave), "access-plain");
        assert.equal(descriptografarToken(consulta[1][4], chave), "refresh-plain");
    } finally {
        if (chaveAnterior === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
        else process.env.TOKEN_ENCRYPTION_KEY = chaveAnterior;
    }
});

test("página de contas renderiza lista vazia e estado sem credenciais", async () => {
    const ejs = require("ejs");
    const html = await ejs.renderFile(require("node:path").join(__dirname, "../mvc/views/Integracoes/contas.ejs"), {
        contas: [], usuario: { nome: "Gabriel", perfil: "admin" }, mensagem: null, oauthConfigurado: false,
    });
    assert.match(html, /Contas de marketplace/);
    assert.match(html, /Nenhuma conta conectada/);
    assert.match(html, /Configure o OAuth para conectar/);
});
