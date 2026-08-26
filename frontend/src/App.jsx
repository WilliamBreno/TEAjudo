import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Lock, Unlock, Plus, Trash2, X, Clock, Mic, ImagePlus, ChevronLeft, RotateCcw,
  Puzzle as PuzzleIcon, Sparkles, Mail,
  Hand, User, Smile, CircleDot, MessageCircle, HelpCircle,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';

/* ---------- Backend do TEAjudo ---------- */
// Endereço do servidor (ver pasta ../backend). Configurável via .env
// (VITE_API_URL) — cai em localhost:3001 se não for definido.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/* ---------- Design tokens & dados base ---------- */

// Estilos globais: fonte + keyframes de animação (feitos em CSS puro).
// Observação: bibliotecas como Motion.dev, Magic UI e React Bits são pacotes
// de terceiros (framer-motion/motion, coleções de componentes) que não fazem
// parte do conjunto de bibliotecas disponível neste ambiente de artifact —
// então recriamos os mesmos efeitos (spring pop-in, shimmer, pulso, confete)
// com CSS/keyframes nativos, que funcionam de forma confiável aqui.

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');

  @keyframes teaPopIn {
    0% { opacity: 0; transform: scale(0.85) translateY(6px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes teaFadeInUp {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes teaPulseRing {
    0% { box-shadow: 0 0 0 0 rgba(47,111,98,0.45); }
    70% { box-shadow: 0 0 0 12px rgba(47,111,98,0); }
    100% { box-shadow: 0 0 0 0 rgba(47,111,98,0); }
  }
  @keyframes teaShimmer {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(220%); }
  }
  @keyframes teaConfettiFall {
    0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(220px) rotate(540deg); opacity: 0; }
  }

  /* Efeito de toque do ChildPanel (botões AAC) — pacote separado do
     confete de vitória dos jogos (teaConfettiFall), que fica intacto. */
  @keyframes teaBtnBounce {
    0% { transform: scale(1) rotate(0deg); }
    30% { transform: scale(0.86) rotate(-3deg); }
    55% { transform: scale(1.18) rotate(3deg); }
    80% { transform: scale(0.97) rotate(-1deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes teaIconWiggle {
    0% { transform: rotate(0) scale(1); }
    25% { transform: rotate(-16deg) scale(1.15); }
    50% { transform: rotate(14deg) scale(1.2); }
    75% { transform: rotate(-6deg) scale(1.05); }
    100% { transform: rotate(0) scale(1); }
  }
  @keyframes teaRingBurst {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes teaShineSweep {
    0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translateX(160%) skewX(-20deg); opacity: 0; }
  }
  @keyframes teaConfettiBurst {
    0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
    100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(var(--rot)) scale(0.4); opacity: 0; }
  }
  @keyframes teaStarPop {
    0% { transform: translate(-50%, 0) scale(0.3) rotate(var(--rot, 0deg)); opacity: 0; }
    30% { transform: translate(-50%, -12px) scale(1.25) rotate(0deg); opacity: 1; }
    100% { transform: translate(-50%, -42px) scale(0.85) rotate(var(--rot, 0deg)); opacity: 0; }
  }
  @keyframes teaEqBounce {
    0%, 100% { height: 3px; }
    50% { height: 13px; }
  }

  /* Decoração de repouso, sempre presente nos botões — halo, ícone
     flutuando e fagulhas piscando, enquanto o botão está parado. Cada
     elemento tem uma classe "base" (aparência estática) e uma classe
     extra que só adiciona a animação — assim, com reduceMotion (manual
     ou do SO), os elementos continuam visíveis, só param de se mover. */
  @keyframes teaOrbBreathe {
    0%, 100% { opacity: 0.28; }
    50% { opacity: 0.5; }
  }
  @keyframes teaIconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes teaSparkTwinkle {
    0%, 100% { opacity: 0.15; transform: scale(0.8); }
    50% { opacity: 0.95; transform: scale(1.15); }
  }

  .tea-popin { animation: teaPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .tea-fadein { animation: teaFadeInUp 0.3s ease-out both; }
  .tea-pulse-ring { animation: teaPulseRing 1.1s ease-out infinite; }
  .tea-shimmer-btn { position: relative; overflow: hidden; }
  .tea-shimmer-btn::after {
    content: '';
    position: absolute; top: 0; left: 0; height: 100%; width: 40%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.45), transparent);
    animation: teaShimmer 2.6s ease-in-out infinite;
  }
  .tea-confetti-piece { position: absolute; top: 0; animation: teaConfettiFall 1.4s ease-in forwards; border-radius: 2px; }

  .tea-btn-bounce { animation: teaBtnBounce 0.6s cubic-bezier(.34,1.56,.64,1) both; }
  .tea-icon-wiggle { animation: teaIconWiggle 0.52s ease-in-out both; }
  .tea-ring-burst, .tea-ring-burst-2, .tea-ring-burst-3 {
    position: absolute; inset: 0; border-radius: inherit;
    border-width: 3px; border-style: solid;
    animation: teaRingBurst 0.6s ease-out forwards;
    pointer-events: none;
    z-index: 2;
  }
  .tea-ring-burst-2 { animation-delay: 110ms; }
  .tea-ring-burst-3 { animation-delay: 220ms; border-width: 2px; }
  .tea-shine-sweep {
    position: absolute; top: 0; left: 0; width: 35%; height: 100%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,.9), transparent);
    animation: teaShineSweep 0.6s ease-out forwards;
    pointer-events: none;
    z-index: 2;
  }
  .tea-confetti-burst {
    position: absolute; top: 50%; left: 50%; border-radius: 2px;
    animation: teaConfettiBurst 0.7s ease-out forwards;
    pointer-events: none;
    z-index: 2;
  }
  .tea-star-pop {
    position: absolute; top: 0; font-size: 1.1rem; line-height: 1;
    animation: teaStarPop 0.75s ease-out forwards;
    pointer-events: none;
    z-index: 2;
  }
  .tea-eq-bar { width: 3px; border-radius: 2px; animation: teaEqBounce 0.5s ease-in-out infinite; }

  /* Estilo "tátil": pseudo-classes (:active, :focus-visible) e a transição
     de box-shadow não dá pra fazer em style inline (que carrega a cor por
     botão) — moram numa regra CSS via [data-style="tatil"]. A transição
     redeclara transform (que a classe utilitária Tailwind já anima) junto
     com box-shadow, listados nessa ordem, porque a propriedade shorthand
     "transition" sobrescreve por completo o que já estava — se listasse só
     box-shadow, a transição de escala do toque pararia de funcionar aqui.
     :focus-visible precisa de !important pra vencer o boxShadow inline. */
  button[data-style="tatil"] {
    transition-property: transform, box-shadow;
    transition-duration: 150ms, 160ms;
    transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1), ease;
  }
  button[data-style="tatil"]:active {
    filter: brightness(0.96);
  }
  button[data-style="tatil"]:focus-visible {
    box-shadow:
      0 0 0 3px #FAF7F2,
      0 0 0 6px var(--tea-color),
      7px 7px 16px rgba(0,0,0,0.16) !important;
  }

  /* Estilo "nítido": mesma lógica do tátil acima, mas aqui as duas
     transições usam o mesmo "ease" — não tem o choque de curvas que o
     tátil tem (bounce no transform x ease no box-shadow), então dá pra
     usar a propriedade "transition" (shorthand) direto, sem precisar
     separar em transition-property/duration/timing-function. */
  button[data-style="nitido"] {
    transition: box-shadow 160ms ease, transform 160ms ease;
  }
  button[data-style="nitido"]:hover {
    box-shadow: 0 10px 24px var(--tea-glow) !important;
    transform: translateY(-2px);
  }
  button[data-style="nitido"]:focus-visible {
    box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--tea-color) !important;
  }

  /* Halo/ícone/fagulhas: classe "base" = aparência estática (sempre
     presente); classe "-anim" = só ela adiciona o movimento (só entra
     quando reduceMotion está desligado). */
  .tea-orb-halo {
    position: absolute; inset: -16px; border-radius: inherit;
    filter: blur(20px); opacity: 0.4; pointer-events: none;
    /* sem z-index — fica atrás do badge/label (z-index:1) e do efeito de
       toque (z-index:2), ver camadas no JSX do botão */
  }
  .tea-orb-halo-anim { animation: teaOrbBreathe 3.2s ease-in-out infinite; }
  .tea-icon-float { animation: teaIconFloat 3s ease-in-out infinite; }
  .tea-spark {
    position: absolute; font-size: 0.7rem; line-height: 1; opacity: 0.5;
    pointer-events: none;
  }
  .tea-spark-anim { animation: teaSparkTwinkle 2.4s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .tea-popin, .tea-fadein, .tea-pulse-ring, .tea-shimmer-btn::after, .tea-confetti-piece,
    .tea-btn-bounce, .tea-icon-wiggle, .tea-ring-burst, .tea-ring-burst-2, .tea-ring-burst-3,
    .tea-shine-sweep, .tea-confetti-burst, .tea-star-pop, .tea-eq-bar,
    .tea-orb-halo-anim, .tea-icon-float, .tea-spark-anim {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }
`;

// Cores por categoria gramatical, inspiradas na "Fitzgerald Key" usada em
// pranchas reais de Comunicação Aumentativa e Alternativa (CAA): a cor
// carrega informação (categoria da palavra), não é só decoração.
const CATEGORY_META = {
  acoes: { label: 'Ações', color: '#4C9A6A' },
  pessoas: { label: 'Pessoas', color: '#E4A93B' },
  objetos: { label: 'Comida & Objetos', color: '#E08A3C' },
  sentimentos: { label: 'Sentimentos', color: '#3E7CB1' },
  perguntas: { label: 'Perguntas', color: '#8B6BB1' },
  social: { label: 'Social', color: '#D66E96' },
};

// Ícone de linha (minimalista) por categoria — usado quando o botão foi
// cadastrado com b.iconVariant === 'minimal' (escolha feita no cadastro do
// botão, em ButtonsManager — não é uma preferência global do painel). Só
// entra em jogo pra botões sem foto (b.imageData); foto sempre aparece.
const CATEGORY_ICONS = {
  acoes: Hand,
  pessoas: User,
  objetos: CircleDot,
  sentimentos: Smile,
  perguntas: HelpCircle,
  social: MessageCircle,
};

const DEFAULT_BUTTONS = [
  { id: 'b1', label: 'Quero', phrase: 'Eu quero', category: 'acoes', emoji: '🙋', locked: false },
  { id: 'b2', label: 'Mais', phrase: 'Mais, por favor', category: 'acoes', emoji: '➕', locked: false },
  { id: 'b3', label: 'Ajuda', phrase: 'Preciso de ajuda', category: 'acoes', emoji: '🆘', locked: false },
  { id: 'b4', label: 'Parar', phrase: 'Parar', category: 'acoes', emoji: '✋', locked: false },
  { id: 'b5', label: 'Eu', phrase: 'Eu', category: 'pessoas', emoji: '🙂', locked: false },
  { id: 'b6', label: 'Você', phrase: 'Você', category: 'pessoas', emoji: '🫵', locked: true },
  { id: 'b7', label: 'Comer', phrase: 'Quero comer', category: 'objetos', emoji: '🍽️', locked: false },
  { id: 'b8', label: 'Água', phrase: 'Quero água', category: 'objetos', emoji: '💧', locked: false },
  { id: 'b9', label: 'Banheiro', phrase: 'Preciso ir ao banheiro', category: 'objetos', emoji: '🚻', locked: false },
  { id: 'b10', label: 'Feliz', phrase: 'Eu estou feliz', category: 'sentimentos', emoji: '😊', locked: false },
  { id: 'b11', label: 'Triste', phrase: 'Eu estou triste', category: 'sentimentos', emoji: '😢', locked: true },
  { id: 'b12', label: 'Cansado', phrase: 'Eu estou cansado', category: 'sentimentos', emoji: '😴', locked: true },
  { id: 'b13', label: 'Sim', phrase: 'Sim', category: 'social', emoji: '✅', locked: false },
  { id: 'b14', label: 'Não', phrase: 'Não', category: 'social', emoji: '❌', locked: false },
  { id: 'b15', label: 'Oi', phrase: 'Oi', category: 'social', emoji: '👋', locked: false },
  { id: 'b16', label: 'Onde', phrase: 'Onde está?', category: 'perguntas', emoji: '❓', locked: true },
];

const DEFAULT_SETTINGS = {
  pin: '0000',
  dailyLimitMinutes: null,
  voiceEnabled: false,
  showTimer: false,
  securityConfigured: false,
  parentEmail: '',
  buttonStyle: 'nitido', // 'tatil' | 'nitido' — só o "material" visual do botão
  reduceMotion: false,
};

const BUTTON_STYLE_OPTIONS = [
  { key: 'tatil', label: 'Tátil' },
  { key: 'nitido', label: 'Nítido' },
];

// Posições horizontais/ângulos/atrasos das 3 estrelinhas do efeito de toque.
const STAR_POP_POSITIONS = [
  { left: '32%', rotate: -18, delay: 0 },
  { left: '50%', rotate: 6, delay: 90 },
  { left: '68%', rotate: 20, delay: 170 },
];

const BUILTIN_PUZZLE_SUBJECTS = [
  { key: 'sol', emoji: '☀️', label: 'Sol', bg: '#FFE9B8' },
  { key: 'casa', emoji: '🏠', label: 'Casa', bg: '#D9EAD3' },
  { key: 'gato', emoji: '🐱', label: 'Gato', bg: '#F4D7C7' },
  { key: 'arvore', emoji: '🌳', label: 'Árvore', bg: '#DCEAD1' },
  { key: 'carro', emoji: '🚗', label: 'Carro', bg: '#CFE3F0' },
  { key: 'estrela', emoji: '⭐', label: 'Estrela', bg: '#FBE8B0' },
];

const PUZZLE_LEVELS = [
  { level: 1, grid: 2, label: 'Nível 1', sub: '4 peças' },
  { level: 2, grid: 3, label: 'Nível 2', sub: '9 peças' },
  { level: 3, grid: 4, label: 'Nível 3', sub: '16 peças' },
  { level: 4, grid: 5, label: 'Nível 4', sub: '25 peças' },
];

const MEMORY_LEVELS = [
  { level: 1, pairs: 3, label: 'Nível 1', sub: '3 pares' },
  { level: 2, pairs: 4, label: 'Nível 2', sub: '4 pares' },
  { level: 3, pairs: 6, label: 'Nível 3', sub: '6 pares' },
  { level: 4, pairs: 8, label: 'Nível 4', sub: '8 pares' },
];

/* ---------- Utilitários ---------- */

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Decide se o texto sobre uma cor deve ser branco ou escuro, calculando a
// luminância relativa (fórmula padrão WCAG simplificada). Importante para
// manter contraste legível mesmo com cores personalizadas claras (ex: amarelo).
function getContrastText(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6 ? '#2B2B2B' : '#FFFFFF';
}

// Escurece uma cor hex em `amount` (0-1) — usado para a borda, um tom mais
// forte da mesma cor em vez de uma cor genérica cinza/preta.
function shadeColor(hex, amount) {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Clareia uma cor hex em `amount` (0-1), misturando com branco — usado nos
// gradientes dos estilos de botão "tátil" e "nítido".
function lightenColor(hex, amount) {
  const c = hex.replace('#', '');
  const mix = (channel) => {
    const v = parseInt(c.substring(channel, channel + 2), 16);
    return Math.min(255, Math.round(v + (255 - v) * amount));
  };
  return `#${[mix(0), mix(2), mix(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Detecta a preferência de "reduzir movimento" do sistema operacional, para
// desativar automaticamente o pacote de efeitos de toque mesmo se o toggle
// manual (settings.reduceMotion) estiver desligado.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Gera as posições (fixas, não aleatórias) dos confetes do efeito de toque
// — 14 partículas em círculo completo (360°/14, com um leve jitter
// alternado, igual ao arquivo de referência) a partir do centro do botão.
// Determinístico pra não "pular" se o componente re-renderizar enquanto a
// animação ainda está rodando.
const CONFETTI_COUNT = 14;
function getConfettiPieces(color) {
  const palette = [color, lightenColor(color, 0.35), shadeColor(color, 0.2), '#FFD93D', '#FFFFFF'];
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = i * (360 / CONFETTI_COUNT) + (i % 2 === 0 ? 5 : -7);
    const rad = (angle * Math.PI) / 180;
    const dist = 40 + (i % 4) * 11;
    return {
      tx: Math.cos(rad) * dist,
      ty: Math.sin(rad) * dist,
      rot: angle * 4,
      color: palette[i % palette.length],
      size: 4 + (i % 4) * 2,
      delay: (i % 5) * 22,
    };
  });
}

