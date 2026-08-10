import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ttsRouter from './routes/tts.js';
import authRouter from './routes/auth.js';
import voiceRouter from './routes/voice.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tts', ttsRouter);
app.use('/api/auth', authRouter);
app.use('/api/voice', voiceRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`TEAjudo backend rodando em http://localhost:${PORT}`);
  console.log(`Aceitando requisições do frontend em: ${CORS_ORIGIN}`);
});
