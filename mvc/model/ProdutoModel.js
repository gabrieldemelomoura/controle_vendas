const conexaoPadrao = require("./BancoModel");

class ProdutoModel {
    constructor(conexao = conexaoPadrao) {
        this.conexao = conexao;
    }

    async listar({ incluirInativos = false } = {}) {
        const filtro = incluirInativos ? "" : "WHERE ativo = 1";
        const [produtos] = await this.conexao.execute(
            `SELECT id, sku, nome, descricao, custo_atual, ativo, criado_em, atualizado_em
             FROM produtos ${filtro} ORDER BY nome ASC`
        );
        return produtos;
    }

    async buscarPorId(id) {
        const [produtos] = await this.conexao.execute(
            `SELECT id, sku, nome, descricao, custo_atual, ativo
             FROM produtos WHERE id = ? LIMIT 1`,
            [id]
        );
        return produtos[0] || null;
    }

    async criar({ sku, nome, descricao, custoAtual }) {
        const [resultado] = await this.conexao.execute(
            `INSERT INTO produtos (sku, nome, descricao, custo_atual)
             VALUES (?, ?, ?, ?)`,
            [sku, nome, descricao || null, custoAtual]
        );
        return resultado.insertId;
    }

    async atualizar(id, { sku, nome, descricao, custoAtual }) {
        const [resultado] = await this.conexao.execute(
            `UPDATE produtos
             SET sku = ?, nome = ?, descricao = ?, custo_atual = ?
             WHERE id = ? AND ativo = 1`,
            [sku, nome, descricao || null, custoAtual, id]
        );
        return resultado.affectedRows;
    }

    async inativar(id) {
        const [resultado] = await this.conexao.execute(
            `UPDATE produtos SET ativo = 0 WHERE id = ? AND ativo = 1`,
            [id]
        );
        return resultado.affectedRows;
    }
}

module.exports = ProdutoModel;
