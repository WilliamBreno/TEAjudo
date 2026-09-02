// Códigos de verificação (troca de PIN e recuperação de senha) —
// persistidos numa tabela do banco, não em memória: sobrevive tanto a
// reinícios do processo (deploy novo, serviço "dormindo" por
// inatividade) quanto — desde a migração pro Turso — ao próprio arquivo
// do banco sumir em hospedagens grátis sem disco persistente.

import { dbGet, dbRun } from './db.js';
import { normalizeEmail } from './responsaveis.js';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s entre reenvios pro mesmo e-mail
const MAX_ATTEMPTS = 5;

// Mesma normalização de e-mail usada em responsaveis.js — pedir o código
// como "Nome@Gmail.com" e conferir como "nome@gmail.com" (ou vice-versa)
// não pode fazer o código "sumir" por diferença de maiúscula/minúscula.
export async function canSend(email) {
  const entry = await dbGet('SELECT last_sent_at FROM codigos_verificacao WHERE email = ?', [normalizeEmail(email)]);
  if (!entry) return true;
  return Date.now() - entry.last_sent_at > RESEND_COOLDOWN_MS;
}

export async function saveCode(email, code) {
  await dbRun(
    `INSERT INTO codigos_verificacao (email, code, expires_at, attempts, last_sent_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code = excluded.code, expires_at = excluded.expires_at, attempts = 0, last_sent_at = excluded.last_sent_at`,
    [normalizeEmail(email), code, Date.now() + CODE_TTL_MS, Date.now()]
  );
}

export async function verifyCode(email, code) {
  const normalized = normalizeEmail(email);
  const entry = await dbGet('SELECT * FROM codigos_verificacao WHERE email = ?', [normalized]);
  if (!entry) return { valid: false, reason: 'not_found' };

  if (Date.now() > entry.expires_at) {
    await dbRun('DELETE FROM codigos_verificacao WHERE email = ?', [normalized]);
    return { valid: false, reason: 'expired' };
  }

  const attempts = entry.attempts + 1;
  if (attempts > MAX_ATTEMPTS) {
    await dbRun('DELETE FROM codigos_verificacao WHERE email = ?', [normalized]);
    return { valid: false, reason: 'too_many_attempts' };
  }

  if (entry.code !== code) {
    await dbRun('UPDATE codigos_verificacao SET attempts = ? WHERE email = ?', [attempts, normalized]);
    return { valid: false, reason: 'mismatch' };
  }

  await dbRun('DELETE FROM codigos_verificacao WHERE email = ?', [normalized]); // uso único
  return { valid: true };
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
