# TEAjudo — contexto do projeto

## O que é
TEAjudo é um sistema de Comunicação Aumentativa e Alternativa (CAA) para
crianças autistas: painel de botões falantes, jogos de quebra-cabeça, área
administrativa para os pais (PIN + verificação por e-mail, cadastro de
botões, tempo de uso) e uma área de análise com sugestão inteligente de
liberação de vocabulário.

## ✅ Estado atual do projeto
Repositório com **duas partes separadas**, cada uma com seu próprio
`package.json`:

```
TEAjudo/
├── frontend/   → app React (Vite + Tailwind v4), tudo em src/App.jsx
└── backend/    → servidor Node/Express, protege as chaves de API
```

O app já rodou de ponta a ponta neste ambiente antes da entrega: build do
frontend (`npm run build`) passando limpo, e o fluxo completo do backend
(enviar código → verificar → PIN novo, incluindo bloqueio de reuso de
código) testado via curl.

## Por que existe um backend
Duas coisas exigem credencial secreta que não pode ficar no navegador:

1. **Voz clonada (ElevenLabs)** — antes a chave da API ficava em
   `localStorage` no navegador (via Configurações). Agora fica só em
   `backend/.env`; o frontend chama `POST /api/tts` e o backend faz a
   chamada ao ElevenLabs.
2. **Verificação de e-mail para troca de PIN** — antes o código de 6
   dígitos era gerado e comparado inteiramente no navegador (e o envio, se
   configurado, usava a Public Key do EmailJS exposta no cliente). Agora o
   backend gera o código, guarda em memória com expiração, envia via API
   HTTP da SendGrid e é o único lugar que confere se o código bate. O
   frontend nunca vê nem gera o código de verdade. (Antes usava SMTP via
   `nodemailer`, mas hospedagens grátis como o Render costumam bloquear a
   saída nas portas de SMTP — a requisição travava minutos até dar timeout.
   HTTP na porta 443 não tem esse problema.)

Sem o backend rodando, o resto do app continua funcionando normalmente —
só esses dois recursos caem em fallback (voz padrão do aparelho / aviso
para checar se o backend está no ar).

## Stack

**Frontend** (`frontend/`)
- React 19 (function components + hooks, sem classes)
- Vite 8
- Tailwind CSS v4 (`@import "tailwindcss";` em `src/index.css`, plugin do
  Vite em `vite.config.js` — sem `tailwind.config.js` separado)
- `lucide-react` — ícones · `recharts` — gráficos da aba Análise
- Fonte "Atkinson Hyperlegible" (Google Fonts, via `<style>` no próprio
  `App.jsx`) — escolhida por legibilidade/acessibilidade

**Backend** (`backend/`)
- Node 22 + Express 5, ESM (`"type": "module"`)
- Envio de e-mail via API HTTP da SendGrid (`fetch` nativo, sem SDK)
- `dotenv` — variáveis de ambiente · `cors` — libera o frontend
- `fetch` nativo do Node (sem `node-fetch`) para chamar o ElevenLabs

## Como rodar localmente
Dois terminais:

```bash
# Terminal 1
cd backend && npm install && cp .env.example .env && npm run dev

# Terminal 2
cd frontend && npm install && cp .env.example .env && npm run dev
```

Build de produção do frontend: `cd frontend && npm run build` (gera `dist/`).
Rodar o backend em produção: `cd backend && npm start`.

## Persistência (localStorage) — no frontend
Todo o app passa pelas funções `loadJSON(key, fallback)` e
`saveJSON(key, value)` (em `frontend/src/App.jsx`), implementadas com
`localStorage`. Se um dia trocar por backend real com banco de dados (para
sincronizar entre o tablet da criança e o celular dos pais), só a
implementação interna dessas duas funções muda — o resto do código não é
afetado:

```js
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
```

## Estrutura de dados (chaves do localStorage, no frontend)
- `teajudo:buttons` — array de botões: `{id, label, phrase, category, color,
  emoji, iconVariant, imageData, locked}` — `emoji`/`iconVariant` e
  `imageData` são mutuamente exclusivos (o formulário força escolher um ou
  outro; a UI dá preferência a `imageData` quando os dois existem por algum
  motivo). `iconVariant` é `'emoji'` (padrão, usa o campo `emoji`) ou
  `'minimal'` (ignora `emoji` e mostra o ícone de linha fixo da categoria,
  de `CATEGORY_ICONS` — escolhido no cadastro do botão, não é uma
  preferência global do painel)
- `teajudo:settings` — `{pin, dailyLimitMinutes, voiceEnabled, showTimer,
  securityConfigured, parentEmail}` — **não guarda mais chaves de API**
  (ElevenLabs e SendGrid/EmailJS foram para `backend/.env`)
