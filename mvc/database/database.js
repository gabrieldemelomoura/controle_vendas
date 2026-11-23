const conexao = require("../model/BancoModel");

async function testarConexao() {
    try {
        const [resultado] = await conexao.query("SELECT 1");
        console.log("Conexão com MariaDB funcionando:", resultado);
    } catch (erro) {
        console.error("Falha ao conectar com MariaDB:", erro.message);
    }
}

module.exports = testarConexao;