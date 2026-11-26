-- Recursos de segurança de usuários.
-- A migration preserva usuários e senhas existentes: todos começam ativos
-- com perfil comum. Promova explicitamente a conta inicial do administrador.

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS perfil VARCHAR(20) NOT NULL DEFAULT 'usuario',
    ADD COLUMN IF NOT EXISTS ativo TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS versao_sessao INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tokens_redefinicao_senha (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id INT(11) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expira_em DATETIME NOT NULL,
    usado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_token_redefinicao_hash (token_hash),
    KEY idx_token_redefinicao_usuario (usuario_id, usado_em, expira_em),
    CONSTRAINT fk_token_redefinicao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
