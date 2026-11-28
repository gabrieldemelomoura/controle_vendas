const conexao = require("./BancoModel");
const { criptografarToken } = require("../services/TokenCrypto");

class MarketplaceContaModel {
    constructor(db = conexao) {
        this.db = db;
    }

    async listarMercadoLivre() {
        const [linhas] = await this.db.execute(
            `SELECT id, marketplace, seller_externo_id, nome_exibicao, status_conexao,
                    access_token_expira_em, criado_em, atualizado_em
             FROM marketplace_contas WHERE marketplace = ? ORDER BY atualizado_em DESC`,
            ["mercadolivre"]
        );
        return linhas;
    }

    async salvarTokensMercadoLivre({ sellerId, accessToken, refreshToken, expiresIn, nomeExibicao = null }) {
        const accessTokenCifrado = criptografarToken(accessToken);
        const refreshTokenCifrado = criptografarToken(refreshToken);
        const expiraEm = new Date(Date.now() + Number(expiresIn) * 1000);
        await this.db.execute(
            `INSERT INTO marketplace_contas
                (marketplace, seller_externo_id, nome_exibicao, status_conexao,
                 access_token_cifrado, refresh_token_cifrado, access_token_expira_em)
             VALUES (?, ?, ?, 'conectada', ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                nome_exibicao = VALUES(nome_exibicao),
                status_conexao = 'conectada',
                access_token_cifrado = VALUES(access_token_cifrado),
                refresh_token_cifrado = VALUES(refresh_token_cifrado),
                access_token_expira_em = VALUES(access_token_expira_em)`,
            ["mercadolivre", String(sellerId), nomeExibicao, accessTokenCifrado, refreshTokenCifrado, expiraEm]
        );
    }
}

module.exports = MarketplaceContaModel;
