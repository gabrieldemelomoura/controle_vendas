const conexaoPadrao = require("./BancoModel");

const STATUS_VENDA_CONSIDERADOS = "'aprovada', 'aprovado', 'paid', 'approved', 'delivered', 'closed', 'concluida', 'finalizada'";

function formatarDataBanco(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function gerarIntervalo(dias) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias + 1);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const pontos = [];
    for (let indice = 0; indice < dias; indice += 1) {
        const data = new Date(inicio);
        data.setDate(data.getDate() + indice);
        pontos.push({ data: formatarDataBanco(data), faturamento: 0, liquidoMarketplace: 0, lucroBruto: 0, lucroLiquido: 0 });
    }

    return {
        inicio: `${formatarDataBanco(inicio)} 00:00:00`,
        fim: `${formatarDataBanco(amanha)} 00:00:00`,
        pontos,
    };
}

class DashboardModel {
    constructor(conexao = conexaoPadrao) {
        this.conexao = conexao;
    }

    async obterResumo(dias = 30) {
        const periodo = gerarIntervalo(dias);
        const parametros = [periodo.inicio, periodo.fim];
        const [resumoRows] = await this.conexao.execute(
            `SELECT
                COALESCE(SUM(venda.faturamento), 0) AS faturamento,
                COALESCE(SUM(venda.liquido_marketplace), 0) AS liquidoMarketplace,
                COALESCE(SUM(venda.custo_produtos), 0) AS custoProdutos,
                COALESCE(SUM(venda.faturamento - venda.custo_produtos), 0) AS lucroBruto,
                COALESCE(SUM(venda.liquido_marketplace - venda.custo_produtos), 0) AS lucroLiquido
             FROM (
                SELECT v.id,
                    COALESCE(v.valor_total_bruto, v.valor_itens_bruto, 0) AS faturamento,
                    COALESCE(v.valor_liquido_marketplace, 0) AS liquido_marketplace,
                    COALESCE(SUM(vi.quantidade * COALESCE(vi.custo_unitario_snapshot, p.custo_atual, 0)), 0) AS custo_produtos
                FROM vendas v
                LEFT JOIN venda_itens vi ON vi.venda_id = v.id
                LEFT JOIN produtos p ON p.id = vi.produto_id
                WHERE v.criado_no_marketplace_em >= ? AND v.criado_no_marketplace_em < ?
                    AND v.status_normalizado IN (${STATUS_VENDA_CONSIDERADOS})
                GROUP BY v.id, v.valor_total_bruto, v.valor_itens_bruto, v.valor_liquido_marketplace
             ) AS venda`,
            parametros
        );

        const [serieRows] = await this.conexao.execute(
            `SELECT DATE_FORMAT(v.criado_no_marketplace_em, '%Y-%m-%d') AS data,
                    COALESCE(SUM(COALESCE(v.valor_total_bruto, v.valor_itens_bruto, 0)), 0) AS faturamento,
                    COALESCE(SUM(v.valor_liquido_marketplace), 0) AS liquidoMarketplace,
                    COALESCE(SUM(COALESCE(v.valor_total_bruto, v.valor_itens_bruto, 0) - COALESCE(custos.custo_produtos, 0)), 0) AS lucroBruto,
                    COALESCE(SUM(COALESCE(v.valor_liquido_marketplace, 0) - COALESCE(custos.custo_produtos, 0)), 0) AS lucroLiquido
             FROM vendas v
             LEFT JOIN (
                SELECT vi.venda_id,
                    SUM(vi.quantidade * COALESCE(vi.custo_unitario_snapshot, p.custo_atual, 0)) AS custo_produtos
                FROM venda_itens vi
                LEFT JOIN produtos p ON p.id = vi.produto_id
                GROUP BY vi.venda_id
             ) AS custos ON custos.venda_id = v.id
             WHERE v.criado_no_marketplace_em >= ? AND v.criado_no_marketplace_em < ?
                AND v.status_normalizado IN (${STATUS_VENDA_CONSIDERADOS})
             GROUP BY DATE(v.criado_no_marketplace_em)
             ORDER BY DATE(v.criado_no_marketplace_em) ASC`,
            parametros
        );

        const indicePorData = new Map(periodo.pontos.map((ponto) => [ponto.data, ponto]));
        for (const linha of serieRows) {
            const ponto = indicePorData.get(linha.data);
            if (!ponto) continue;
            ponto.faturamento = Number(linha.faturamento || 0);
            ponto.liquidoMarketplace = Number(linha.liquidoMarketplace || 0);
            ponto.lucroBruto = Number(linha.lucroBruto || 0);
            ponto.lucroLiquido = Number(linha.lucroLiquido || 0);
        }

        const [maisRows] = await this.consultarRanking(periodo, "DESC");
        const [menosRows] = await this.consultarRanking(periodo, "ASC");
        const resumoDb = resumoRows[0] || {};

        return {
            resumo: {
                faturamento: Number(resumoDb.faturamento || 0),
                liquidoMarketplace: Number(resumoDb.liquidoMarketplace || 0),
                custoProdutos: Number(resumoDb.custoProdutos || 0),
                lucroBruto: Number(resumoDb.lucroBruto || 0),
                lucroLiquido: Number(resumoDb.lucroLiquido || 0),
            },
            pontos: periodo.pontos,
            maisVendidos: maisRows.map((linha) => this.normalizarProduto(linha)),
            menosVendidos: menosRows.map((linha) => this.normalizarProduto(linha)),
        };
    }

    async consultarRanking(periodo, ordem) {
        const direcao = ordem === "ASC" ? "ASC" : "DESC";
        return this.conexao.execute(
            `SELECT p.id, p.sku, p.nome,
                    COALESCE(ranking.unidades_vendidas, 0) AS unidades_vendidas,
                    COALESCE(ranking.faturamento, 0) AS faturamento
             FROM produtos p
             LEFT JOIN (
                SELECT vi.produto_id,
                    SUM(vi.quantidade) AS unidades_vendidas,
                    SUM(vi.quantidade * vi.preco_unitario) AS faturamento
                FROM vendas v
                INNER JOIN venda_itens vi ON vi.venda_id = v.id
                WHERE v.criado_no_marketplace_em >= ? AND v.criado_no_marketplace_em < ?
                    AND v.status_normalizado IN (${STATUS_VENDA_CONSIDERADOS})
                GROUP BY vi.produto_id
             ) AS ranking ON ranking.produto_id = p.id
             WHERE p.ativo = 1
             ORDER BY ranking.unidades_vendidas ${direcao}, p.nome ${direcao}
             LIMIT 15`,
            [periodo.inicio, periodo.fim]
        );
    }

    normalizarProduto(produto) {
        return {
            ...produto,
            unidades_vendidas: Number(produto.unidades_vendidas || 0),
            faturamento: Number(produto.faturamento || 0),
        };
    }
}

module.exports = DashboardModel;
