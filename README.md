# Controle de Vendas — Martins Importadora

Sistema interno para centralizar a gestão das vendas da Martins Importadora em marketplaces. A visão completa da plataforma reúne catálogo, vendas, estoque e resultados financeiros em um só lugar.

> **Escopo do projeto:** este README descreve as funcionalidades previstas para a versão completa. O desenvolvimento acontece por etapas; integrações e módulos podem ainda estar em implementação.

## Funcionalidades

### Dashboard

- Acompanhar faturamento, valor líquido recebido do marketplace, lucro bruto e lucro líquido em reais.
- Filtrar indicadores e gráficos por período e marketplace.
- Consultar a evolução diária dos resultados.
- Ver os 15 produtos mais vendidos e os 15 menos vendidos, incluindo produtos sem vendas no período.

### Produtos e anúncios

- Cadastrar e manter produtos com SKU, descrição e custo de aquisição.
- Inativar ou reativar produtos sem apagar o histórico.
- Vincular um produto interno a um ou mais anúncios de marketplace.
- Consultar anúncios, identificadores externos, status e canal de venda.

### Integrações com marketplaces

- Conectar a conta do Mercado Livre por autorização OAuth.
- Sincronizar anúncios, pedidos, itens, valores e atualizações de status.
- Relacionar os itens vendidos aos produtos do catálogo para consolidar quantidades e custos.
- Acompanhar o estado das sincronizações e tratar falhas sem duplicar pedidos.
- Preparar a arquitetura para integrações futuras com Shopee e Amazon.

### Vendas

- Consultar pedidos por período, marketplace, status e produto.
- Analisar itens, quantidades, preço, frete, taxas e valor líquido registrado.
- Abrir os detalhes do pedido e acompanhar suas atualizações.
- Identificar vendas canceladas ou com dados pendentes de associação ao catálogo.

### Estoque

- Consultar saldo por produto e acompanhar movimentações.
- Registrar entradas, saídas e ajustes de estoque.
- Identificar produtos com estoque baixo ou sem saldo.
- Usar as vendas sincronizadas para apoiar a atualização do estoque.

### Financeiro e relatórios

- Registrar despesas, compras de mercadoria, vencimentos e categorias financeiras.
- Consultar receitas, custos, taxas, despesas e resultados por período.
- Gerar uma DRE e relatórios de desempenho para apoiar decisões da operação.
- Exportar os dados selecionados para análise externa.

### Usuários e acesso

- Permitir que usuários criem suas próprias contas para acessar o sistema interno.
- Permitir que administradores consultem usuários e ativem ou inativem acessos.
- Recuperar a senha por e-mail.
- Restringir áreas administrativas de acordo com o perfil do usuário.

## Indicadores e cálculos

O dashboard consolida os dados das vendas importadas. A definição dos valores deve considerar os dados disponíveis em cada marketplace:

- **Faturamento:** valor bruto registrado nos pedidos considerados válidos.
- **Líquido do marketplace:** valor líquido informado ou calculado a partir dos dados da plataforma.
- **Lucro bruto:** faturamento menos o custo dos produtos vendidos.
- **Lucro líquido da venda:** líquido do marketplace menos o custo dos produtos e demais custos associados que estejam registrados.
- **Margem em reais:** valor monetário do resultado das vendas, apresentado sem substituir o lucro por uma porcentagem.

Despesas gerais só entram no lucro líquido quando forem registradas e vinculadas ao período ou à operação correspondente. O sistema deve indicar quando algum dado ainda não estiver disponível, em vez de apresentar valores fictícios.

## Tecnologias

- **Node.js** e **Express** no servidor.
- **EJS**, HTML e CSS nas páginas.
- **MariaDB/MySQL** para persistência.
- **Arquitetura MVC** para separar rotas, controllers, models e views.
- Serviços de integração separados para cada marketplace.

## Organização da aplicação

```text
app.js
mvc/
  controllers/       # Fluxos HTTP e regras de apresentação
  database/          # Migrações do banco
  middlewares/       # Autenticação, autorização e CSRF
  model/             # Consultas e persistência
  public/            # CSS e arquivos estáticos
  services/          # E-mail e integrações externas
  views/             # Páginas EJS e componentes compartilhados
tests/               # Testes automatizados
```

O fluxo principal segue: **requisição → rota Express → middleware → controller → model/serviço → MariaDB → view EJS**.

## Segurança

- Senhas armazenadas com hash, nunca em texto puro.
- Sessões regeneradas após autenticação e verificadas nas rotas protegidas.
- Verificação de perfil nas áreas administrativas.
- Tokens CSRF nos formulários que alteram dados.
- Limitação de tentativas em login e recuperação de senha.
- Consultas SQL parametrizadas para reduzir risco de injeção.
- Credenciais e tokens de marketplace devem permanecer no servidor e fora do Git.

## Testes

Execute a suíte automatizada com:

```bash
npm test
```

## Evolução planejada

1. Finalizar dashboard, catálogo e gestão de usuários.
2. Implementar a integração de leitura com o Mercado Livre.
3. Validar sincronização de pedidos, anúncios e indicadores com dados reais.
4. Desenvolver estoque e módulos financeiros.
5. Adicionar integrações com Shopee e Amazon.

---

Projeto desenvolvido para apoiar a operação da **Martins Importadora**.
