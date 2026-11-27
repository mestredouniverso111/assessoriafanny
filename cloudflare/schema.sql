-- Banco D1 do quiz "Consulta Nutricional" (Fanny Viana)
-- Rodar uma vez: npx wrangler d1 execute <nome-do-banco> --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS leads (
  id                 TEXT PRIMARY KEY,
  criado_em          TEXT NOT NULL,
  atualizado_em      TEXT,
  status             TEXT NOT NULL DEFAULT 'novo',
  observacao         TEXT NOT NULL DEFAULT '',
  nome               TEXT,
  primeiro_nome      TEXT,
  whatsapp           TEXT,
  whatsapp_formatado TEXT,
  instagram          TEXT,
  objetivo           TEXT,
  objetivo_outro     TEXT,
  modalidade         TEXT,
  prazo              TEXT,
  utm_source         TEXT,
  utm_medium         TEXT,
  utm_campaign       TEXT,
  utm_content        TEXT,
  utm_term           TEXT,
  pagina             TEXT,
  referencia         TEXT,
  pais               TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_criado_em ON leads (criado_em);

CREATE TABLE IF NOT EXISTS tentativas_login (
  ip  TEXT PRIMARY KEY,
  n   INTEGER NOT NULL,
  ate INTEGER NOT NULL
);
