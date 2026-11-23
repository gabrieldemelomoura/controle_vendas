class HomeController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/home", this.index);
    }

    index = (req, res) => {
        res.render("Home/Home");
    };
}

module.exports = HomeController;