- `teajudo:logs` — últimos 400 eventos de uso: `{ts, type, buttonId,
  category, label}`
- `teajudo:puzzle-results` — últimos 200 resultados de quebra-cabeça:
  `{ts, level, pieceCount, timeSeconds, moves, completed}`
- `teajudo:memory-results` — últimos 200 resultados do jogo da memória:
  `{ts, level, pairCount, timeSeconds, moves, completed}`
- `teajudo:puzzle-subjects` — figuras personalizadas (fotos) adicionadas
  pelos pais: `{key, label, imageData}`. Somadas às 6 figuras embutidas
  (`BUILTIN_PUZZLE_SUBJECTS`, desenhadas em canvas a partir de um emoji) via
  `allSubjects` — usadas tanto no quebra-cabeça quanto no jogo da memória
- `teajudo:audio-cache` — cache de áudio da voz clonada:
  `{[buttonId]: {text, audioBase64}}` (sem `voiceId` — a voz agora é uma
  configuração única do servidor, não por requisição)
- `teajudo:daily-usage` — `{date, seconds}` para o limite de tempo de uso

## API do backend
Todas as rotas sob `/api`. CORS liberado só para `CORS_ORIGIN` (padrão
`http://localhost:5173`).

| Rota | Método | Body | Resposta |
|---|---|---|---|
| `/api/health` | GET | — | `{ ok: true }` |
| `/api/tts` | POST | `{ text }` | `{ audioBase64 }` |
| `/api/tts/status` | GET | — | `{ configured: boolean }` |
| `/api/auth/send-code` | POST | `{ email }` | `{ ok, demo, code? }` — `code` só vem preenchido se `demo: true` (SendGrid não configurado) |
| `/api/auth/verify-code` | POST | `{ email, code }` | `{ valid: boolean, reason? }` |
| `/api/auth/status` | GET | — | `{ mailerConfigured: boolean }` |
| `/api/voice/clone` | POST | multipart: `audio` (arquivo), `name` (opcional) | `{ ok, voiceId }` |
| `/api/voice/status` | GET | — | `{ cloningAvailable, voiceConfigured, hasCustomVoice }` |

Códigos de verificação: gerados em `backend/src/lib/codeStore.js`, guardados
**em memória** (não em banco), com expiração de 10 min, cooldown de 30s
entre reenvios pro mesmo e-mail, máximo de 5 tentativas erradas, e uso
único (some do Map assim que verificado com sucesso). Isso é suficiente
para um app de uso doméstico rodando num único processo — se um dia rodar
em múltiplas instâncias/serverless, trocar por Redis ou uma tabela no
banco (a lógica toda está isolada nesse arquivo).

## Clonagem de voz (voz da criança ou de um adulto de confiança)
`frontend`: componente `VoiceRecorder` (dentro de `SettingsPanel`) grava
áudio com a `MediaRecorder` API do navegador (sem biblioteca externa),
mostra frases sugeridas para ler, permite ouvir antes de enviar, e sobe o
áudio via `multipart/form-data` para `POST /api/voice/clone`.

`backend`: `routes/voice.js` recebe o arquivo com `multer`
(`storage: memoryStorage` — nunca grava o áudio em disco), repassa para o
endpoint `POST https://api.elevenlabs.io/v1/voices/add` da ElevenLabs
(Instant Voice Cloning) via `lib/elevenlabs.js::cloneVoiceFromAudio`, e
salva o `voice_id` retornado em `backend/data/voice-config.json` através de
`lib/voiceConfig.js` — esse arquivo é gitignored e sobrevive a reinícios do
servidor sem precisar editar o `.env` manualmente. `getActiveVoiceId()`
sempre prioriza esse voice_id dinâmico sobre o `ELEVENLABS_VOICE_ID` do
`.env`, então clonar uma voz nova pela interface substitui a anterior
automaticamente nas próximas chamadas de `/api/tts`.

Nota de privacidade a repassar para a família: o áudio gravado é enviado
para um serviço de terceiros (ElevenLabs) para processamento — é dado
biométrico de voz de uma criança. Vale a pena os pais lerem a política de
privacidade da ElevenLabs antes de usar esse recurso, mesmo sendo uma
funcionalidade legítima de acessibilidade (equivalente a "voice banking",
já usado clinicamente em outros contextos de AAC).

## Decisões de design (não reverter sem motivo forte)
Vêm de práticas reais de CAA/TEA — documentando o "porquê":