// Calcula o "material" visual do cartão do botão (fundo, borda, sombra) para
// cada um dos 2 estilos — a cor em si (categoria/Fitzgerald Key) não muda.
function getButtonCardStyle(buttonStyle, color) {
  if (buttonStyle === 'nitido') {
    return {
      borderRadius: '18px',
      backgroundColor: '#fff',
      border: '1px solid #E7E5E4',
      boxShadow: `0 6px 16px ${hexToRgba(color, 0.16)}, 0 1px 2px rgba(0,0,0,0.05)`,
      // Consumidos por [data-style="nitido"]:hover/:focus-visible acima.
      '--tea-color': color,
      '--tea-glow': hexToRgba(color, 0.35),
    };
  }
  // tatil — neumórfico: sombra escura embaixo/direita + luz em cima/esquerda
  // + glow colorido. `--tea-color` é consumido pelas regras
  // `[data-style="tatil"]:active/:focus-visible` em GLOBAL_STYLES (inline
  // style não suporta pseudo-classe).
  return {
    borderRadius: '26px',
    backgroundImage: `linear-gradient(140deg, ${lightenColor(color, 0.22)} 0%, ${color} 55%, ${shadeColor(color, 0.16)} 100%)`,
    border: `3px solid ${shadeColor(color, 0.22)}`,
    boxShadow: `7px 7px 16px rgba(0,0,0,0.16), -6px -6px 14px rgba(255,255,255,0.65), 0 0 22px ${hexToRgba(color, 0.35)}`,
    '--tea-color': color,
  };
}

function makePuzzleImage(subject) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = subject.bg;
  ctx.fillRect(0, 0, 320, 320);
  ctx.font = '210px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(subject.emoji, 160, 175);
  return canvas.toDataURL('image/png');
}

// Versão para imagens/fotos personalizadas: carrega a imagem e desenha em
// modo "cover" (preenche o quadrado 320x320 cortando o excesso), como uma
// foto de perfil. Retorna uma Promise porque carregar a imagem é assíncrono.
function makePuzzleImageFromPhoto(imageData) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(320 / img.width, 320 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (320 - w) / 2, (320 - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

function shuffledArray(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return arr;
  let solved = true;
  while (solved) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    solved = arr.every((v, i) => v === i);
  }
  return arr;
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Calcula "sinais de prontidão" para sugerir a liberação de novos botões.
// IMPORTANTE: isto é uma heurística baseada em padrões de uso (frequência,
// consistência, diversidade e progresso nos jogos) — não é uma avaliação
// clínica nem um diagnóstico. Serve como apoio para a família observar,
// e a decisão final de expandir o vocabulário continua sendo dos pais
// (idealmente em conjunto com fonoaudiólogo/terapeuta ocupacional).
function computeReadiness({ buttons, logs, puzzleResults, memoryResults = [] }) {
  const lockedButtons = buttons.filter((b) => b.locked);
  if (lockedButtons.length === 0) return null;

  const activeButtons = buttons.filter((b) => !b.locked);
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

  const last7 = logs.filter((l) => l.type === 'button' && now - l.ts <= WEEK);
  const usedIds7 = new Set(last7.map((l) => l.buttonId));
  const consistency = activeButtons.length ? usedIds7.size / activeButtons.length : 0;

  const activeDays14 = new Set(
    logs.filter((l) => now - l.ts <= TWO_WEEKS).map((l) => new Date(l.ts).toISOString().slice(0, 10))
  ).size;

  const counts = {};
  last7.forEach((l) => { counts[l.buttonId] = (counts[l.buttonId] || 0) + 1; });
  const totalUses7 = last7.length;
  const top3Share = totalUses7
    ? Object.values(counts).sort((a, b) => b - a).slice(0, 3).reduce((a, c) => a + c, 0) / totalUses7
    : 1;

  const completedPuzzleLevels = new Set(puzzleResults.filter((r) => r.completed).map((r) => r.level));
  const completedMemoryLevels = new Set(memoryResults.filter((r) => r.completed).map((r) => r.level));
  const gamesProgress =
    completedPuzzleLevels.size >= 2 || [...completedPuzzleLevels].some((lvl) => lvl >= 2) ||
    completedMemoryLevels.size >= 2 || [...completedMemoryLevels].some((lvl) => lvl >= 2);

  const signals = [
    { label: `Usou ${Math.round(consistency * 100)}% dos botões ativos nos últimos 7 dias`, met: consistency >= 0.7 },
    { label: `Esteve ativo em ${activeDays14} dos últimos 14 dias`, met: activeDays14 >= 8 },
    { label: 'Comunicação diversificada (não concentrada em poucos botões)', met: totalUses7 >= 10 && top3Share <= 0.6 },
    { label: 'Progrediu em pelo menos 2 níveis nos jogos (quebra-cabeça ou memória)', met: gamesProgress },
  ];

  const metCount = signals.filter((s) => s.met).length;
  return { ready: metCount >= 3, signals, lockedCount: lockedButtons.length };
}

// Persistência via localStorage (fora do Claude.ai, window.storage não existe).
async function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

async function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Erro ao salvar', key, e);
  }
}

