const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("node:fs");

const caminhoEnv = path.join(__dirname, ".env");
if (fs.existsSync(caminhoEnv) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(caminhoEnv);
}

const HomeController = require("./mvc/controllers/HomeController");
const VendaController = require("./mvc/controllers/VendaController");
const ProdutoController = require("./mvc/controllers/ProdutoController");
const LoginController = require("./mvc/controllers/LoginController");
const UsuarioController = require("./mvc/controllers/UsuarioController");
const ModuloController = require("./mvc/controllers/ModuloController");
const MercadoLivreController = require("./mvc/controllers/MercadoLivreController");
const { fornecerTokenCsrf } = require("./mvc/middlewares/Csrf");
const DashboardModel = require("./mvc/model/DashboardModel");

class Server {
    constructor() {
        this.app = express();
        // O cloudflared encaminha as requisições por conexão local; confiar só no loopback
        // permite ler X-Forwarded-For sem confiar em cabeçalhos de proxies arbitrários.
        this.app.set("trust proxy", "loopback");
        this.porta = Number(process.env.PORT || 3000);

        this.configurarMiddlewares();
        this.configurarViewEngine();
        this.configurarRotas();
        
    }

    configurarMiddlewares() {
        if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
            throw new Error("SESSION_SECRET deve estar configurado em produção.");
        }
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
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 1000 * 60 * 60,
            },
            })
        );
    }

    configurarViewEngine() {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(__dirname, "mvc", "views"));
    this.app.use(express.static(path.join(__dirname, "mvc", "public")));
    this.app.use(fornecerTokenCsrf);
    }

    configurarRotas() {
        new ProdutoController(this.app);
        new HomeController(this.app, new DashboardModel());

        new VendaController(this.app);
        new LoginController(this.app);
        new UsuarioController(this.app);
        new MercadoLivreController(this.app);
        new ModuloController(this.app);
    }

    async on() {
        const conexao = require("./mvc/model/BancoModel");
        try {
            await conexao.execute("SELECT 1");
        } catch (erro) {
            console.error(
                `Falha ao conectar ao MariaDB (${erro.code || "ERRO"}). Confira DB_HOST, DB_USER, DB_PASSWORD, DB_NAME e DB_PORT no .env.`
            );
            await conexao.end();
            process.exitCode = 1;
            return;
        }

        this.app.listen(this.porta, () => {
            console.log(`Servidor rodando em http://localhost:${this.porta} (MariaDB conectado)`);
        });
    }
}

new Server().on();