- **Cores por categoria gramatical** (ações=verde, pessoas=amarelo,
  objetos=laranja, sentimentos=azul, perguntas=roxo, social=rosa), inspirado
  na "Fitzgerald Key" usada em pranchas de CAA reais. Cada botão também
  aceita cor individual customizada — a cor da categoria é só a sugestão
  inicial. As cores são **sólidas/vívidas** (não pastel) — o fundo do botão
  é a própria cor, com contraste de texto calculado automaticamente
  (`getContrastText`) para continuar legível mesmo em cores claras.
- **Ícone OU foto, nunca os dois ao mesmo tempo** — o formulário de novo
  botão tem um alternador explícito ("Usar ícone" / "Usar foto"); trocar de
  modo limpa a escolha anterior. Reforça previsibilidade: o botão sempre
  tem uma única imagem clara, não uma mistura confusa.
- **Sem animação contínua/ambiente no painel da criança, com uma exceção
  deliberada** — de resto, só anima em resposta a uma ação real (tocar
  botão, completar quebra-cabeça); movimento constante pode
  sobre-estimular sensorialmente. A exceção são os próprios botões AAC em
  `ChildPanel`: um halo pulsando (opacidade, sem girar), o ícone
  flutuando bem sutil e duas fagulhas piscando em cada botão, sempre
  ativos — decisão explícita do usuário, pra bater com um design de
  referência específico, revertendo uma versão anterior que deixava isso
  atrás de um toggle opcional em Configurações. Continua respeitando
  `reduceMotion` (manual e `prefers-reduced-motion` do SO): com ele
  ligado, os elementos ficam visíveis mas param de se mover.
- **Limite de tempo é sugestão gentil, nunca bloqueio duro** — o app também
  pode ser usado para autorregulação; corte abrupto pode prejudicar mais do
  que ajudar.
- **Liberação gradual de vocabulário** — botões podem nascer "bloqueados"
  (fora do painel) até os pais liberarem, manualmente ou seguindo a
  sugestão do sistema.
- **`computeReadiness` é heurística de uso, não diagnóstico.** Nunca
  apresentar como avaliação clínica — é baseada em consistência de uso,
  diversidade de botões, dias ativos e progresso nos jogos (quebra-cabeça
  OU jogo da memória).
- **Jogo da memória não pressiona com tempo visível por padrão** — mesma
  filosofia do quebra-cabeça (`showTimer` fica desligado por padrão). A
  fase de memorização usa uma barra de progresso calma, não uma contagem
  regressiva alarmante.
- **Motion.dev / Magic UI / React Bits não estavam disponíveis** no
  ambiente de artifact original — os efeitos (`tea-popin`, `tea-fadein`,
  `tea-pulse-ring`, `tea-shimmer-btn`, confete) foram recriados em CSS puro
  dentro de `GLOBAL_STYLES`. Fora do Claude.ai dá pra trocar por essas
  bibliotecas de verdade (`npm install motion`) se preferir.
- **Arraste do quebra-cabeça usa Pointer Events**, não a Drag and Drop API
  nativa do HTML5 (que tem suporte ruim em touch). Mantém também o modo
  toque-toque como alternativa motora.
- **Troca de PIN exige confirmação por e-mail, verificada no backend** —
  não existe input de texto livre editando o PIN direto, e o código de
  verificação nunca é gerado nem validado no navegador (só o backend sabe
  o código certo). Vale tanto para o primeiro acesso (PIN padrão `0000`)
  quanto para "Esqueci o PIN" e troca voluntária. A configuração no
  primeiro acesso é **pulável** ("Configurar depois") — mesma filosofia de
  "sugestão gentil, não bloqueio duro" do limite de tempo.
- **Chaves de API nunca ficam no frontend** — ElevenLabs e SendGrid são
  configurados só em `backend/.env`. Isso foi uma migração deliberada: a
  primeira versão do app guardava essas chaves em `localStorage` (aceitável
  só para protótipo rápido), e essa versão corrige isso.
- **Gravação de voz oferece alternativa ao adulto** — o `VoiceRecorder`
  sugere explicitamente gravar a voz de um adulto de confiança caso a
  criança ainda não produza fala suficiente para a clonagem funcionar bem.
  Nunca trate a gravação da própria criança como obrigatória.

