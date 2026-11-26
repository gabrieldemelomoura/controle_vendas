const conexaoPadrao = require("./BancoModel");

class UsuarioModel {
    constructor(conexao = conexaoPadrao) {
        this.conexao = conexao;
    }

    async listar() {
        const [usuarios] = await this.conexao.execute(
            `SELECT id, nome, usuario, perfil, ativo
             FROM usuarios ORDER BY nome ASC`
        );
        return usuarios;
    }

    async alterarAtivo(id, ativo) {
        const conexao = await this.conexao.getConnection();
        try {
            await conexao.beginTransaction();
            const [alvo] = await conexao.execute(
                `SELECT id, perfil, ativo FROM usuarios WHERE id = ? FOR UPDATE`,
                [id]
            );
            if (!alvo.length) {
                await conexao.rollback();
                return { alterado: false, motivo: "nao_encontrado" };
            }

            if (ativo === 0 && Number(alvo[0].ativo) === 1 && alvo[0].perfil === "admin") {
                const [admins] = await conexao.execute(
                    `SELECT id FROM usuarios WHERE perfil = 'admin' AND ativo = 1 FOR UPDATE`
                );
                if (admins.length <= 1) {
                    await conexao.rollback();
                    return { alterado: false, motivo: "ultimo_admin" };
                }
            }

            const [resultado] = await conexao.execute(
                `UPDATE usuarios SET ativo = ? WHERE id = ?`,
                [ativo, id]
            );
            await conexao.commit();
            return { alterado: resultado.affectedRows > 0, motivo: null };
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    }
}

module.exports = UsuarioModel;
