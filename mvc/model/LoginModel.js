const conexaoPadrao = require("./BancoModel");

class LoginModel {
    constructor(conexao = conexaoPadrao) {
        this.conexao = conexao;
    }

    async buscarPorUsuario(usuario) {
        const [usuarios] = await this.conexao.execute(
            `SELECT id, nome, usuario, senha_hash, perfil, ativo, versao_sessao
             FROM usuarios WHERE usuario = ? LIMIT 1`,
            [usuario]
        );
        return usuarios[0] || null;
    }

    async criarUsuario(nome, usuario, senhaHash) {
        const [resultado] = await this.conexao.execute(
            `INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (?, ?, ?)`,
            [nome, usuario, senhaHash]
        );
        return resultado.insertId;
    }

    async buscarUsuarioAtivoPorEmail(usuario) {
        const [usuarios] = await this.conexao.execute(
            `SELECT id, nome, usuario FROM usuarios WHERE usuario = ? AND ativo = 1 LIMIT 1`,
            [usuario]
        );
        return usuarios[0] || null;
    }

    async criarTokenRedefinicao(usuarioId, tokenHash) {
        await this.conexao.execute(
            `UPDATE tokens_redefinicao_senha
             SET usado_em = CURRENT_TIMESTAMP
             WHERE usuario_id = ? AND usado_em IS NULL`,
            [usuarioId]
        );
        await this.conexao.execute(
            `INSERT INTO tokens_redefinicao_senha (usuario_id, token_hash, expira_em)
             VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE))`,
            [usuarioId, tokenHash]
        );
    }

    async buscarTokenRedefinicaoValido(tokenHash) {
        const [tokens] = await this.conexao.execute(
            `SELECT t.usuario_id, u.ativo
             FROM tokens_redefinicao_senha t
             INNER JOIN usuarios u ON u.id = t.usuario_id
             WHERE t.token_hash = ? AND t.usado_em IS NULL
               AND t.expira_em > CURRENT_TIMESTAMP AND u.ativo = 1
             LIMIT 1`,
            [tokenHash]
        );
        return tokens[0] || null;
    }

    async redefinirSenha(tokenHash, senhaHash) {
        const conexao = await this.conexao.getConnection();
        try {
            await conexao.beginTransaction();
            const [tokens] = await conexao.execute(
                `SELECT t.id, t.usuario_id
                 FROM tokens_redefinicao_senha t
                 INNER JOIN usuarios u ON u.id = t.usuario_id
                 WHERE t.token_hash = ? AND t.usado_em IS NULL
                   AND t.expira_em > CURRENT_TIMESTAMP AND u.ativo = 1
                 FOR UPDATE`,
                [tokenHash]
            );

            if (!tokens.length) {
                await conexao.rollback();
                return false;
            }

            const usuarioId = tokens[0].usuario_id;
            await conexao.execute(
                `UPDATE usuarios SET senha_hash = ?, versao_sessao = versao_sessao + 1 WHERE id = ? AND ativo = 1`,
                [senhaHash, usuarioId]
            );
            await conexao.execute(
                `UPDATE tokens_redefinicao_senha
                 SET usado_em = CURRENT_TIMESTAMP
                 WHERE usuario_id = ? AND usado_em IS NULL`,
                [usuarioId]
            );
            await conexao.commit();
            return true;
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    }
}

module.exports = LoginModel;
