import { Router } from 'express';
import bcrypt from 'bcrypt';
import { canSend, saveCode, verifyCode, generateCode } from '../lib/codeStore.js';
import { sendVerificationCodeEmail, isMailerConfigured } from '../lib/mailer.js';
import { createResponsavel, findByEmail, updateSenhaHash, toPublic } from '../lib/responsaveis.js';
import { createTrialSubscription } from '../lib/subscription.js';
import { setSessionCookie, clearSessionCookie, requireAuth } from '../lib/session.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MIN_LEN = 8;
const BCRYPT_ROUNDS = 10;

router.post('/send-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (!(await canSend(email))) {
    return res.status(429).json({ error: 'Aguarde antes de pedir outro código.' });
  }

  const code = generateCode();
  await saveCode(email, code);

  const result = await sendVerificationCodeEmail(email, code);

  if (result.sent) {
    return res.json({ ok: true, demo: false });
  }

  // SendGrid não configurado (ou falhou o envio): não deixamos o usuário
  // travado. Devolvemos o código no corpo da resposta, claramente marcado
  // como "demo" — isso só deve acontecer em desenvolvimento local. Em
  // produção, configure SENDGRID_API_KEY/SENDGRID_FROM no .env para nunca
  // cair aqui.
  console.warn(`[demo mode] Código para ${email}: ${code} (SendGrid não configurado ou falhou)`);
  return res.json({ ok: true, demo: true, code, reason: result.reason });
});

router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'E-mail e código são obrigatórios.' });
  }
  const result = await verifyCode(email, String(code).trim());
  if (!result.valid) {
    return res.status(400).json({ valid: false, reason: result.reason });
  }
  res.json({ valid: true });
});

router.get('/status', (_req, res) => {
  res.json({ mailerConfigured: isMailerConfigured });
});

// ---------- Login do responsável (Fase 1) ----------
// Sessão via cookie httpOnly assinado (ver lib/session.js) — o frontend
// nunca lê nem guarda token nenhum, só manda `credentials: 'include'` nas
// chamadas de fetch.

router.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (!senha || senha.length < SENHA_MIN_LEN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN_LEN} caracteres.` });
  }
  if (await findByEmail(email)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  }
  const senhaHash = await bcrypt.hash(senha, BCRYPT_ROUNDS);
  const responsavel = await createResponsavel({ nome: nome.trim(), email, senhaHash });
  // Toda conta nova começa com um período de teste — ver TRIAL_DAYS em
  // lib/subscription.js.
  await createTrialSubscription(responsavel.id);
  setSessionCookie(res, responsavel.id);
  res.json({ ok: true, responsavel: toPublic(responsavel) });
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }
  const responsavel = await findByEmail(email);
  // Mensagem genérica pros dois casos (e-mail não cadastrado / senha
  // errada) — não dá pista de qual dos dois está errado.
  const negar = () => res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  if (!responsavel) return negar();
  const senhaOk = await bcrypt.compare(senha, responsavel.senha_hash);
  if (!senhaOk) return negar();
  setSessionCookie(res, responsavel.id);
  res.json({ ok: true, responsavel: toPublic(responsavel) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ responsavel: toPublic(req.responsavel) });
});

// Recuperação de senha — mesmo padrão de segurança já usado pra troca de
// PIN: código de 6 dígitos gerado/guardado/conferido só aqui no backend
// (codeStore.js), nunca no navegador. Reaproveita /send-code (que já é
// genérico, não é exclusivo do PIN) pra mandar o código por e-mail; esta
// rota confere o código E já troca a senha na mesma chamada — o código é
// de uso único, então se a verificação acontecesse numa chamada separada
// antes desta, ele já teria sido consumido e essa segunda checagem
// falharia.
router.post('/reset-password', async (req, res) => {
  const { email, code, novaSenha } = req.body || {};
  if (!email || !code || !novaSenha) {
    return res.status(400).json({ error: 'E-mail, código e nova senha são obrigatórios.' });
  }
  if (novaSenha.length < SENHA_MIN_LEN) {
    return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN_LEN} caracteres.` });
  }
  // Confere se a conta existe ANTES de consumir o código — verifyCode()
  // é de uso único (apaga a linha ao confirmar), então checar depois
  // jogaria fora um código certo sempre que o e-mail não tivesse conta
  // (fica igual a "código errado" pra sempre, mesmo digitando certo — a
  // pessoa nunca teria como saber que o problema real era não ter conta
  // com esse e-mail). Mesma mensagem genérica 'not_found' nos dois casos
  // (sem conta / código errado), então não vaza se o e-mail existe.
  const responsavel = await findByEmail(email);
  if (!responsavel) {
    return res.status(404).json({ ok: false, reason: 'not_found' });
  }
  const result = await verifyCode(email, String(code).trim());
  if (!result.valid) {
    return res.status(400).json({ ok: false, reason: result.reason });
  }
  const senhaHash = await bcrypt.hash(novaSenha, BCRYPT_ROUNDS);
  await updateSenhaHash(responsavel.id, senhaHash);
  res.json({ ok: true });
});

export default router;
