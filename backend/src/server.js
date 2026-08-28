import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import ttsRouter from './routes/tts.js';
import authRouter from './routes/auth.js';
import voiceRouter from './routes/voice.js';
import subscriptionRouter from './routes/subscription.js';
import './lib/db.js'; // roda as migrações (CREATE TABLE IF NOT EXISTS) no boot
import { checkDueDateReminders } from './lib/reminders.js';
import { refreshAllOverdueStatuses } from './lib/subscription.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// COOKIE_SECRET assina o cookie de sessão do login (Fase 1, lib/session.js)
// — sem ele, dá pra forjar um cookie de sessão válido. Em produção,
// recusa subir sem essa variável configurada (mesmo espírito de "chave
// nunca fica com valor padrão inseguro" já seguido pras outras
// credenciais do projeto); em dev, cai num valor fixo só pra não travar
// quem ainda não mexeu no .env.
if (!process.env.COOKIE_SECRET && process.env.NODE_ENV === 'production') {
  console.error('ERRO: COOKIE_SECRET não configurado em produção. Defina em backend/.env antes de subir o servidor.');
  process.exit(1);
}
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-only-secret-troque-em-producao';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser(COOKIE_SECRET));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tts', ttsRouter);
app.use('/api/auth', authRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/subscription', subscriptionRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`TEAjudo backend rodando em http://localhost:${PORT}`);
  console.log(`Aceitando requisições do frontend em: ${CORS_ORIGIN}`);
});

// Lembretes de vencimento (Fase 3) + transição atraso/bloqueio (Fase 4) —
// roda todo dia às 9h, horário do servidor. Também roda uma vez no boot:
// cobre o caso do processo ter reiniciado perto do horário agendado
// (hospedagens grátis derrubam o processo por inatividade). Ambas as
// funções são seguras de rodar mais de uma vez no mesmo dia (ver
// lib/reminders.js e lib/subscription.js::refreshOverdueStatus).
function runDailyJobs() {
  refreshAllOverdueStatuses();
  checkDueDateReminders().catch((err) => console.error('[cron lembretes de vencimento]', err));
}
cron.schedule('0 9 * * *', runDailyJobs);
runDailyJobs();
