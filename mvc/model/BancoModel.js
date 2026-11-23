const mysql = require("mysql2/promise");

const conexao = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "", // preencha se definiu uma senha para o root
    database: "controle_vendas",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
});

module.exports = conexao;