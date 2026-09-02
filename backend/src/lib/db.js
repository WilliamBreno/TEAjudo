// Banco de dados (Turso/libSQL — compatível com SQLite, mas persistente
// de verdade em produção) — guarda só o que precisa viver no servidor:
// conta dos responsáveis e status de assinatura (Fases 1-5). Tudo o mais
// do app (botões, logs, resultados de jogos etc.) continua só no
// localStorage do navegador, como documentado no CLAUDE.md — não precisa
// de sincronia entre dispositivos hoje, só a assinatura precisa ser "de
// verdade" no servidor (senão dá pra burlar bloqueio limpando o
// navegador).
//
// Antes disso era better-sqlite3 (arquivo local, síncrono) — trocado
// porque hospedagens grátis como o Render não têm disco persistente: o
// arquivo (e todas as contas nele) sumia a cada deploy/reinício do
// processo, mesmo com o código funcionando perfeitamente. @libsql/client
// fala com um banco remoto (Turso — free tier de verdade, sem
// expiração) usando o mesmo dialeto SQL do SQLite; em dev local, sem
// TURSO_DATABASE_URL configurada, cai automaticamente num arquivo local
// (mesmo comportamento de antes, sem precisar de conta externa só pra
// rodar na sua máquina).

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'teajudo.db');
const usandoTurso = !!process.env.TURSO_DATABASE_URL;

// Sem TURSO_DATABASE_URL, cai em arquivo local — bom pra dev, mas em
// produção (hospedagens grátis como o Render não têm disco persistente)
// isso apagaria o banco inteiro a cada deploy/reinício, exatamente o bug
// que motivou essa migração. Recusa subir nesse caso (mesmo espírito do
// COOKIE_SECRET em server.js), pra nunca mais acontecer em silêncio.
if (!usandoTurso && process.env.NODE_ENV === 'production') {
  console.error('ERRO: TURSO_DATABASE_URL não configurada em produção — o banco de dados cairia em armazenamento efêmero e todas as contas seriam perdidas a cada deploy. Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN antes de subir o servidor.');
  process.exit(1);
}

if (!usandoTurso && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const client = createClient({
  url: usandoTurso ? process.env.TURSO_DATABASE_URL : `file:${DB_PATH}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helpers que devolvem objetos JS simples (nunca bigint, nunca o tipo
// Row do libsql) — mantém o resto do backend chamando consultas de um
// jeito bem parecido com o de antes (só virou assíncrono). `lastInsertRowid`
// do libsql é bigint; convertido pra Number aqui, uma vez só, pra nunca
// vazar bigint pro resto do código (JSON.stringify quebra com bigint).
export async function dbGet(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] ? { ...result.rows[0] } : undefined;
}

export async function dbAll(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows.map((row) => ({ ...row }));
}

export async function dbRun(sql, args = []) {
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
    changes: result.rowsAffected,
  };
}

await client.execute('PRAGMA foreign_keys = ON');
// WAL só faz sentido/existe no modo arquivo local (SQLite de verdade por
// baixo) — deixa concorrência entre leitura e escrita bem mais tolerante,
// evitando "database is locked" com o `node --watch` reiniciando o
// processo. Turso (remoto) ignora isso sem erro, então é seguro deixar
// incondicional.
try {
  await client.execute('PRAGMA journal_mode = WAL');
} catch (e) {
  // Alguns backends remotos rejeitam esse PRAGMA — inofensivo ignorar.
}

// CREATE TABLE IF NOT EXISTS — roda toda vez que o servidor sobe, sem
// apagar dados existentes. Suficiente pro estágio atual do projeto; se um
// dia o schema precisar mudar de um jeito que não seja "adicionar coluna
// nova", vale trocar por uma ferramenta de migração de verdade.
await client.batch([
  `CREATE TABLE IF NOT EXISTS responsaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS assinaturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id),
    status TEXT NOT NULL DEFAULT 'trial'
      CHECK (status IN ('trial', 'ativa', 'atraso', 'bloqueada')),
    valor_centavos INTEGER NOT NULL DEFAULT 2990,
    vencimento_em TEXT NOT NULL,
    ultimo_pagamento_em TEXT,
    infinitepay_order_nsu TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assinatura_id INTEGER NOT NULL REFERENCES assinaturas(id),
    valor_centavos INTEGER NOT NULL,
    metodo TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    transaction_nsu TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS voz_clonada_licenca (
    responsavel_id INTEGER PRIMARY KEY REFERENCES responsaveis(id),
    ativa INTEGER NOT NULL DEFAULT 0,
    comprado_em TEXT
  )`,
  // Códigos de verificação por e-mail (troca de PIN e recuperação de
  // senha) — ver lib/codeStore.js.
  `CREATE TABLE IF NOT EXISTS codigos_verificacao (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_sent_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_assinaturas_responsavel ON assinaturas(responsavel_id)',
  'CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON pagamentos(assinatura_id)',
], 'write');

// Migração incremental (coluna nova numa tabela que já existia antes da
// Fase 3) — CREATE TABLE IF NOT EXISTS não adiciona colunas em tabelas já
// criadas, então precisa desse passo à parte. Guarda o último "dias
// restantes" pra vencer que já gerou e-mail de lembrete (ver
// lib/reminders.js), pra não mandar o mesmo aviso mais de uma vez no
// mesmo dia mesmo que o cron rode de novo (ex: servidor reiniciou).
const assinaturasCols = (await dbAll('PRAGMA table_info(assinaturas)')).map((c) => c.name);
if (!assinaturasCols.includes('ultimo_lembrete_dias')) {
  await client.execute('ALTER TABLE assinaturas ADD COLUMN ultimo_lembrete_dias INTEGER');
}

// Correção de dados (não schema): contas criadas antes do e-mail passar
// a ser normalizado (minúsculo, sem espaço nas pontas — ver
// lib/responsaveis.js::normalizeEmail) podem ter ficado com e-mail
// "Fulano@Gmail.com" em vez de "fulano@gmail.com". Sem essa correção,
// login/recuperação de senha continuariam falhando pra quem já tinha
// conta, mesmo digitando a senha certa. Roda toda vez que o servidor
// sobe, mas só grava quando realmente muda algo — inofensivo de rodar
// de novo.
const contasDesnormalizadas = await dbAll('SELECT id, email FROM responsaveis');
for (const { id, email } of contasDesnormalizadas) {
  const normalizado = String(email).trim().toLowerCase();
  if (normalizado === email) continue;
  try {
    await client.execute({ sql: 'UPDATE responsaveis SET email = ? WHERE id = ?', args: [normalizado, id] });
  } catch (e) {
    // Só falha se já existir outra conta com o e-mail normalizado (uma
    // colisão rara) — loga e segue, não trava o boot do servidor por isso.
    console.error(`[migração e-mail] não foi possível normalizar o e-mail do responsável ${id}:`, e.message);
  }
}
