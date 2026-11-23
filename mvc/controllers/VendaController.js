class VendaController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/venda", this.listar);
    }

    listar = (req, res) => {
        res.render("venda/venda");
    };
}




module.exports = VendaController;