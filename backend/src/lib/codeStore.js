// Guarda os códigos de verificação em memória (Map), com expiração.
// Simples e suficiente para um app de uso doméstico/familiar. Se um dia
// isso rodar em múltiplas instâncias de servidor (load balancer, serverless
// com cold start, etc.), troque por Redis ou uma tabela no banco — em
// memória só funciona com um único processo de backend de cada vez.

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s entre reenvios pro mesmo e-mail
const MAX_ATTEMPTS = 5;

const store = new Map(); // email -> { code, expiresAt, attempts, lastSentAt }

export function canSend(email) {
  const entry = store.get(email);
  if (!entry) return true;
  return Date.now() - entry.lastSentAt > RESEND_COOLDOWN_MS;
}

export function saveCode(email, code) {
  store.set(email, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });
}

export function verifyCode(email, code) {
  const entry = store.get(email);
  if (!entry) return { valid: false, reason: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    store.delete(email);
    return { valid: false, reason: 'expired' };
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(email);
    return { valid: false, reason: 'too_many_attempts' };
  }
  if (entry.code !== code) {
    return { valid: false, reason: 'mismatch' };
  }
  store.delete(email); // código de uso único
  return { valid: true };
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
