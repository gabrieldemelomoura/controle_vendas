class ProdutoController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/produto", this.listar);
    }

    listar = (req, res) => {
        res.render("produto/produto");
    };
}

module.exports = ProdutoController;