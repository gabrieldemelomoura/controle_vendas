const { exigirLogin } = require("../middlewares/Autenticacao");

class HomeController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/home", exigirLogin, this.index);
    }

    index = (req, res) => {
        res.render("Home/Home");
    };
}

module.exports = HomeController;
