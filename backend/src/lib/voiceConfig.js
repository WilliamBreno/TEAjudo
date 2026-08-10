// Guarda o voice_id "ativo" em disco (backend/data/voice-config.json), para
// que a voz clonada via upload (ex: voz da criança) sobreviva a reinícios
// do servidor sem precisar editar o .env manualmente toda vez.
//
// Prioridade de qual voice_id é usado nas chamadas de TTS:
//   1. O que estiver salvo aqui (definido pela última clonagem feita pela UI)
//   2. ELEVENLABS_VOICE_ID do .env (voz configurada manualmente)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'voice-config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getStoredVoiceId() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return data.voiceId || null;
  } catch (e) {
    return null; // arquivo não existe ainda ou está inválido — sem problema
  }
}

export function saveStoredVoiceId(voiceId, label) {
  try {
    ensureDataDir();
    fs.writeFileSync(
      FILE_PATH,
      JSON.stringify({ voiceId, label: label || null, updatedAt: new Date().toISOString() }, null, 2)
    );
    return true;
  } catch (e) {
    console.error('Não foi possível salvar o voice-config.json:', e.message);
    return false;
  }
}
