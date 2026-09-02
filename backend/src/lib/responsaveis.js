// CRUD da conta do responsável (login). Nunca devolve `senha_hash` pra
// fora deste arquivo por engano — sempre passe pelas funções "publicas"
// (toPublic) antes de mandar algo pro frontend.

import { db } from './db.js';

// E-mail é sempre comparado normalizado (minúsculo, sem espaço nas
// pontas) — SQLite compara TEXT por padrão de forma sensível a
// maiúsculas/minúsculas, então sem isso "Nome@Gmail.com" no cadastro e
// "nome@gmail.com" no login (ex: teclado do celular capitalizando a
// primeira letra sozinho) nunca bateriam, mesmo com a senha certa.
// Normalizando aqui, na camada de acesso ao banco, toda rota que usa
// createResponsavel/findByEmail já fica protegida automaticamente, sem
// precisar lembrar de normalizar em cada rota separadamente.
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function createResponsavel({ nome, email, senhaHash }) {
  const info = db.prepare(`
    INSERT INTO responsaveis (nome, email, senha_hash) VALUES (?, ?, ?)
  `).run(nome, normalizeEmail(email), senhaHash);
  return findById(info.lastInsertRowid);
}

export function findByEmail(email) {
  return db.prepare('SELECT * FROM responsaveis WHERE email = ?').get(normalizeEmail(email));
}

export function findById(id) {
  return db.prepare('SELECT * FROM responsaveis WHERE id = ?').get(id);
}

export function updateSenhaHash(id, senhaHash) {
  db.prepare('UPDATE responsaveis SET senha_hash = ? WHERE id = ?').run(senhaHash, id);
}

// Formato seguro pra devolver ao frontend — nunca inclui senha_hash.
export function toPublic(responsavel) {
  if (!responsavel) return null;
  const { id, nome, email, criado_em } = responsavel;
  return { id, nome, email, criadoEm: criado_em };
}
