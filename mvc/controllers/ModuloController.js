const { exigirLogin } = require("../middlewares/Autenticacao");

const modulos = [
    { rota: "/estoque", titulo: "Estoque", chave: "estoque", grupo: "OPERAÇÃO", descricao: "O controle de estoque será desenvolvido em uma próxima etapa." },
    { rota: "/anuncios", titulo: "Anúncios / Marketplaces", chave: "anuncios", grupo: "OPERAÇÃO", descricao: "Aqui ficarão os anúncios e a conexão com o Mercado Livre." },
    { rota: "/relatorios", titulo: "Relatórios", chave: "relatorios", grupo: "OPERAÇÃO", descricao: "Os relatórios serão construídos depois da importação e validação das vendas." },
    { rota: "/financeiro", titulo: "Financeiro", chave: "financeiro", grupo: "FINANCEIRO", descricao: "Resumo e ferramentas financeiras entrarão nesta área." },
    { rota: "/financeiro/vencimentos", titulo: "Vencimentos", chave: "financeiro-vencimentos", grupo: "FINANCEIRO", descricao: "A área de vencimentos está planejada para uma próxima etapa." },
    { rota: "/financeiro/despesas", titulo: "Despesas", chave: "financeiro-despesas", grupo: "FINANCEIRO", descricao: "O cadastro e acompanhamento de despesas será implementado nesta área." },
    { rota: "/financeiro/compras", titulo: "Compra de mercadoria", chave: "financeiro-compras", grupo: "FINANCEIRO", descricao: "As compras de mercadoria poderão ser registradas nesta área futuramente." },
    { rota: "/financeiro/dre", titulo: "DRE", chave: "financeiro-dre", grupo: "FINANCEIRO", descricao: "A demonstração de resultados será construída após a validação dos dados financeiros." },
    { rota: "/financeiro/analise", titulo: "Análise financeira", chave: "financeiro-analise", grupo: "FINANCEIRO", descricao: "As análises serão adicionadas quando houver dados consolidados no sistema." },
    { rota: "/financeiro/categorias", titulo: "Categorias financeiras", chave: "financeiro-categorias", grupo: "FINANCEIRO", descricao: "As categorias financeiras poderão ser configuradas nesta área." },
    { rota: "/contas", titulo: "Contas de marketplace", chave: "contas", grupo: "ADMINISTRAÇÃO", descricao: "O gerenciamento de contas do Mercado Livre será desenvolvido antes de iniciar a integração." },
];

class ModuloController {
    constructor(app) {
        this.app = app;
        this.configurarRotas();
    }

    configurarRotas() {
        for (const modulo of modulos) {
            this.app.get(modulo.rota, exigirLogin, (req, res) => {
                res.render("Home/modulo", { ...modulo, usuario: req.session.usuario });
            });
        }
    }
}

module.exports = ModuloController;
