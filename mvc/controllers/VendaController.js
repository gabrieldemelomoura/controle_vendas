const { exigirLogin } = require("../middlewares/Autenticacao");

class VendaController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/venda", exigirLogin, this.listar);
    }

    listar = (req, res) => {
        res.render("Home/modulo", {
            titulo: "Vendas",
            chave: "vendas",
            grupo: "OPERAÇÃO",
            descricao: "As vendas do Mercado Livre serão exibidas aqui quando a integração estiver pronta.",
            usuario: req.session.usuario,
        });
    };
}




module.exports = VendaController;
