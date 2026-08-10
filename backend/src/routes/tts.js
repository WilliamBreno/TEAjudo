import { Router } from 'express';
import { synthesizeSpeech, isVoiceConfigured } from '../lib/elevenlabs.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ configured: isVoiceConfigured() });
});

router.post('/', async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.length > 500) {
    return res.status(400).json({ error: 'Campo "text" inválido.' });
  }
  try {
    const { audioBase64 } = await synthesizeSpeech(text);
    res.json({ audioBase64 });
  } catch (err) {
    const status = err.code === 'not_configured' ? 503 : 502;
    res.status(status).json({ error: err.message });
  }
});

export default router;
