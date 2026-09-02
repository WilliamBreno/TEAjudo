// Sessão do responsável via cookie httpOnly ASSINADO (cookie-parser cuida
// da assinatura/verificação com COOKIE_SECRET) — guarda só o id do
// responsável, nada sensível. httpOnly impede acesso via JS no navegador
// (mitiga XSS); `secure` só em produção porque localhost em dev não tem
// HTTPS; `sameSite: 'none'` em produção porque frontend (Vercel) e backend
// (Render) ficam em domínios diferentes — cookie cross-site exige isso,
// e 'none' só funciona junto com `secure: true`.

import { findById } from './responsaveis.js';

export const SESSION_COOKIE_NAME = 'teajudo_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

const isProd = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true,
    signed: true,
    maxAge: SESSION_MAX_AGE_MS,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
}

export function setSessionCookie(res, responsavelId) {
  res.cookie(SESSION_COOKIE_NAME, String(responsavelId), cookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}

// Middleware: exige sessão válida, anexa o responsável (sem senha_hash não
// filtrado ainda — quem usa req.responsavel deve passar por toPublic()
// antes de devolver isso ao frontend) em req.responsavel. Async (Express 5
// encaminha rejeições de middleware async pro tratamento de erro sozinho,
// sem precisar de try/catch aqui).
export async function requireAuth(req, res, next) {
  const id = req.signedCookies?.[SESSION_COOKIE_NAME];
  const responsavel = id ? await findById(Number(id)) : null;
  if (!responsavel) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
  req.responsavel = responsavel;
  next();
}