function fallbackSpeak(text, onEnd) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    window.speechSynthesis.speak(u);
  } catch (e) {
    if (onEnd) onEnd();
  }
}

function playAudioBase64(base64, onEnd) {
  const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  if (onEnd) { audio.onended = onEnd; audio.onerror = onEnd; }
  audio.play().catch(() => { if (onEnd) onEnd(); });
}

/* ---------- App principal ---------- */

export default function TEAjudoApp() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('panel'); // panel | games | parentGate | securitySetup | parent
  const [buttons, setButtons] = useState(DEFAULT_BUTTONS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState([]);
  const [puzzleResults, setPuzzleResults] = useState([]);
  const [memoryResults, setMemoryResults] = useState([]);
  const [customSubjects, setCustomSubjects] = useState([]);
  const [audioCache, setAudioCache] = useState({});
  const [showBreak, setShowBreak] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [securityMode, setSecurityMode] = useState('first'); // 'first' | 'recover'
  const [securityCancelTarget, setSecurityCancelTarget] = useState('parent');

  useEffect(() => {
    (async () => {
      const [b, s, l, p, m, cs, ac, du] = await Promise.all([
        loadJSON('teajudo:buttons', DEFAULT_BUTTONS),
        loadJSON('teajudo:settings', DEFAULT_SETTINGS),
        loadJSON('teajudo:logs', []),
        loadJSON('teajudo:puzzle-results', []),
        loadJSON('teajudo:memory-results', []),
        loadJSON('teajudo:puzzle-subjects', []),
        loadJSON('teajudo:audio-cache', {}),
        loadJSON('teajudo:daily-usage', { date: todayKey(), seconds: 0 }),
      ]);
      setButtons(b);
      // 'fluido' foi removido — qualquer valor salvo que não seja 'tatil'
      // cai em 'nitido' (fallback seguro pra quem já tinha algo salvo).
      const mergedSettings = { ...DEFAULT_SETTINGS, ...s };
      if (mergedSettings.buttonStyle !== 'tatil') mergedSettings.buttonStyle = 'nitido';
      setSettings(mergedSettings);
      setLogs(l);
      setPuzzleResults(p);
      setMemoryResults(m);
      setCustomSubjects(cs);
      setAudioCache(ac);
      setLoading(false);
      // guarda o uso do dia numa ref simples via storage já carregado
      window.__teajudoDaily = du.date === todayKey() ? du : { date: todayKey(), seconds: 0 };
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      const prev = window.__teajudoDaily || { date: todayKey(), seconds: 0 };
      const next = prev.date === todayKey()
        ? { ...prev, seconds: prev.seconds + 15 }
        : { date: todayKey(), seconds: 15 };
      window.__teajudoDaily = next;
      saveJSON('teajudo:daily-usage', next);
      if (settings.dailyLimitMinutes && next.seconds >= settings.dailyLimitMinutes * 60) {
        setShowBreak(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loading, settings.dailyLimitMinutes]);

  const persistButtons = useCallback((next) => {
    setButtons(next);
    saveJSON('teajudo:buttons', next);
  }, []);

  const persistSettings = useCallback((next) => {
    setSettings(next);
    saveJSON('teajudo:settings', next);
  }, []);

  const addLog = useCallback((entry) => {
    setLogs((prev) => {
      const next = [...prev, { ts: Date.now(), ...entry }].slice(-400);
      saveJSON('teajudo:logs', next);
      return next;
    });
  }, []);

  const addPuzzleResult = useCallback((entry) => {
    setPuzzleResults((prev) => {
      const next = [...prev, entry].slice(-200);
      saveJSON('teajudo:puzzle-results', next);
      return next;
    });
  }, []);

  const addMemoryResult = useCallback((entry) => {
    setMemoryResults((prev) => {
      const next = [...prev, entry].slice(-200);
      saveJSON('teajudo:memory-results', next);
      return next;
    });
  }, []);

  const persistSubjects = useCallback((next) => {
    setCustomSubjects(next);
    saveJSON('teajudo:puzzle-subjects', next);
  }, []);

  const allSubjects = useMemo(
    () => [...BUILTIN_PUZZLE_SUBJECTS, ...customSubjects],
    [customSubjects]
  );

  const readiness = useMemo(
    () => computeReadiness({ buttons, logs, puzzleResults, memoryResults }),
    [buttons, logs, puzzleResults, memoryResults]
  );

  const playPhrase = useCallback(async (button) => {
    addLog({ type: 'button', buttonId: button.id, category: button.category, label: button.label });
    const { voiceEnabled } = settings;

    setPlayingId(button.id);
    const clearPlaying = () => setPlayingId((id) => (id === button.id ? null : id));
    const safetyTimeout = setTimeout(clearPlaying, 6000);
    const finish = () => { clearTimeout(safetyTimeout); clearPlaying(); };

    if (voiceEnabled) {
      const cached = audioCache[button.id];
      if (cached && cached.text === button.phrase) {
        playAudioBase64(cached.audioBase64, finish);
        return;
      }
      try {
        const resp = await fetch(`${API_URL}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: button.phrase }),
        });
        if (!resp.ok) throw new Error('status ' + resp.status);
        const { audioBase64 } = await resp.json();
        playAudioBase64(audioBase64, finish);
        setAudioCache((prev) => {
          const next = { ...prev, [button.id]: { text: button.phrase, audioBase64 } };
          saveJSON('teajudo:audio-cache', next);
          return next;
        });
        setVoiceNotice('');
      } catch (e) {
        setVoiceNotice('Não foi possível usar a voz personalizada agora (verifique se o backend está rodando e configurado). Usando a voz padrão do aparelho.');
        fallbackSpeak(button.phrase, finish);
      }
    } else {
      fallbackSpeak(button.phrase, finish);
    }
  }, [settings, audioCache, addLog]);

  if (loading) {
    return (
      <div style={{ fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
        className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-[#2B2B2B]">
        <style>{GLOBAL_STYLES}</style>
        Carregando o TEAjudo…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
      className="min-h-screen bg-[#FAF7F2] text-[#2B2B2B] pb-16">
      <style>{GLOBAL_STYLES}</style>

      {showBreak && (
        <BreakOverlay pin={settings.pin} onContinue={() => setShowBreak(false)} />
      )}

      {view === 'panel' && (
        <ChildPanel
          buttons={buttons}
          onPlay={playPhrase}
          playingId={playingId}
          voiceNotice={voiceNotice}
          readinessReady={!!readiness?.ready}
          onOpenGames={() => setView('games')}
          onOpenParentGate={() => { setView('parentGate'); setPinInput(''); setPinError(''); }}
          buttonStyle={settings.buttonStyle}
          reduceMotion={settings.reduceMotion}
          onChangeStyle={(patch) => persistSettings({ ...settings, ...patch })}
        />
      )}

      {view === 'games' && (
        <GamesView
          onBack={() => setView('panel')}
          onFinishPuzzle={addPuzzleResult}
          onFinishMemory={addMemoryResult}
          showTimer={settings.showTimer}
          subjects={allSubjects}
        />
      )}

      {view === 'parentGate' && (
        <ParentGate
          pinInput={pinInput}
          setPinInput={setPinInput}
          error={pinError}
          onSubmit={() => {
            if (pinInput === settings.pin) {
              if (!settings.securityConfigured) {
                setSecurityMode('first');
                setSecurityCancelTarget('parent');
                setView('securitySetup');
              } else {
                setView('parent');
              }
            } else {
              setPinError('PIN incorreto. Tente novamente.');
            }
          }}
          onForgotPin={() => {
            setSecurityMode('recover');
            setSecurityCancelTarget('parentGate');
            setView('securitySetup');
          }}
          onCancel={() => setView('panel')}
        />
      )}

      {view === 'securitySetup' && (
        <SecuritySetup
          settings={settings}
          mode={securityMode}
          onComplete={(patch) => {
            persistSettings({ ...settings, ...patch });
            setPinInput('');
            setPinError('');
            setView('parent');
          }}
          onCancel={() => setView(securityCancelTarget)}
        />
      )}

      {view === 'parent' && (
        <ParentArea
          buttons={buttons}
          onSaveButtons={persistButtons}
          settings={settings}
          onSaveSettings={persistSettings}
          logs={logs}
          puzzleResults={puzzleResults}
          memoryResults={memoryResults}
          customSubjects={customSubjects}
          onSaveSubjects={persistSubjects}
          readiness={readiness}
          onRequestPinChange={() => {
            setSecurityMode('change');
            setSecurityCancelTarget('parent');
            setView('securitySetup');
          }}
          onClose={() => setView('panel')}
        />
      )}
    </div>
  );
}

/* ---------- Pausa gentil (sem bloqueio punitivo) ---------- */

function BreakOverlay({ onContinue, pin }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF7F2]/95 backdrop-blur-sm p-6">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-lg p-8 text-center border border-[#EADFCB]">
        <div className="text-5xl mb-4">💙</div>
        <h2 className="text-2xl font-bold mb-2">Hora de uma pausa</h2>
        <p className="text-[#5A5A5A] mb-6">Você já usou bastante o TEAjudo hoje. Que tal descansar um pouco?</p>
        <div className="flex gap-2 justify-center mb-2">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            inputMode="numeric"
            placeholder="PIN dos pais"
            className="border border-[#DDD] rounded-xl px-3 py-2 w-32 text-center"
          />
          <button
            onClick={() => (val === pin ? onContinue() : setErr('PIN incorreto'))}
            className="bg-[#2F6F62] text-white rounded-xl px-4 py-2 font-semibold"
          >
            Liberar
          </button>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
      </div>
    </div>
  );
}

/* ---------- Painel principal (criança) ---------- */

function ChildPanel({
  buttons, onPlay, playingId, voiceNotice, readinessReady, onOpenGames, onOpenParentGate,
  buttonStyle, reduceMotion, onChangeStyle,
}) {
  const [filter, setFilter] = useState('todos');
  const visibleButtons = buttons.filter((b) => !b.locked);
  const filtered = filter === 'todos' ? visibleButtons : visibleButtons.filter((b) => b.category === filter);
  const prefersReducedMotion = usePrefersReducedMotion();
  const effectiveReduceMotion = reduceMotion || prefersReducedMotion;
  // `tea-popin` (entrada) e `tea-btn-bounce` (toque) são duas classes que
  // definem a mesma propriedade CSS `animation` no mesmo botão. Enquanto
  // `tea-popin` continuasse na lista de classes para sempre, remover
  // `tea-btn-bounce` ao fim do toque fazia o navegador reavaliar a cascata
  // e "reiniciar" `teaPopIn` do zero (que começa em opacity:0) — o botão
  // piscava invisível por um instante. Solução: tirar `tea-popin` da lista
  // de classes assim que ela termina de tocar uma única vez, pra nunca mais
  // poder brigar com outra animação depois.
  const [enteredIds, setEnteredIds] = useState(() => new Set());
  const markEntered = useCallback((id) => {
    setEnteredIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-[#2F6F62]">TEAjudo</h1>
        <div className="flex gap-2">
          <button onClick={onOpenGames} className="p-3 rounded-2xl bg-white border border-[#EADFCB] shadow-sm" aria-label="Jogos">
            <PuzzleIcon size={22} />
          </button>
          <button onClick={onOpenParentGate} className="relative p-3 rounded-2xl bg-white border border-[#EADFCB] shadow-sm" aria-label="Área dos pais">
            <Lock size={22} />
            {readinessReady && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E4A93B] opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#E4A93B]" />
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {BUTTON_STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChangeStyle({ buttonStyle: opt.key })}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-300"
            style={buttonStyle === opt.key
              ? { backgroundColor: '#2F6F62', color: '#fff', borderColor: '#2F6F62' }
              : { backgroundColor: '#fff', borderColor: '#DDD', color: '#5A5A5A' }}
          >
            {opt.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-[#5A5A5A] ml-1 cursor-pointer">
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => onChangeStyle({ reduceMotion: e.target.checked })}
          />
          Reduzir animações
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter('todos')}
          className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-300"
          style={filter === 'todos'
            ? { backgroundColor: '#2F6F62', color: '#fff', borderColor: '#2F6F62' }
            : { backgroundColor: '#fff', borderColor: '#DDD', color: '#5A5A5A' }}
        >
          Todos
        </button>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-300"
            style={filter === key
              ? { backgroundColor: meta.color, color: '#fff', borderColor: meta.color }
              : { backgroundColor: '#fff', borderColor: meta.color, color: meta.color }}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {voiceNotice && (
        <p className="text-sm text-[#B15E3E] bg-[#FBEFE7] rounded-xl px-3 py-2 mb-4">{voiceNotice}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {filtered.map((b, i) => {
          const color = b.color || CATEGORY_META[b.category].color;
          const isPlaying = playingId === b.id;
          const showEffects = isPlaying && !effectiveReduceMotion;
          // Decoração em repouso (halo, ícone flutuando, fagulhas) fica
          // sempre presente — só a animação para com reduceMotion (manual
          // ou do SO), sem sumir (ver GLOBAL_STYLES).
          const animateIdle = !effectiveReduceMotion;
          const textColor = buttonStyle === 'nitido' ? '#292524' : getContrastText(color);
          // Flutuar/wiggle do ícone vivem só no badge circular (abaixo), nos
          // dois estilos — nunca no <img>/emoji cru. Durante o toque
          // (showEffects) o wiggle tem prioridade sobre o flutuar contínuo;
          // as duas não tocam ao mesmo tempo no mesmo nó.
          const badgeMotionClass = showEffects ? ' tea-icon-wiggle' : (animateIdle ? ' tea-icon-float' : '');
          const CategoryIcon = CATEGORY_ICONS[b.category];
          const media = b.imageData
            ? <img src={b.imageData} alt={b.label} className="w-7 h-7 object-cover rounded-full" />
            : b.iconVariant === 'minimal'
              ? <CategoryIcon size={21} strokeWidth={2.25} />
              : <span className="text-2xl">{b.emoji}</span>;
          // No tátil o fundo do próprio cartão já É a cor da categoria — a
          // fagulha usa getContrastText (mesma lógica do label) pra não
          // ficar quase invisível sobre um fundo da própria cor. No nítido
          // o cartão é branco e a cor crua já lê bem, então mantém.
          const sparkColor = buttonStyle === 'tatil' ? textColor : color;

          const hasEntered = enteredIds.has(b.id);
          return (
            <button
              key={b.id}
              data-style={buttonStyle}
              onClick={() => onPlay(b)}
              className={`${hasEntered ? '' : 'tea-popin '}relative rounded-3xl flex flex-col items-center justify-center gap-2 py-5 px-2 min-h-28 active:scale-90 transition-transform duration-150 ${showEffects ? 'tea-btn-bounce' : ''}`}
              style={{
                ...getButtonCardStyle(buttonStyle, color),
                animationDelay: `${Math.min(i, 12) * 30}ms`,
              }}
              onAnimationEnd={(e) => {
                if (e.animationName === 'teaPopIn' && e.target === e.currentTarget) markEntered(b.id);
              }}
            >
              <span
                className={`tea-orb-halo${animateIdle ? ' tea-orb-halo-anim' : ''}`}
                style={{ backgroundImage: `radial-gradient(circle, ${color}, transparent 70%)` }}
              />

              {buttonStyle === 'nitido' && (
                <span className="absolute top-0 left-3.5 right-3.5 h-[3px] rounded-[2px] z-[1]" style={{ backgroundColor: color }} />
              )}

              {isPlaying && (
                effectiveReduceMotion ? (
                  <span className="absolute top-1.5 right-1.5 z-[1] flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: textColor }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: textColor }} />
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 z-[1] flex items-end gap-[2px] h-3.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <span
                        key={idx}
                        className="tea-eq-bar"
                        style={{ backgroundColor: textColor, animationDelay: `${idx * 90}ms`, animationDuration: `${420 + idx * 40}ms` }}
                      />
                    ))}
                  </span>
                )
              )}

              <div
                className={`w-[46px] h-[46px] rounded-full flex items-center justify-center relative z-[1]${badgeMotionClass}`}
                style={buttonStyle === 'nitido'
                  ? {
                    backgroundImage: `linear-gradient(140deg, ${lightenColor(color, 0.15)}, ${shadeColor(color, 0.1)})`,
                    color: '#fff',
                    boxShadow: `0 3px 8px ${hexToRgba(color, 0.35)}`,
                  }
                  : { backgroundColor: 'rgba(255,255,255,0.35)', color: textColor }}
              >
                {media}
              </div>
              <span className="relative z-[1] text-sm font-bold text-center px-1" style={{ color: textColor }}>
                {b.label}
              </span>

              <span className={`tea-spark${animateIdle ? ' tea-spark-anim' : ''}`} style={{ top: 8, right: 10, color: sparkColor, animationDelay: `${(i % 5) * 300}ms` }}>✦</span>
              <span className={`tea-spark${animateIdle ? ' tea-spark-anim' : ''}`} style={{ bottom: 8, left: 10, color: sparkColor, animationDelay: `${(i % 5) * 300 + 900}ms` }}>✦</span>

              {showEffects && (
                <>
                  <span className="tea-ring-burst" style={{ borderColor: color }} />
                  <span className="tea-ring-burst-2" style={{ borderColor: color }} />
                  <span className="tea-ring-burst-3" style={{ borderColor: color }} />
                  <span className="tea-shine-sweep" />
                  {getConfettiPieces(color).map((p, idx) => (
                    <span
                      key={idx}
                      className="tea-confetti-burst"
                      style={{
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        '--tx': `${p.tx}px`,
                        '--ty': `${p.ty}px`,
                        '--rot': `${p.rot}deg`,
                        animationDelay: `${p.delay}ms`,
                      }}
                    />
                  ))}
                  {STAR_POP_POSITIONS.map((s, idx) => (
                    <span
                      key={idx}
                      className="tea-star-pop"
                      style={{ left: s.left, '--rot': `${s.rotate}deg`, animationDelay: `${s.delay}ms` }}
                      aria-hidden="true"
                    >
                      ⭐
                    </span>
                  ))}
                </>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-[#999] py-10">Nenhum botão netegoria ainda.</p>
        )}
      </div>
    </div>
  );
}

/* ---------- Jogos: seleção ---------- */

function GamesView({ onBack, onFinishPuzzle, onFinishMemory, showTimer, subjects }) {
  const [gameType, setGameType] = useState(null); // null | 'puzzle' | 'memory'
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);

  if (gameType === 'puzzle' && subject && level) {
    return (
      <PuzzleBoard
        subject={subject}
        level={level}
        showTimer={showTimer}
        onExit={() => { setSubject(null); setLevel(null); }}
        onFinish={onFinishPuzzle}
      />
    );
  }

  if (gameType === 'memory' && level) {
    return (
      <MemoryBoard
        level={level}
        subjects={subjects}
        showTimer={showTimer}
        onExit={() => setLevel(null)}
        onFinish={onFinishMemory}
      />
    );
  }

  if (!gameType) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBack} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><ChevronLeft size={20} /></button>
          <h1 className="text-2xl font-bold text-[#2F6F62]">Jogos</h1>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => setGameType('puzzle')}
            className="tea-popin bg-white border-2 border-[#EADFCB] rounded-3xl p-6 text-center shadow-sm hover:border-[#2F6F62] transition-colors"
          >
            <div className="text-5xl mb-3">🧩</div>
            <div className="font-bold text-lg text-[#2F6F62]">Quebra-cabeça</div>
            <p className="text-sm text-[#999] mt-1">Monte a figura arrastando as peças</p>
          </button>
          <button
            onClick={() => setGameType('memory')}
            className="tea-popin bg-white border-2 border-[#EADFCB] rounded-3xl p-6 text-center shadow-sm hover:border-[#2F6F62] transition-colors"
            style={{ animationDelay: '60ms' }}
          >
            <div className="text-5xl mb-3">🃏</div>
            <div className="font-bold text-lg text-[#2F6F62]">Jogo da memória</div>
            <p className="text-sm text-[#999] mt-1">Memorize e encontre os pares</p>
          </button>
        </div>
      </div>
    );
  }

  if (gameType === 'puzzle') {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setGameType(null)} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><ChevronLeft size={20} /></button>
          <h1 className="text-2xl font-bold text-[#2F6F62]">Quebra-cabeças</h1>
        </div>
        <p className="text-[#5A5A5A] mb-4">Escolha uma figura:</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {subjects.map((s) => (
            <button
              key={s.key}
              onClick={() => setSubject(s)}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border-2 overflow-hidden ${subject?.key === s.key ? 'border-[#2F6F62]' : 'border-[#EADFCB]'}`}
              style={{ backgroundColor: s.bg || '#F3F0EA' }}
            >
              {s.imageData
                ? <img src={s.imageData} alt={s.label} className="w-full h-full object-cover" />
                : <span className="text-3xl">{s.emoji}</span>}
              {!s.imageData && <span className="text-xs font-semibold">{s.label}</span>}
            </button>
          ))}
        </div>
        {subject && (
          <>
            <p className="text-[#5A5A5A] mb-3">Escolha o nível:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PUZZLE_LEVELS.map((l) => (
                <button key={l.level} onClick={() => setLevel(l)} className="rounded-2xl bg-white border border-[#EADFCB] p-4 text-center shadow-sm">
                  <div className="font-bold text-[#2F6F62]">{l.label}</div>
                  <div className="text-sm text-[#999]">{l.sub}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // gameType === 'memory': escolher nível (limitado pela quantidade de assuntos disponíveis)
  return (
    <div className="max-w-3xl mx-auto px-4 pt-6">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setGameType(null)} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><ChevronLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-[#2F6F62]">Jogo da memória</h1>
      </div>
      <p className="text-[#5A5A5A] mb-4">Escolha o nível:</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MEMORY_LEVELS.map((l) => {
          const unlocked = subjects.length >= l.pairs;
          return (
            <button
              key={l.level}
              onClick={() => unlocked && setLevel(l)}
              disabled={!unlocked}
              className={`rounded-2xl border p-4 text-center shadow-sm ${unlocked ? 'bg-white border-[#EADFCB]' : 'bg-[#F3F0EA] border-[#EADFCB] opacity-60 cursor-not-allowed'}`}
            >
              <div className="font-bold text-[#2F6F62]">{l.label}</div>
              <div className="text-sm text-[#999]">{l.sub}</div>
              {!unlocked && <div className="text-[10px] text-[#B15E3E] mt-1">Adicione mais imagens para desbloquear</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Jogos: tabuleiro (troca de peças, sem pressão de tempo) ---------- */

function PuzzleBoard({ subject, level, showTimer, onExit, onFinish }) {
  const grid = level.grid;
  const total = grid * grid;
  const [imgSrc, setImgSrc] = useState(null);
  const [pieces, setPieces] = useState(() => shuffledArray(total));
  const [selected, setSelected] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);
  const boardRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setImgSrc(null);
    const build = subject.imageData
      ? makePuzzleImageFromPhoto(subject.imageData)
      : Promise.resolve(makePuzzleImage(subject));
    build.then((src) => { if (!cancelled) setImgSrc(src); }).catch(() => {});
    setPieces(shuffledArray(total));
    setMoves(0);
    setSeconds(0);
    setDone(false);
    setSelected(null);
    setHoverSlot(null);
    finishedRef.current = false;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.key, level.level]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (!finishedRef.current && pieces.every((v, i) => v === i)) {
      finishedRef.current = true;
      setDone(true);
      onFinish({ ts: Date.now(), level: level.level, pieceCount: total, timeSeconds: seconds, moves, completed: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  function swapPieces(a, b) {
    setPieces((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
    setMoves((m) => m + 1);
  }

  function resetDragVisuals(el) {
    if (!el) return;
    el.style.transform = '';
    el.style.zIndex = '';
    el.style.boxShadow = '';
    el.style.transition = '';
    el.style.pointerEvents = '';
  }

  function slotFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const tile = el && el.closest ? el.closest('[data-slot]') : null;
    if (!tile || !boardRef.current || !boardRef.current.contains(tile)) return null;
    return Number(tile.dataset.slot);
  }

  function handlePointerDown(e, slot) {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { fromSlot: slot, startX: e.clientX, startY: e.clientY, moved: false, el: e.currentTarget };
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 6) {
      d.moved = true;
      d.el.style.transition = 'none';
      d.el.style.zIndex = '50';
      d.el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.28)';
      d.el.style.pointerEvents = 'none'; // deixa o elemento "ver através" de si mesmo para achar o alvo
    }
    if (d.moved) {
      d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
      const hovered = slotFromPoint(e.clientX, e.clientY);
      setHoverSlot(hovered !== null && hovered !== d.fromSlot ? hovered : null);
    }
  }

  function handlePointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setHoverSlot(null);

    if (d.moved) {
      const dropSlot = slotFromPoint(e.clientX, e.clientY);
      resetDragVisuals(d.el);
      setSelected(null);
      if (dropSlot !== null && dropSlot !== d.fromSlot) swapPieces(d.fromSlot, dropSlot);
    } else {
      // sem movimento: funciona como toque (selecionar e depois tocar noutra peça para trocar)
      if (selected === null) setSelected(d.fromSlot);
      else if (selected === d.fromSlot) setSelected(null);
      else { swapPieces(selected, d.fromSlot); setSelected(null); }
    }
  }

  function handlePointerCancel() {
    const d = dragRef.current;
    if (d) resetDragVisuals(d.el);
    dragRef.current = null;
    setHoverSlot(null);
  }

  function reshuffle() {
    setPieces(shuffledArray(total));
    setMoves(0);
    setSeconds(0);
    setDone(false);
    setSelected(null);
    setHoverSlot(null);
    finishedRef.current = false;
  }

  return (
    <div className="relative max-w-md mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><ChevronLeft size={20} /></button>
        <div className="text-sm font-semibold text-[#5A5A5A]">{level.label} · {subject.label}</div>
        <button onClick={reshuffle} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><RotateCcw size={18} /></button>
      </div>
      {done && <ConfettiBurst />}

      <p className="text-center text-xs text-[#999] mb-2">Arraste uma peça sobre outra para trocar — ou toque em duas peças</p>

      {showTimer && (
        <div className="text-center text-sm text-[#999] mb-2">⏱ {seconds}s · {moves} trocas</div>
      )}

      <div
        ref={boardRef}
        className="grid gap-1 rounded-2xl overflow-hidden border-4 border-white shadow-md select-none"
        style={{ gridTemplateColumns: `repeat(${grid}, 1fr)` }}
      >
        {pieces.map((originalIndex, slot) => {
          const row = Math.floor(originalIndex / grid);
          const col = originalIndex % grid;
          const isSelected = selected === slot;
          const isHoverTarget = hoverSlot === slot;
          return (
            <button
              key={slot}
              data-slot={slot}
              onPointerDown={(e) => handlePointerDown(e, slot)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className="aspect-square touch-none select-none cursor-grab active:cursor-grabbing active:scale-95 transition-transform duration-150"
              style={{
                backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
                backgroundSize: `${grid * 100}% ${grid * 100}%`,
                backgroundPosition: grid > 1 ? `${(col / (grid - 1)) * 100}% ${(row / (grid - 1)) * 100}%` : 'center',
                outline: isSelected ? '3px solid #2F6F62' : isHoverTarget ? '3px dashed #E4A93B' : 'none',
                outlineOffset: '-3px',
                scale: isHoverTarget ? '1.05' : '1',
              }}
            />
          );
        })}
      </div>

      {done && (
        <div className="tea-fadein text-center mt-5">
          <div className="text-4xl mb-2">🎉</div>
          <p className="font-bold text-[#2F6F62] mb-3">Muito bem! Quebra-cabeça completo!</p>
          <button onClick={reshuffle} className="bg-[#2F6F62] text-white rounded-xl px-4 py-2 font-semibold">Jogar de novo</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Confete (efeito comemorativo em CSS puro) ---------- */

function ConfettiBurst() {
  const pieces = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      left: Math.random() * 100,
      color: ['#4C9A6A', '#E4A93B', '#E08A3C', '#3E7CB1', '#8B6BB1', '#D66E96'][i % 6],
      delay: Math.random() * 0.3,
      size: 6 + Math.random() * 6,
    }))
  ).current;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="tea-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Jogo da memória: mostra por X segundos, depois vira e acha os pares ---------- */

function MemoryBoard({ level, subjects, showTimer, onExit, onFinish }) {
  const { pairs } = level;
  const previewSeconds = Math.min(14, Math.max(4, Math.round(pairs * 1.8)));

  const [cards, setCards] = useState([]);
  const [revealed, setRevealed] = useState(true); // fase de memorização (tudo virado pra cima)
  const [previewLeft, setPreviewLeft] = useState(previewSeconds);
  const [flipped, setFlipped] = useState([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);

  function buildDeck() {
    const chosen = [...subjects].sort(() => Math.random() - 0.5).slice(0, pairs);
    const deck = [...chosen, ...chosen].map((s, i) => ({ uid: `${level.level}-${i}-${Date.now()}`, subjectKey: s.key, subject: s, matched: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function resetRound() {
    setCards(buildDeck());
    setRevealed(true);
    setPreviewLeft(previewSeconds);
    setFlipped([]);
    setLocked(false);
    setMoves(0);
    setSeconds(0);
    setDone(false);
    finishedRef.current = false;
  }

  useEffect(() => {
    resetRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.level]);

  useEffect(() => {
    if (!revealed) return;
    if (previewLeft <= 0) { setRevealed(false); return; }
    const t = setTimeout(() => setPreviewLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [revealed, previewLeft]);

  useEffect(() => {
    if (revealed || done) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [revealed, done]);

  useEffect(() => {
    if (revealed) return;
    if (cards.length && !finishedRef.current && cards.every((c) => c.matched)) {
      finishedRef.current = true;
      setDone(true);
      onFinish({ ts: Date.now(), level: level.level, pairCount: pairs, timeSeconds: seconds, moves, completed: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, revealed]);

  function handleCardClick(index) {
    if (revealed || locked || done) return;
    if (cards[index].matched || flipped.includes(index) || flipped.length === 2) return;

    const next = [...flipped, index];
    setFlipped(next);

    if (next.length === 2) {
      setLocked(true);
      const [a, b] = next;
      const isMatch = cards[a].subjectKey === cards[b].subjectKey;
      setMoves((m) => m + 1);
      setTimeout(() => {
        if (isMatch) {
          setCards((prev) => prev.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
        }
        setFlipped([]);
        setLocked(false);
      }, isMatch ? 500 : 900);
    }
  }

  const totalCards = pairs * 2;
  const gridCols = totalCards <= 6 ? 3 : 4;

  return (
    <div className="relative max-w-md mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><ChevronLeft size={20} /></button>
        <div className="text-sm font-semibold text-[#5A5A5A]">{level.label} · {level.sub}</div>
        <button onClick={resetRound} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><RotateCcw size={18} /></button>
      </div>
      {done && <ConfettiBurst />}

      {revealed ? (
        <div className="text-center mb-3">
          <p className="text-sm text-[#5A5A5A] mb-1">Memorize onde estão as figuras…</p>
          <div className="w-full h-2 bg-[#EADFCB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E4A93B] transition-all duration-1000 ease-linear"
              style={{ width: `${(previewLeft / previewSeconds) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        showTimer && <div className="text-center text-sm text-[#999] mb-2">⏱ {seconds}s · {moves} tentativas</div>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {cards.map((card, i) => {
          const faceUp = revealed || flipped.includes(i) || card.matched;
          const s = card.subject;
          return (
            <button
              key={card.uid}
              onClick={() => handleCardClick(i)}
              className={`aspect-square rounded-2xl flex items-center justify-center border-2 overflow-hidden transition-transform duration-200 ${card.matched ? 'opacity-60 border-[#4C9A6A]' : 'border-[#EADFCB]'} ${!faceUp ? 'active:scale-95' : ''}`}
              style={{ backgroundColor: faceUp ? (s.bg || '#F3F0EA') : '#2F6F62' }}
            >
              {faceUp
                ? (s.imageData
                    ? <img src={s.imageData} alt={s.label} className="w-full h-full object-cover" />
                    : <span className="text-3xl">{s.emoji}</span>)
                : <span className="text-2xl opacity-70">❓</span>}
            </button>
          );
        })}
      </div>

      {done && (
        <div className="tea-fadein text-center mt-5">
          <div className="text-4xl mb-2">🎉</div>
          <p className="font-bold text-[#2F6F62] mb-3">Muito bem! Você encontrou todos os pares!</p>
          <button onClick={resetRound} className="bg-[#2F6F62] text-white rounded-xl px-4 py-2 font-semibold">Jogar de novo</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Portão dos pais ---------- */

function ParentGate({ pinInput, setPinInput, error, onSubmit, onForgotPin, onCancel }) {
  return (
    <div className="max-w-sm mx-auto px-4 pt-24 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h2 className="text-xl font-bold mb-1">Área dos pais</h2>
      <p className="text-[#5A5A5A] mb-5">Digite o PIN para continuar</p>
      <input
        value={pinInput}
        onChange={(e) => setPinInput(e.target.value)}
        type="password"
        inputMode="numeric"
        className="border border-[#DDD] rounded-xl px-4 py-3 text-center text-xl w-full mb-3"
        placeholder="PIN"
      />
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <div className="flex gap-2 mb-3">
        <button onClick={onCancel} className="flex-1 bg-white border border-[#DDD] rounded-xl py-3 font-semibold">Voltar</button>
        <button onClick={onSubmit} className="flex-1 bg-[#2F6F62] text-white rounded-xl py-3 font-semibold">Entrar</button>
      </div>
      <button onClick={onForgotPin} className="text-sm text-[#5A5A5A] underline">Esqueci o PIN</button>
      <p className="text-xs text-[#AAA] mt-4">Primeiro acesso? Use 0000 e você vai configurar tudo em seguida.</p>
    </div>
  );
}

/* ---------- Configuração de segurança (e-mail -> código -> novo PIN) ---------- */

function SecuritySetup({ settings, mode, onComplete, onCancel }) {
  const [step, setStep] = useState('email'); // email | code | pin
  const [email, setEmail] = useState(settings.parentEmail || '');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [demoCode, setDemoCode] = useState(''); // só preenchido se o backend disser "demo: true"
  const [codeInput, setCodeInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  async function handleSendCode() {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Digite um e-mail válido.');
      return;
    }
    setCodeInput('');
    setDemoCode('');
    setSending(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'status ' + resp.status);
      if (data.demo) setDemoCode(data.code);
      setStep('code');
    } catch (e) {
      setError('Não foi possível pedir o código agora — verifique se o backend está rodando (ver CLAUDE.md).');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyCode() {
    setError('');
    setVerifying(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeInput.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.valid) {
        const messages = {
          expired: 'Código expirado. Peça um novo.',
          too_many_attempts: 'Muitas tentativas erradas. Peça um novo código.',
          not_found: 'Código não encontrado. Peça um novo.',
        };
        setError(messages[data.reason] || 'Código incorreto.');
        return;
      }
      setStep('pin');
    } catch (e) {
      setError('Não foi possível verificar agora — confira se o backend está rodando.');
    } finally {
      setVerifying(false);
    }
  }

  function handleSavePin() {
    setError('');
    if (!/^\d{4}$/.test(newPin)) { setError('O PIN precisa ter exatamente 4 números.'); return; }
    if (newPin !== confirmPin) { setError('Os dois PINs não são iguais.'); return; }
    onComplete({ pin: newPin, parentEmail: email, securityConfigured: true });
  }

  const titles = { first: 'Vamos proteger a área dos pais', recover: 'Recuperar acesso', change: 'Alterar PIN' };
  const cancelLabel = mode === 'first' ? 'Configurar depois' : 'Cancelar';

  return (
    <div className="max-w-sm mx-auto px-4 pt-16 text-center">
      <div className="text-4xl mb-3">🔐</div>
      <h2 className="text-xl font-bold mb-1">{titles[mode] || titles.first}</h2>
      <p className="text-[#5A5A5A] mb-6 text-sm">
        {step === 'email' && 'Informe o e-mail de um responsável para receber um código de verificação.'}
        {step === 'code' && (demoCode ? 'Envio de e-mail não configurado no backend — use o código de teste abaixo.' : `Enviamos um código para ${email}. Não achou? Confira também a caixa de spam/lixo eletrônico.`)}
        {step === 'pin' && 'Código confirmado! Agora escolha o novo PIN de 4 dígitos.'}
      </p>

      {step === 'email' && (
        <>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="email@exemplo.com"
            className="border border-[#DDD] rounded-xl px-4 py-3 text-center w-full mb-3"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleSendCode}
            disabled={sending}
            className="tea-shimmer-btn w-full bg-[#2F6F62] text-white rounded-xl py-3 font-semibold mb-2 disabled:opacity-60 transition-transform active:scale-95"
          >
            {sending ? 'Enviando…' : 'Enviar código'}
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          {demoCode && (
            <div className="tea-popin bg-[#FFF8E8] border border-[#E4A93B] rounded-xl py-3 mb-4">
              <p className="text-xs text-[#999] mb-1">Código de teste (modo demonstração):</p>
              <p className="text-2xl font-bold tracking-[0.3em] text-[#B15E3E]">{demoCode}</p>
            </div>
          )}
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="Código de 6 dígitos"
            className="border border-[#DDD] rounded-xl px-4 py-3 text-center text-xl w-full mb-3 tracking-widest"
            maxLength={6}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleVerifyCode}
            disabled={verifying}
            className="tea-shimmer-btn w-full bg-[#2F6F62] text-white rounded-xl py-3 font-semibold mb-2 disabled:opacity-60 transition-transform active:scale-95"
          >
            {verifying ? 'Verificando…' : 'Verificar código'}
          </button>
          <button onClick={() => setStep('email')} className="text-sm text-[#5A5A5A] underline">Reenviar ou trocar e-mail</button>
        </>
      )}

      {step === 'pin' && (
        <>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            type="password"
            placeholder="Novo PIN (4 dígitos)"
            className="border border-[#DDD] rounded-xl px-4 py-3 text-center text-xl w-full mb-3 tracking-widest"
            maxLength={4}
          />
          <input
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            type="password"
            placeholder="Confirmar novo PIN"
            className="border border-[#DDD] rounded-xl px-4 py-3 text-center text-xl w-full mb-3 tracking-widest"
            maxLength={4}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleSavePin}
            className="tea-shimmer-btn w-full bg-[#2F6F62] text-white rounded-xl py-3 font-semibold transition-transform active:scale-95"
          >
            Salvar novo PIN
          </button>
        </>
      )}

      <button onClick={onCancel} className="mt-4 text-sm text-[#999] underline">{cancelLabel}</button>
    </div>
  );
}

/* ---------- Área dos pais ---------- */

function ParentArea({ buttons, onSaveButtons, settings, onSaveSettings, logs, puzzleResults, memoryResults, customSubjects, onSaveSubjects, readiness, onRequestPinChange, onClose }) {
  const [tab, setTab] = useState('botoes');
  return (
    <div className="max-w-4xl mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#2F6F62]">Área dos pais</h1>
        <button onClick={onClose} className="p-2 rounded-xl bg-white border border-[#EADFCB]"><X size={20} /></button>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['botoes', 'Botões'], ['jogos', 'Jogos'], ['config', 'Configurações'], ['analise', 'Análise']].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${tab === k ? 'bg-[#2F6F62] text-white' : 'bg-white border border-[#DDD] text-[#5A5A5A]'}`}
          >
            {l}
            {k === 'analise' && readiness?.ready && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#E4A93B]" />
            )}
          </button>
        ))}
      </div>
      <div key={tab} className="tea-fadein">
        {tab === 'botoes' && <ButtonsManager buttons={buttons} onSave={onSaveButtons} />}
        {tab === 'jogos' && <GamesManager customSubjects={customSubjects} onSave={onSaveSubjects} />}
        {tab === 'config' && <SettingsPanel settings={settings} onSave={onSaveSettings} onRequestPinChange={onRequestPinChange} />}
        {tab === 'analise' && (
          <Analytics
            logs={logs}
            puzzleResults={puzzleResults}
            memoryResults={memoryResults}
            buttons={buttons}
            readiness={readiness}
            onGoToButtons={() => setTab('botoes')}
          />
        )}
      </div>
    </div>
  );
}

function GamesManager({ customSubjects, onSave }) {
  const [label, setLabel] = useState('');
  const [imageData, setImageData] = useState(null);

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  }

  function addSubject() {
    if (!label.trim() || !imageData) return;
    const newSubject = { key: 'custom-' + Date.now(), label: label.trim(), imageData };
    onSave([...customSubjects, newSubject]);
    setLabel(''); setImageData(null);
  }

  function removeSubject(key) {
    onSave(customSubjects.filter((s) => s.key !== key));
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4 mb-6">
        <h3 className="font-bold mb-1">Novas figuras para os jogos</h3>
        <p className="text-sm text-[#5A5A5A] mb-3">
          As figuras que você adicionar aqui aparecem como opção extra no quebra-cabeça e também
          desbloqueiam mais níveis no jogo da memória (que precisa de figuras suficientes para
          formar os pares).
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da figura (ex: Vovó)" className="border border-[#DDD] rounded-xl px-3 py-2 flex-1 w-full" />
          <label className="inline-flex items-center gap-2 text-sm text-[#5A5A5A] cursor-pointer bg-[#F3F0EA] px-3 py-2 rounded-xl whitespace-nowrap">
            <ImagePlus size={16} /> {imageData ? 'Trocar foto' : 'Escolher foto'}
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>
        </div>
        {imageData && (
          <img src={imageData} alt="preview" className="w-20 h-20 object-cover rounded-2xl mb-3 border-2 border-[#EADFCB]" />
        )}
        <button
          onClick={addSubject}
          disabled={!label.trim() || !imageData}
          className="tea-shimmer-btn bg-[#2F6F62] text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Plus size={16} /> Adicionar figura
        </button>
      </div>

      <h3 className="font-bold mb-3">Figuras personalizadas ({customSubjects.length})</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {customSubjects.map((s) => (
          <div key={s.key} className="bg-white border border-[#EADFCB] rounded-2xl p-3 flex items-center gap-2">
            <img src={s.imageData} alt={s.label} className="w-12 h-12 object-cover rounded-xl" />
            <span className="text-sm font-semibold flex-1">{s.label}</span>
            <button onClick={() => removeSubject(s.key)} className="text-[#C0605A] p-1"><Trash2 size={16} /></button>
          </div>
        ))}
        {customSubjects.length === 0 && (
          <p className="text-sm text-[#999] col-span-full">Nenhuma figura personalizada ainda — os jogos usam só as 6 figuras padrão.</p>
        )}
      </div>
    </div>
  );
}

function ButtonsManager({ buttons, onSave }) {
  const [label, setLabel] = useState('');
  const [phrase, setPhrase] = useState('');
  const [category, setCategory] = useState('acoes');
  const [color, setColor] = useState(CATEGORY_META['acoes'].color);
  const [iconMode, setIconMode] = useState('emoji'); // 'emoji' | 'foto'
  const [emoji, setEmoji] = useState('⭐');
  const [imageData, setImageData] = useState(null);
  const [startLocked, setStartLocked] = useState(false);
  const EMOJI_CHOICES = ['⭐', '🙋', '➕', '🆘', '✋', '🙂', '🫵', '🍽️', '💧', '🚻', '😊', '😢', '😴', '✅', '❌', '👋', '🎵', '📺', '🛏️', '🚗'];

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  }

  function chooseIconMode(newMode) {
    setIconMode(newMode);
    // ao trocar de modo, limpa o que não vai ser usado — reforça que é
    // "ou um, ou outro", nunca dois ao mesmo tempo
    if (newMode !== 'foto') setImageData(null);
  }

  function addButton() {
    if (!label.trim()) return;
    if (iconMode === 'foto' && !imageData) return;
    const newButton = {
      id: 'b' + Date.now(),
      label: label.trim(),
      phrase: phrase.trim() || label.trim(),
      category,
      color,
      emoji: iconMode === 'emoji' ? emoji : null,
      // 'minimal' usa o ícone de linha fixo da categoria (CATEGORY_ICONS),
      // escolhido aqui no cadastro — não é uma preferência global do painel.
      iconVariant: iconMode === 'minimal' ? 'minimal' : 'emoji',
      imageData: iconMode === 'foto' ? imageData : null,
      locked: startLocked,
    };
    onSave([...buttons, newButton]);
    setLabel(''); setPhrase(''); setImageData(null);
  }

  function removeButton(id) {
    onSave(buttons.filter((b) => b.id !== id));
  }

  function toggleLock(id) {
    onSave(buttons.map((b) => (b.id === id ? { ...b, locked: !b.locked } : b)));
  }

  // JSX não aceita `<Obj[key] />` como nome de tag — precisa estar numa
  // variável com nome capitalizado primeiro.
  const MinimalIcon = CATEGORY_ICONS[category];

  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4 mb-6">
        <h3 className="font-bold mb-3">Novo botão</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do botão (ex: Suco)" className="border border-[#DDD] rounded-xl px-3 py-2" />
          <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Frase falada (opcional, ex: Quero suco)" className="border border-[#DDD] rounded-xl px-3 py-2" />
        </div>
        <p className="text-sm text-[#5A5A5A] mb-2">Categoria (define a cor sugerida):</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => { setCategory(key); setColor(meta.color); }}
              className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200"
              style={category === key
                ? { backgroundColor: meta.color, color: '#fff', borderColor: meta.color }
                : { backgroundColor: '#fff', borderColor: meta.color, color: meta.color }}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="tea-color-picker" className="text-sm text-[#5A5A5A]">Cor individual deste botão:</label>
          <input
            id="tea-color-picker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-[#DDD] cursor-pointer p-0.5 bg-white"
          />
          <span className="text-xs text-[#999]">(já vem sugerida pela categoria, mas você pode trocar)</span>
        </div>

        <p className="text-sm text-[#5A5A5A] mb-2">Imagem do botão — escolha um jeito:</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => chooseIconMode('emoji')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${iconMode === 'emoji' ? 'bg-[#2F6F62] text-white border-[#2F6F62]' : 'bg-white border-[#DDD] text-[#5A5A5A]'}`}
          >
            🙂 Emoji
          </button>
          <button
            onClick={() => chooseIconMode('minimal')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 flex items-center justify-center gap-1 ${iconMode === 'minimal' ? 'bg-[#2F6F62] text-white border-[#2F6F62]' : 'bg-white border-[#DDD] text-[#5A5A5A]'}`}
          >
            <MinimalIcon size={16} /> Minimalista
          </button>
          <button
            onClick={() => chooseIconMode('foto')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 flex items-center justify-center gap-1 ${iconMode === 'foto' ? 'bg-[#2F6F62] text-white border-[#2F6F62]' : 'bg-white border-[#DDD] text-[#5A5A5A]'}`}
          >
            <ImagePlus size={16} /> Foto
          </button>
        </div>

        {iconMode === 'emoji' && (
          <div className="tea-fadein flex flex-wrap gap-2 mb-3">
            {EMOJI_CHOICES.map((em) => (
              <button
                key={em}
                onClick={() => setEmoji(em)}
                className={`text-2xl w-10 h-10 rounded-xl border transition-all duration-150 ${emoji === em ? 'border-[#2F6F62] bg-[#EAF3F0]' : 'border-[#EEE]'}`}
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {iconMode === 'minimal' && (
          <div className="tea-fadein flex items-center gap-2 text-sm text-[#5A5A5A] bg-[#F3F0EA] px-3 py-2 rounded-xl mb-3">
            <MinimalIcon size={18} />
            Ícone de linha da categoria "{CATEGORY_META[category].label}" — muda sozinho se você trocar a categoria acima.
          </div>
        )}

        {iconMode === 'foto' && (
          <div className="tea-fadein mb-3">
            <label className="inline-flex items-center gap-2 text-sm text-[#5A5A5A] mb-2 cursor-pointer bg-[#F3F0EA] px-3 py-2 rounded-xl">
              <ImagePlus size={16} /> {imageData ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
            {!imageData && <p className="text-xs text-[#B15E3E]">Escolha uma foto para poder salvar o botão.</p>}
          </div>
        )}

        <div
          className="rounded-2xl p-3 mb-3 inline-flex flex-col items-center gap-1 w-24 tea-popin"
          style={{ backgroundColor: color, border: `3px solid ${shadeColor(color, 0.22)}` }}
        >
          {iconMode === 'foto' && imageData
            ? <img src={imageData} className="w-12 h-12 object-cover rounded-xl border-2 border-white/80" alt="" />
            : iconMode === 'minimal'
              ? <MinimalIcon size={28} color={getContrastText(color)} strokeWidth={2.25} />
              : <span className="text-3xl">{emoji}</span>}
          <span className="text-xs font-bold text-center" style={{ color: getContrastText(color) }}>{label || 'Pré-visualização'}</span>
        </div>

        <label className="flex items-center gap-2 mb-3 text-sm text-[#5A5A5A]">
          <input type="checkbox" checked={startLocked} onChange={(e) => setStartLocked(e.target.checked)} />
          Cadastrar já bloqueado (fica na fila até o app sugerir liberar, ou até você liberar manualmente)
        </label>

        <div>
          <button
            onClick={addButton}
            disabled={iconMode === 'foto' && !imageData}
            className="tea-shimmer-btn bg-[#2F6F62] text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Plus size={16} /> Adicionar botão
          </button>
        </div>
      </div>

      {(() => {
        const active = buttons.filter((b) => !b.locked);
        const locked = buttons.filter((b) => b.locked);
        const renderItem = (b) => {
          const btnColor = b.color || CATEGORY_META[b.category].color;
          const ItemMinimalIcon = CATEGORY_ICONS[b.category];
          return (
            <div key={b.id} className={`flex items-center justify-between bg-white border rounded-xl px-3 py-2 ${b.locked ? 'border-dashed border-[#DDD] opacity-80' : 'border-[#EADFCB]'}`}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: btnColor }} />
                {b.imageData
                  ? <img src={b.imageData} className="w-8 h-8 rounded-lg object-cover" alt="" />
                  : b.iconVariant === 'minimal'
                    ? <ItemMinimalIcon size={18} style={{ color: btnColor }} />
                    : <span className="text-xl">{b.emoji}</span>}
                <div>
                  <div className="font-semibold text-sm">{b.label}</div>
                  <div className="text-xs text-[#999]">{CATEGORY_META[b.category].label}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleLock(b.id)}
                  className="p-1.5 rounded-lg text-[#5A5A5A] hover:bg-[#F3F0EA] transition-colors"
                  aria-label={b.locked ? 'Liberar botão' : 'Bloquear botão'}
                  title={b.locked ? 'Liberar para o painel' : 'Mover para bloqueados'}
                >
                  {b.locked ? <Unlock size={16} /> : <Lock size={16} />}
                </button>
                <button onClick={() => removeButton(b.id)} className="text-[#C0605A] p-1.5" aria-label="Excluir botão"><Trash2 size={16} /></button>
              </div>
            </div>
          );
        };
        return (
          <>
            <h3 className="font-bold mb-3">Ativos no painel ({active.length})</h3>
            <div className="grid sm:grid-cols-2 gap-2 mb-6">
              {active.map(renderItem)}
              {active.length === 0 && <p className="text-sm text-[#999]">Nenhum botão ativo ainda.</p>}
            </div>

            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Lock size={16} className="text-[#999]" /> Bloqueados, aguardando liberação ({locked.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {locked.map(renderItem)}
              {locked.length === 0 && <p className="text-sm text-[#999]">Nenhum botão na fila no momento.</p>}
            </div>
          </>
        );
      })()}
    </div>
  );
}

const VOICE_SAMPLE_PHRASES = [
  'Oi, eu quero brincar.',
  'Eu estou feliz hoje.',
  'Eu quero comer, por favor.',
  'Vamos passear no parque?',
  'Eu gosto muito de você.',
];

function pickRecorderMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function VoiceRecorder({ onCloned }) {
  const [permissionError, setPermissionError] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioBlobRef = useRef(null);
  const timerRef = useRef(null);

  async function startRecording() {
    setError('');
    setSuccess(false);
    setPermissionError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setPermissionError('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }

  function discardRecording() {
    setAudioUrl(null);
    audioBlobRef.current = null;
    setSeconds(0);
    setSuccess(false);
    setError('');
  }

  async function uploadRecording() {
    if (!audioBlobRef.current) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('audio', audioBlobRef.current, 'voz-crianca.webm');
    form.append('name', 'TEAjudo - voz da criança');
    let resp;
    try {
      resp = await fetch(`${API_URL}/api/voice/clone`, { method: 'POST', body: form });
    } catch (networkErr) {
      // Falha de rede de verdade (backend fora do ar, URL errada, CORS) — não veio
      // resposta nenhuma do servidor, então não há mensagem de erro dele pra mostrar.
      setError(`Não foi possível conectar ao backend em ${API_URL} — confira se ele está rodando e acessível.`);
      setUploading(false);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setError(data.error || `O servidor recusou o áudio (status ${resp.status}).`);
      setUploading(false);
      return;
    }
    setSuccess(true);
    onCloned?.();
    setUploading(false);
  }

  return (
    <div className="border-t border-[#EADFCB] pt-4">
      <h4 className="font-semibold text-sm mb-1 flex items-center gap-2"><Mic size={16} /> Gravar uma voz para clonar</h4>
      <p className="text-xs text-[#5A5A5A] mb-2">
        Grave a voz da criança lendo (ou repetindo) algumas frases — ou, se ela ainda está desenvolvendo a fala,
        grave a voz de um adulto de confiança no lugar. Funciona do mesmo jeito.
      </p>
      <div className="bg-[#F3F0EA] rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-[#5A5A5A] mb-1">Frases sugeridas (uma de cada vez, com pausa):</p>
        <ul className="text-xs text-[#5A5A5A] list-disc list-inside space-y-0.5">
          {VOICE_SAMPLE_PHRASES.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>

      {permissionError && <p className="text-sm text-red-500 mb-2">{permissionError}</p>}

      {!audioUrl && (
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm transition-transform active:scale-95 ${recording ? 'bg-[#C0605A] text-white' : 'bg-[#2F6F62] text-white'}`}
        >
          <Mic size={16} />
          {recording ? `Parar (${seconds}s)` : 'Começar a gravar'}
        </button>
      )}

      {audioUrl && (
        <div className="tea-fadein space-y-2">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex flex-wrap gap-2">
            <button onClick={discardRecording} className="bg-white border border-[#DDD] text-[#5A5A5A] rounded-xl px-3 py-2 text-sm font-semibold">
              Regravar
            </button>
            <button
              onClick={uploadRecording}
              disabled={uploading}
              className="tea-shimmer-btn bg-[#2F6F62] text-white rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 transition-transform active:scale-95"
            >
              {uploading ? 'Enviando…' : 'Usar esta gravação'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      {success && <p className="text-sm text-[#4C9A6A] font-semibold mt-2">Voz clonada com sucesso! Já pode ativar "Usar voz clonada" acima.</p>}

      <p className="text-xs text-[#999] mt-3">
        O áudio só é enviado para o serviço de clonagem (ElevenLabs) quando você clicar em "Usar esta gravação" —
        ele não fica salvo em nenhum outro lugar do app.
      </p>
    </div>
  );
}

function SettingsPanel({ settings, onSave, onRequestPinChange }) {
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);

  function update(field, value) {
    setLocal((prev) => ({ ...prev, [field]: value }));
  }
  function save() {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={18} /> Tempo de uso</h3>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={!!local.dailyLimitMinutes} onChange={(e) => update('dailyLimitMinutes', e.target.checked ? 30 : null)} />
          Ativar sugestão de pausa
        </label>
        {local.dailyLimitMinutes != null && (
          <div className="flex items-center gap-2">
            <input type="number" min="5" step="5" value={local.dailyLimitMinutes} onChange={(e) => update('dailyLimitMinutes', Number(e.target.value))} className="border border-[#DDD] rounded-xl px-3 py-2 w-24" />
            <span className="text-sm text-[#5A5A5A]">minutos por dia (aviso gentil — não trava o aplicativo)</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Mic size={18} /> Voz personalizada (clonagem por IA)</h3>
        <label className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={local.voiceEnabled} onChange={(e) => update('voiceEnabled', e.target.checked)} />
          Usar voz clonada em vez da voz padrão do aparelho
        </label>
        <p className="text-xs text-[#999] mb-4">
          Utilize a voz da sua criança ou de um adulto da sua confiança para ser a voz das frases faladas ao apertar os botões.
        </p>
        <VoiceRecorder onCloned={() => update('voiceEnabled', true)} />
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3">Segurança da área dos pais</h3>
        <p className="text-sm text-[#5A5A5A] mb-1">PIN atual: •••• (4 dígitos)</p>
        {local.parentEmail && <p className="text-xs text-[#999] mb-3">E-mail de recuperação: {local.parentEmail}</p>}
        <button
          onClick={onRequestPinChange}
          className="bg-white border border-[#2F6F62] text-[#2F6F62] rounded-xl px-4 py-2 font-semibold text-sm transition-transform active:scale-95"
        >
          Alterar PIN por e-mail
        </button>
        <p className="text-xs text-[#999] mt-2 flex items-start gap-1">
          <Mail size={14} className="mt-0.5 shrink-0" />
          Por segurança, o PIN só pode ser trocado confirmando um código enviado por e-mail.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={local.showTimer} onChange={(e) => update('showTimer', e.target.checked)} />
          Mostrar cronômetro durante o quebra-cabeça
        </label>
      </div>

      <button onClick={save} className="tea-shimmer-btn bg-[#2F6F62] text-white rounded-xl px-5 py-2.5 font-semibold transition-transform active:scale-95">
        {saved ? 'Salvo ✓' : 'Salvar configurações'}
      </button>
    </div>
  );
}

function StatCard({ label, value }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current.getBoundingClientRect();
        setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
      }}
      className="relative overflow-hidden bg-white rounded-2xl border border-[#EADFCB] p-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
      style={{ backgroundImage: `radial-gradient(220px circle at ${pos.x}% ${pos.y}%, rgba(47,111,98,0.12), transparent 70%)` }}
    >
      <div className="text-lg font-bold text-[#2F6F62] truncate">{value}</div>
      <div className="text-xs text-[#999]">{label}</div>
    </div>
  );
}

function ReadinessCard({ readiness, onGoToButtons }) {
  const { ready, signals, lockedCount } = readiness;
  return (
    <div
      className={`rounded-2xl border p-4 ${ready ? 'bg-[#FFF8E8] border-[#E4A93B]' : 'bg-white border-[#EADFCB]'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 p-2 rounded-xl ${ready ? 'bg-[#E4A93B] text-white' : 'bg-[#F3F0EA] text-[#999]'}`}>
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold mb-1">
            {ready ? 'Seu filho pode estar pronto para mais botões' : 'Acompanhando o progresso'}
          </h3>
          <p className="text-sm text-[#5A5A5A] mb-3">
            {ready
              ? `Há ${lockedCount} botão(ões) bloqueado(s) esperando. Os sinais abaixo sugerem que este pode ser um bom momento para liberar mais vocabulário.`
              : `Ainda reunindo dados de uso para avaliar o momento certo de liberar os ${lockedCount} botão(ões) bloqueado(s).`}
          </p>
          <ul className="space-y-1.5 mb-3">
            {signals.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
                  style={s.met ? { backgroundColor: '#4C9A6A', color: '#fff' } : { backgroundColor: '#EEE', color: '#999' }}
                >
                  {s.met ? '✓' : '·'}
                </span>
                <span className={s.met ? 'text-[#2B2B2B]' : 'text-[#999]'}>{s.label}</span>
              </li>
            ))}
          </ul>
          {ready && (
            <button
              onClick={onGoToButtons}
              className="tea-shimmer-btn bg-[#2F6F62] text-white rounded-xl px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
            >
              Ver botões bloqueados
            </button>
          )}
          <p className="text-xs text-[#999] mt-3">
            Isso é um apoio baseado em padrões de uso, não uma avaliação clínica. A decisão de ampliar o vocabulário
            continua sendo sua — o ideal é alinhar com o fonoaudiólogo ou terapeuta ocupacional que acompanha seu filho.
          </p>
        </div>
      </div>
    </div>
  );
}

function Analytics({ logs, puzzleResults, memoryResults = [], buttons, readiness, onGoToButtons }) {
  const days = lastNDays(7);
  const dayLabel = (d) => d.slice(5).split('-').reverse().join('/');

  const usageByDay = days.map((day) => {
    const dayLogs = logs.filter((l) => l.type === 'button' && new Date(l.ts).toISOString().slice(0, 10) === day);
    const uniqueButtons = new Set(dayLogs.map((l) => l.buttonId)).size;
    return { dia: dayLabel(day), cliques: dayLogs.length, vocabulario: uniqueButtons };
  });

  const categoryTotals = {};
  logs.filter((l) => l.type === 'button').forEach((l) => {
    categoryTotals[l.category] = (categoryTotals[l.category] || 0) + 1;
  });
  const categoryData = Object.entries(CATEGORY_META).map(([key, meta]) => ({
    categoria: meta.label,
    uso: categoryTotals[key] || 0,
    fill: meta.color,
  }));

  const puzzleByLevel = PUZZLE_LEVELS.map((l) => {
    const results = puzzleResults.filter((r) => r.level === l.level);
    const avgTime = results.length ? Math.round(results.reduce((a, r) => a + r.timeSeconds, 0) / results.length) : 0;
    return { nivel: l.label, tempoMedio: avgTime, vezes: results.length };
  });

  const memoryByLevel = MEMORY_LEVELS.map((l) => {
    const results = memoryResults.filter((r) => r.level === l.level);
    const avgMoves = results.length ? Math.round(results.reduce((a, r) => a + r.moves, 0) / results.length) : 0;
    return { nivel: l.label, tentativasMedia: avgMoves, vezes: results.length };
  });

  const buttonCounts = {};
  logs.filter((l) => l.type === 'button').forEach((l) => {
    buttonCounts[l.buttonId] = (buttonCounts[l.buttonId] || 0) + 1;
  });
  const topButtonId = Object.entries(buttonCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topButton = buttons.find((b) => b.id === topButtonId);

  const activeDays = new Set(logs.map((l) => new Date(l.ts).toISOString().slice(0, 10))).size;
  const totalPuzzlesCompleted = puzzleResults.filter((r) => r.completed).length;
  const totalMemoryCompleted = memoryResults.filter((r) => r.completed).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Dias ativos" value={activeDays} />
        <StatCard label="Botão mais usado" value={topButton ? `${topButton.emoji || '📷'} ${topButton.label}` : '—'} />
        <StatCard label="Jogos concluídos" value={totalPuzzlesCompleted + totalMemoryCompleted} />
        <StatCard label="Total de toques" value={logs.filter((l) => l.type === 'button').length} />
      </div>

      {readiness && <ReadinessCard readiness={readiness} onGoToButtons={onGoToButtons} />}

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3">Uso dos botões — últimos 7 dias</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={usageByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cliques" name="Toques totais" stroke="#2F6F62" strokeWidth={2} />
            <Line type="monotone" dataKey="vocabulario" name="Botões únicos" stroke="#C97B5E" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3">Uso por categoria</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
            <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="uso" radius={[6, 6, 0, 0]}>
              {categoryData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3">Desempenho nos quebra-cabeças</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={puzzleByLevel}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
            <XAxis dataKey="nivel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="tempoMedio" name="Tempo médio (s)" fill="#3E7CB1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-[#EADFCB] p-4">
        <h3 className="font-bold mb-3">Desempenho no jogo da memória</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={memoryByLevel}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
            <XAxis dataKey="nivel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="tentativasMedia" name="Tentativas em média" fill="#8B6BB1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-[#999]">
        Esses dados são um apoio de acompanhamento para a família — não substituem avaliação de um profissional
        (fonoaudiólogo, terapeuta ocupacional ou psicólogo especializado em TEA).
      </p>
    </div>
  );
}
