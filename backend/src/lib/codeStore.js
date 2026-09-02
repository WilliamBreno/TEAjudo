// Códigos de verificação (troca de PIN e recuperação de senha) —
// persistidos numa tabela do banco (não mais num Map em memória, ver
// db.js::codigos_verificacao). Um Map em memória some toda vez que o
// processo reinicia (deploy novo, ou o serviço "dormindo" por
// inatividade em hospedagens grátis como o Render) — quem pedisse um
// código pouco antes de um reinício via o pedido virar "e-mail não
// encontrado" na hora de verificar, mesmo digitando certo e dentro do
// prazo de 10 minutos.

import { db } from './db.js';
import { normalizeEmail } from './responsaveis.js';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s entre reenvios pro mesmo e-mail
const MAX_ATTEMPTS = 5;

// Mesma normalização de e-mail usada em responsaveis.js — pedir o código
// como "Nome@Gmail.com" e conferir como "nome@gmail.com" (ou vice-versa)
// não pode fazer o código "sumir" por diferença de maiúscula/minúscula.
export function canSend(email) {
  const entry = db.prepare('SELECT last_sent_at FROM codigos_verificacao WHERE email = ?').get(normalizeEmail(email));
  if (!entry) return true;
  return Date.now() - entry.last_sent_at > RESEND_COOLDOWN_MS;
}

export function saveCode(email, code) {
  db.prepare(`
    INSERT INTO codigos_verificacao (email, code, expires_at, attempts, last_sent_at)
    VALUES (@email, @code, @expiresAt, 0, @now)
    ON CONFLICT(email) DO UPDATE SET
      code = @code, expires_at = @expiresAt, attempts = 0, last_sent_at = @now
  `).run({ email: normalizeEmail(email), code, expiresAt: Date.now() + CODE_TTL_MS, now: Date.now() });
}

export function verifyCode(email, code) {
  const normalized = normalizeEmail(email);
  const entry = db.prepare('SELECT * FROM codigos_verificacao WHERE email = ?').get(normalized);
  if (!entry) return { valid: false, reason: 'not_found' };

  if (Date.now() > entry.expires_at) {
    db.prepare('DELETE FROM codigos_verificacao WHERE email = ?').run(normalized);
    return { valid: false, reason: 'expired' };
  }

  const attempts = entry.attempts + 1;
  if (attempts > MAX_ATTEMPTS) {
    db.prepare('DELETE FROM codigos_verificacao WHERE email = ?').run(normalized);
    return { valid: false, reason: 'too_many_attempts' };
  }

  if (entry.code !== code) {
    db.prepare('UPDATE codigos_verificacao SET attempts = ? WHERE email = ?').run(attempts, normalized);
    return { valid: false, reason: 'mismatch' };
  }

  db.prepare('DELETE FROM codigos_verificacao WHERE email = ?').run(normalized); // uso único
  return { valid: true };
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
