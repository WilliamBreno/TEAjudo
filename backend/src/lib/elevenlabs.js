import { getStoredVoiceId } from './voiceConfig.js';

// O voice_id "ativo" pode vir de duas fontes, nessa ordem de prioridade:
// 1. O último voice_id salvo dinamicamente (ex: clonagem da voz da criança
//    feita pela própria interface, em backend/data/voice-config.json)
// 2. ELEVENLABS_VOICE_ID configurado manualmente no .env
function getActiveVoiceId() {
  return getStoredVoiceId() || process.env.ELEVENLABS_VOICE_ID || null;
}

export function isVoiceConfigured() {
  return !!(process.env.ELEVENLABS_API_KEY && getActiveVoiceId());
}

export function isCloningAvailable() {
  return !!process.env.ELEVENLABS_API_KEY;
}

// Retorna { audioBase64 } em caso de sucesso, ou lança erro.
export async function synthesizeSpeech(text) {
  const voiceId = getActiveVoiceId();
  if (!process.env.ELEVENLABS_API_KEY || !voiceId) {
    const err = new Error('ElevenLabs não configurado no servidor (.env ou voz clonada)');
    err.code = 'not_configured';
    throw err;
  }

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    }
  );

  if (!resp.ok) {
    const err = new Error(`ElevenLabs retornou status ${resp.status}`);
    err.code = 'upstream_error';
    throw err;
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  return { audioBase64: buffer.toString('base64') };
}

// Clonagem instantânea de voz (Instant Voice Cloning): recebe um único
// arquivo de áudio (buffer) gravado no navegador e envia pro endpoint
// /v1/voices/add da ElevenLabs. Retorna o novo voice_id.
export async function cloneVoiceFromAudio({ buffer, filename, mimetype, name }) {
  if (!process.env.ELEVENLABS_API_KEY) {
    const err = new Error('ELEVENLABS_API_KEY não configurada no servidor (.env)');
    err.code = 'not_configured';
    throw err;
  }

  const form = new FormData();
  form.append('name', name || 'TEAjudo - voz personalizada');
  form.append('files', new Blob([buffer], { type: mimetype }), filename || 'gravacao.webm');

  const resp = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    body: form,
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`ElevenLabs retornou status ${resp.status} ao clonar a voz. ${detail}`.trim());
    err.code = 'upstream_error';
    throw err;
  }

  const data = await resp.json();
  if (!data.voice_id) {
    const err = new Error('ElevenLabs não retornou um voice_id.');
    err.code = 'upstream_error';
    throw err;
  }
  return { voiceId: data.voice_id };
}
