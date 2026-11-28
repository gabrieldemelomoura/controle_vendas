const URL_AUTORIZACAO = "https://auth.mercadolivre.com.br/authorization";
const URL_TOKEN = "https://api.mercadolibre.com/oauth/token";

class MercadoLivreService {
    constructor({ env = process.env, fetchFn = globalThis.fetch } = {}) {
        this.env = env;
        this.fetchFn = fetchFn;
    }

    configurado() {
        return Boolean(
            this.env.MERCADOLIVRE_CLIENT_ID &&
            this.env.MERCADOLIVRE_CLIENT_SECRET &&
            this.env.MERCADOLIVRE_REDIRECT_URI &&
            /^[a-f0-9]{64}$/i.test(this.env.TOKEN_ENCRYPTION_KEY || "")
        );
    }

    exigirConfiguracao() {
        if (!this.configurado()) throw new Error("Configure as credenciais OAuth e TOKEN_ENCRYPTION_KEY no .env.");
        let redirect;
        try {
            redirect = new URL(this.env.MERCADOLIVRE_REDIRECT_URI);
        } catch {
            throw new Error("MERCADOLIVRE_REDIRECT_URI inválido.");
        }
        if (redirect.protocol !== "https:") throw new Error("O Redirect URI deve usar HTTPS.");
        // Enviar a string original: o Mercado Livre exige correspondência exata com o cadastro.
        return this.env.MERCADOLIVRE_REDIRECT_URI;
    }

    urlAutorizacao(state) {
        const redirectUri = this.exigirConfiguracao();
        const url = new URL(URL_AUTORIZACAO);
        url.search = new URLSearchParams({
            response_type: "code",
            client_id: this.env.MERCADOLIVRE_CLIENT_ID,
            redirect_uri: redirectUri,
            state,
        }).toString();
        return url.toString();
    }

    async trocarCodigoPorTokens(code) {
        const redirectUri = this.exigirConfiguracao();
        if (typeof this.fetchFn !== "function") throw new Error("Esta versão do Node.js precisa oferecer fetch global.");
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: this.env.MERCADOLIVRE_CLIENT_ID,
            client_secret: this.env.MERCADOLIVRE_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
        });
        const resposta = await this.fetchFn(URL_TOKEN, {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
            body,
            signal: AbortSignal.timeout(15000),
        });
        if (!resposta.ok) {
            const erro = new Error("Mercado Livre recusou a troca do código OAuth.");
            erro.code = `ML_HTTP_${resposta.status}`;
            throw erro;
        }
        return resposta.json();
    }
}

module.exports = MercadoLivreService;
