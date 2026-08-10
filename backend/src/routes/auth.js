import { Router } from 'express';
import { canSend, saveCode, verifyCode, generateCode } from '../lib/codeStore.js';
import { sendVerificationCodeEmail, isMailerConfigured } from '../lib/mailer.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/send-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (!canSend(email)) {
    return res.status(429).json({ error: 'Aguarde antes de pedir outro código.' });
  }

  const code = generateCode();
  saveCode(email, code);

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

router.post('/verify-code', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'E-mail e código são obrigatórios.' });
  }
  const result = verifyCode(email, String(code).trim());
  if (!result.valid) {
    return res.status(400).json({ valid: false, reason: result.reason });
  }
  res.json({ valid: true });
});

router.get('/status', (_req, res) => {
  res.json({ mailerConfigured: isMailerConfigured });
});

export default router;
