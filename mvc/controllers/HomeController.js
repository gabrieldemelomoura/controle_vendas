const DashboardModel = require("../model/DashboardModel");
const { exigirLogin } = require("../middlewares/Autenticacao");

const PERIODOS_PERMITIDOS = [7, 30, 90];

class HomeController {
    constructor(app, dashboardModel = new DashboardModel()) {
        this.app = app;
        this.dashboardModel = dashboardModel;
        this.configurarRotas();
    }

    configurarRotas() {
        this.app.get("/home", exigirLogin, this.listar);
    }

    listar = async (req, res) => {
        const diasSolicitados = Number(req.query.dias);
        const dias = PERIODOS_PERMITIDOS.includes(diasSolicitados) ? diasSolicitados : 30;

        try {
            const dados = await this.dashboardModel.obterResumo(dias);
            return res.render("Home/Dashboard", {
                ...dados,
                dias,
                usuario: req.session.usuario,
                erro: null,
            });
        } catch (erro) {
            console.error("Erro ao carregar o dashboard:", erro);
            return res.status(500).render("Home/Dashboard", {
                dias,
                usuario: req.session.usuario,
                resumo: { faturamento: 0, liquidoMarketplace: 0, lucroBruto: 0, lucroLiquido: 0 },
                pontos: [],
                maisVendidos: [],
                menosVendidos: [],
                erro: "Não foi possível carregar os dados do dashboard. Confira se as tabelas de vendas da migration 001 estão no banco.",
            });
        }
    };
}

module.exports = HomeController;
