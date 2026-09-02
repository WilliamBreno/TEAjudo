// CRUD da conta do responsável (login). Nunca devolve `senha_hash` pra
// fora deste arquivo por engano — sempre passe pelas funções "publicas"
// (toPublic) antes de mandar algo pro frontend.

import { dbGet, dbRun } from './db.js';

// E-mail é sempre comparado normalizado (minúsculo, sem espaço nas
// pontas) — SQLite/libSQL compara TEXT por padrão de forma sensível a
// maiúsculas/minúsculas, então sem isso "Nome@Gmail.com" no cadastro e
// "nome@gmail.com" no login (ex: teclado do celular capitalizando a
// primeira letra sozinho) nunca bateriam, mesmo com a senha certa.
// Normalizando aqui, na camada de acesso ao banco, toda rota que usa
// createResponsavel/findByEmail já fica protegida automaticamente, sem
// precisar lembrar de normalizar em cada rota separadamente.
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export async function createResponsavel({ nome, email, senhaHash }) {
  const info = await dbRun(
    'INSERT INTO responsaveis (nome, email, senha_hash) VALUES (?, ?, ?)',
    [nome, normalizeEmail(email), senhaHash]
  );
  return findById(info.lastInsertRowid);
}

export async function findByEmail(email) {
  return dbGet('SELECT * FROM responsaveis WHERE email = ?', [normalizeEmail(email)]);
}

export async function findById(id) {
  return dbGet('SELECT * FROM responsaveis WHERE id = ?', [id]);
}

export async function updateSenhaHash(id, senhaHash) {
  await dbRun('UPDATE responsaveis SET senha_hash = ? WHERE id = ?', [senhaHash, id]);
}

// Formato seguro pra devolver ao frontend — nunca inclui senha_hash.
export function toPublic(responsavel) {
  if (!responsavel) return null;
  const { id, nome, email, criado_em } = responsavel;
  return { id, nome, email, criadoEm: criado_em };
}
