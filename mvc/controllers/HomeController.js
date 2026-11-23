class HomeController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/home", this.exigirLogin, this.index);
    }

    exigirLogin = (req, res, next) => {
        if (!req.session.usuario) {
            return res.redirect("/login");
        }

        next();
    };

    index = (req, res) => {
        res.render("Home/Home");
    };
}

module.exports = HomeController;