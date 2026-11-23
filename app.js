const express = require("express");
const session = require("express-session");
const path = require("path");

const HomeController = require("./mvc/controllers/HomeController");
const VendaController = require("./mvc/controllers/VendaController");
const ProdutoController = require("./mvc/controllers/ProdutoController");
const LoginController = require("./mvc/controllers/LoginController");

const app = express();
const PORT = 3000;

class Server {
    constructor() {
        this.app = express();
        this.porta = 3000;

        this.configurarMiddlewares();
        this.configurarViewEngine();
        this.configurarRotas();
        
    }

    configurarMiddlewares() {
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.json());

        this.app.use(
            session({
            secret:
                process.env.SESSION_SECRET ||
                "chave-local-apenas-para-desenvolvimento",
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                maxAge: 1000 * 60 * 60,
            },
            })
        );
    }

    configurarViewEngine() {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(__dirname, "mvc", "views"));
    this.app.use(express.static(path.join(__dirname, "mvc", "public")));
    }

    configurarRotas() {
    new HomeController(this.app);
    new VendaController(this.app);
    new ProdutoController(this.app);
    new LoginController(this.app);
    }

    on() {
        this.app.listen(this.porta, () => {
            console.log(`Servidor rodando em http://localhost:${this.porta}`);
        });
    }
}

new Server().on();