import { Router } from 'express';
import multer from 'multer';
import { cloneVoiceFromAudio, isCloningAvailable, isVoiceConfigured } from '../lib/elevenlabs.js';
import { saveStoredVoiceId, getStoredVoiceId } from '../lib/voiceConfig.js';

const router = Router();

// Upload em memória (não grava em disco) — o áudio some depois de repassado
// pra ElevenLabs, nada fica salvo no backend além do voice_id resultante.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB é bastante para alguns minutos de áudio
});

router.get('/status', (_req, res) => {
  res.json({
    cloningAvailable: isCloningAvailable(),
    voiceConfigured: isVoiceConfigured(),
    hasCustomVoice: !!getStoredVoiceId(),
  });
});

router.post('/clone', upload.single('audio'), async (req, res) => {
  if (!isCloningAvailable()) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY não configurada no servidor (.env).' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum áudio recebido.' });
  }

  try {
    const { voiceId } = await cloneVoiceFromAudio({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'gravacao.webm',
      mimetype: req.file.mimetype || 'audio/webm',
      name: (req.body && req.body.name) || 'TEAjudo - voz da criança',
    });
    saveStoredVoiceId(voiceId, (req.body && req.body.name) || null);
    res.json({ ok: true, voiceId });
  } catch (err) {
    const status = err.code === 'not_configured' ? 503 : 502;
    res.status(status).json({ error: err.message });
  }
});

export default router;
