// Banco de dados SQLite (arquivo único em backend/data/teajudo.db, sem
// servidor externo) — guarda só o que precisa viver no servidor: conta dos
// responsáveis e status de assinatura (Fases 1-5). Tudo o mais do app
// (botões, logs, resultados de jogos etc.) continua só no localStorage do
// navegador, como documentado no CLAUDE.md — não precisa de sincronia
// entre dispositivos hoje, só a assinatura precisa ser "de verdade" no
// servidor (senão dá pra burlar bloqueio limpando o navegador).
//
// better-sqlite3 é síncrono (sem callback/Promise) — mais simples de usar
// aqui porque o volume de escrita é baixo (contas domésticas, não uma
// tabela de alto tráfego). Mesmo padrão de "arquivo em backend/data/,
// gitignored" já usado em voiceConfig.js.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'teajudo.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// CREATE TABLE IF NOT EXISTS — roda toda vez que o servidor sobe, sem
// apagar dados existentes. Suficiente pro estágio atual do projeto; se um
// dia o schema precisar mudar de um jeito que não seja "adicionar coluna
// nova", vale trocar por uma ferramenta de migração de verdade.
db.exec(`
  CREATE TABLE IF NOT EXISTS responsaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assinaturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id),
    status TEXT NOT NULL DEFAULT 'trial'
      CHECK (status IN ('trial', 'ativa', 'atraso', 'bloqueada')),
    valor_centavos INTEGER NOT NULL DEFAULT 2990,
    vencimento_em TEXT NOT NULL,
    ultimo_pagamento_em TEXT,
    infinitepay_order_nsu TEXT
  );

  CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assinatura_id INTEGER NOT NULL REFERENCES assinaturas(id),
    valor_centavos INTEGER NOT NULL,
    metodo TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    transaction_nsu TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voz_clonada_licenca (
    responsavel_id INTEGER PRIMARY KEY REFERENCES responsaveis(id),
    ativa INTEGER NOT NULL DEFAULT 0,
    comprado_em TEXT
  );

  -- Códigos de verificação por e-mail (troca de PIN e recuperação de
  -- senha) — ver lib/codeStore.js. Precisa ser tabela, não Map em
  -- memória: um reinício do processo (deploy novo, ou o serviço
  -- "dormindo" por inatividade em hospedagens grátis) apagaria qualquer
  -- código pendente, mesmo digitado certo e dentro do prazo.
  CREATE TABLE IF NOT EXISTS codigos_verificacao (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_sent_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_assinaturas_responsavel ON assinaturas(responsavel_id);
  CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON pagamentos(assinatura_id);
`);

// Migração incremental (coluna nova numa tabela que já existia antes da
// Fase 3) — CREATE TABLE IF NOT EXISTS não adiciona colunas em tabelas já
// criadas, então precisa desse passo à parte. Guarda o último "dias
// restantes" pra vencer que já gerou e-mail de lembrete (ver
// lib/reminders.js), pra não mandar o mesmo aviso mais de uma vez no
// mesmo dia mesmo que o cron rode de novo (ex: servidor reiniciou).
const assinaturasCols = db.prepare("PRAGMA table_info(assinaturas)").all().map((c) => c.name);
if (!assinaturasCols.includes('ultimo_lembrete_dias')) {
  db.exec('ALTER TABLE assinaturas ADD COLUMN ultimo_lembrete_dias INTEGER');
}
