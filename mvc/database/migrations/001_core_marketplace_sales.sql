-- Núcleo de catálogo e vendas para Mercado Livre, Shopee e Amazon.
-- Selecione o banco controle_vendas antes de executar esta migration.
-- Esta migration é aditiva: não altera nem recria a tabela usuarios.

CREATE TABLE IF NOT EXISTS marketplace_contas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    marketplace VARCHAR(30) NOT NULL,
    seller_externo_id VARCHAR(120) NOT NULL,
    nome_exibicao VARCHAR(160) NULL,
    status_conexao VARCHAR(30) NOT NULL DEFAULT 'pendente',
    access_token_cifrado TEXT NULL,
    refresh_token_cifrado TEXT NULL,
    access_token_expira_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_marketplace_conta_seller (marketplace, seller_externo_id),
    KEY idx_marketplace_conta_status (status_conexao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produtos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sku VARCHAR(80) NOT NULL,
    nome VARCHAR(180) NOT NULL,
    descricao TEXT NULL,
    custo_atual DECIMAL(13,2) NOT NULL DEFAULT 0.00,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_produtos_sku (sku),
    KEY idx_produtos_nome (nome),
    KEY idx_produtos_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anuncios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    marketplace_conta_id BIGINT UNSIGNED NOT NULL,
    produto_id BIGINT UNSIGNED NULL,
    anuncio_externo_id VARCHAR(140) NOT NULL,
    sku_vendedor VARCHAR(120) NULL,
    titulo VARCHAR(220) NULL,
    status_marketplace VARCHAR(50) NULL,
    tipo_logistica VARCHAR(50) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_anuncios_conta_externo (marketplace_conta_id, anuncio_externo_id),
    KEY idx_anuncios_produto (produto_id),
    KEY idx_anuncios_sku_vendedor (sku_vendedor),
    CONSTRAINT fk_anuncios_conta FOREIGN KEY (marketplace_conta_id)
        REFERENCES marketplace_contas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_anuncios_produto FOREIGN KEY (produto_id)
        REFERENCES produtos (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    marketplace_conta_id BIGINT UNSIGNED NOT NULL,
    pedido_externo_id VARCHAR(140) NOT NULL,
    status_normalizado VARCHAR(30) NOT NULL DEFAULT 'desconhecido',
    status_marketplace VARCHAR(60) NULL,
    moeda CHAR(3) NOT NULL DEFAULT 'BRL',
    criado_no_marketplace_em DATETIME NULL,
    aprovado_no_marketplace_em DATETIME NULL,
    atualizado_no_marketplace_em DATETIME NULL,
    valor_itens_bruto DECIMAL(13,2) NULL,
    valor_frete_cliente DECIMAL(13,2) NULL,
    valor_total_bruto DECIMAL(13,2) NULL,
    valor_liquido_marketplace DECIMAL(13,2) NULL,
    sincronizado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vendas_conta_pedido (marketplace_conta_id, pedido_externo_id),
    KEY idx_vendas_data_status (criado_no_marketplace_em, status_normalizado),
    CONSTRAINT fk_vendas_conta FOREIGN KEY (marketplace_conta_id)
        REFERENCES marketplace_contas (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venda_itens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    venda_id BIGINT UNSIGNED NOT NULL,
    produto_id BIGINT UNSIGNED NULL,
    anuncio_id BIGINT UNSIGNED NULL,
    item_externo_id VARCHAR(140) NULL,
    sku_snapshot VARCHAR(120) NULL,
    nome_produto_snapshot VARCHAR(220) NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL DEFAULT 1.000,
    preco_unitario DECIMAL(13,2) NOT NULL,
    custo_unitario_snapshot DECIMAL(13,2) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_venda_itens_venda (venda_id),
    KEY idx_venda_itens_produto (produto_id),
    KEY idx_venda_itens_anuncio (anuncio_id),
    CONSTRAINT fk_venda_itens_venda FOREIGN KEY (venda_id)
        REFERENCES vendas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_venda_itens_produto FOREIGN KEY (produto_id)
        REFERENCES produtos (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_venda_itens_anuncio FOREIGN KEY (anuncio_id)
        REFERENCES anuncios (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venda_lancamentos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    venda_id BIGINT UNSIGNED NOT NULL,
    venda_item_id BIGINT UNSIGNED NULL,
    categoria VARCHAR(40) NOT NULL,
    origem VARCHAR(30) NOT NULL DEFAULT 'marketplace',
    descricao VARCHAR(220) NULL,
    valor DECIMAL(13,2) NOT NULL,
    referencia_externa VARCHAR(140) NULL,
    ocorrido_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_venda_lancamentos_venda (venda_id),
    KEY idx_venda_lancamentos_categoria (categoria),
    CONSTRAINT fk_venda_lancamentos_venda FOREIGN KEY (venda_id)
        REFERENCES vendas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_venda_lancamentos_item FOREIGN KEY (venda_item_id)
        REFERENCES venda_itens (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS integracao_eventos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    marketplace_conta_id BIGINT UNSIGNED NOT NULL,
    chave_deduplicacao VARCHAR(190) NOT NULL,
    topico VARCHAR(80) NOT NULL,
    recurso_externo VARCHAR(255) NULL,
    status_processamento VARCHAR(30) NOT NULL DEFAULT 'pendente',
    tentativas INT UNSIGNED NOT NULL DEFAULT 0,
    recebido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processado_em DATETIME NULL,
    erro TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_integracao_evento_dedup (marketplace_conta_id, chave_deduplicacao),
    KEY idx_integracao_eventos_status (status_processamento, recebido_em),
    CONSTRAINT fk_integracao_eventos_conta FOREIGN KEY (marketplace_conta_id)
        REFERENCES marketplace_contas (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS integracao_sincronizacoes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    marketplace_conta_id BIGINT UNSIGNED NOT NULL,
    recurso VARCHAR(80) NOT NULL,
    cursor_sincronizacao VARCHAR(500) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    iniciada_em DATETIME NULL,
    concluida_em DATETIME NULL,
    erro TEXT NULL,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_integracao_sync_conta_recurso (marketplace_conta_id, recurso),
    CONSTRAINT fk_integracao_sync_conta FOREIGN KEY (marketplace_conta_id)
        REFERENCES marketplace_contas (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