## Funcionalidades × componentes (frontend)
| Funcionalidade | Onde está |
|---|---|
| Painel principal (botões falantes, cores vívidas) | `ChildPanel`, `getContrastText`, `shadeColor` |
| Reprodução de áudio (chama `/api/tts` + fallback local) | `playPhrase` (em `TEAjudoApp`), `playAudioBase64`, `fallbackSpeak` |
| Escolha de jogo (quebra-cabeça ou memória) | `GamesView` |
| Quebra-cabeça com arraste | `PuzzleBoard` |
| Jogo da memória (mostra e depois vira para achar os pares) | `MemoryBoard` |
| Confete ao concluir | `ConfettiBurst` |
| Portão da área dos pais (PIN) | `ParentGate` |
| Configuração de segurança (e-mail → código → novo PIN, via backend) | `SecuritySetup` |
| Cadastro de botões (ícone OU foto, cor individual, bloqueio/liberação) | `ButtonsManager` |
| Figuras personalizadas para os jogos | `GamesManager` |
| Configurações (tempo, voz, PIN) | `SettingsPanel` |
| Gravação de voz para clonagem (MediaRecorder) | `VoiceRecorder` |
| Gráficos de desempenho (botões, quebra-cabeça, memória) | `Analytics` |
| Sugestão inteligente de liberação | `computeReadiness`, `ReadinessCard` |

## Segurança da área dos pais — fluxo no frontend
Estado `view` em `TEAjudoApp`: `parentGate` → `securitySetup` → `parent`.
`securityMode` (`'first' | 'recover' | 'change'`) e `securityCancelTarget`
decidem o texto e para onde volta o botão cancelar.

- **Primeiro acesso**: PIN padrão `0000` funciona no `ParentGate`. Se
  `settings.securityConfigured` for `false`, o app força a passagem por
  `SecuritySetup` (mode `'first'`, pulável via "Configurar depois").
- **Esqueci o PIN**: link no `ParentGate` → `SecuritySetup` (mode
  `'recover'`) sem precisar do PIN atual.
- **Troca voluntária**: botão "Alterar PIN por e-mail" em `SettingsPanel` →
  `SecuritySetup` (mode `'change'`).

`SecuritySetup` tem 3 passos (`step`): `email` → `code` → `pin`.
`handleSendCode` chama `POST /api/auth/send-code`; se a resposta vier com
`demo: true` (SendGrid não configurado no backend), mostra o código na tela.
`handleVerifyCode` chama `POST /api/auth/verify-code` — a validação real
acontece no backend, o frontend só repassa o que a pessoa digitou.

## Pendências conhecidas
- [ ] Migrar de `localStorage` para banco de dados real (Postgres/SQLite +
      Prisma, por exemplo) se precisar sincronizar entre o tablet da
      criança e o celular dos pais
- [ ] Trocar o armazenamento em memória dos códigos de verificação
      (`codeStore.js`) por algo persistente se o backend rodar em múltiplas
      instâncias
- [ ] Quebrar `frontend/src/App.jsx` em múltiplos arquivos/componentes
- [ ] Editar botões existentes (hoje só dá para adicionar/remover/bloquear)
- [ ] Editar/remover figuras personalizadas fica só em `GamesManager` —
      falta indicar visualmente quando uma figura está "em uso" antes de
      deixar remover (hoje remove sem avisar)
- [ ] Não há como "esquecer" a voz clonada pela interface (só apagando
      manualmente `backend/data/voice-config.json` ou pedindo pra
      ElevenLabs remover a voz na conta deles)
- [ ] Permitir editar o e-mail de recuperação sem trocar o PIN junto
- [ ] Múltiplos perfis (mais de uma criança por conta)
- [ ] Exportar relatório da Análise em PDF para levar ao terapeuta
- [ ] Testes automatizados (ainda não há nenhum, nem frontend nem backend)
- [ ] Deploy: o backend precisa de um host que mantenha processo rodando
      (Render, Railway, Fly.io, VPS — não funciona em hosting puramente
      estático); o frontend pode ir para Vercel/Netlify apontando
      `VITE_API_URL` para a URL pública do backend
- [ ] `SENDGRID_FROM` está verificado por Single Sender (Gmail), não por
      Domain Authentication — sem domínio próprio autenticado via DNS
      (SPF/DKIM), o Gmail não confia no remetente e os e-mails tendem a
      cair em spam na primeira vez (o frontend já avisa pra checar a caixa
      de spam). Decisão deliberada por enquanto: comprar/reaproveitar um
      domínio e migrar para Domain Authentication na SendGrid resolve isso
      de vez, mas foi adiado.

## Convenções de código
- Componentes funcionais + hooks, sem classes
- Cores dinâmicas (por botão/categoria) usam `style` inline, já que
  dependem de dados em runtime — não dá pra usar classes Tailwind estáticas
  para isso
- Textos e comentários em português (público é famílias brasileiras)
- Sempre `try/catch` ao redor de qualquer I/O (storage, fetch de voz,
  fetch pro backend, envio de e-mail etc.)
- Novas features que envolvam decisões de UX ligadas ao autismo devem vir
  acompanhadas do "porquê" em comentário, como as desta lista
- Qualquer credencial nova (chave de API, segredo) entra em `backend/.env`
  — nunca em `frontend/src` ou em `localStorage`
