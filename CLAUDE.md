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
- `@libsql/client` — banco de dados (login e assinatura; ver seção
  "Banco de dados" abaixo)
- `bcrypt` — hash de senha · `cookie-parser` — cookie de sessão assinado
  (login dos responsáveis; ver seção "Login dos responsáveis" abaixo)
- `node-cron` — agenda o job diário de lembrete de vencimento (ver seção
  "Lembretes de vencimento" abaixo)

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

## Deploy em produção
Backend no Render (`https://teajudo.onrender.com`), frontend no Vercel
(`https://te-ajudo-chi.vercel.app`) — domínios diferentes.

**Frontend e backend "parecem" o mesmo site pro navegador, via proxy do
Vercel** — `frontend/vercel.json` repassa `/api/*` pro Render por baixo
dos panos:
```json
{ "rewrites": [{ "source": "/api/:path*", "destination": "https://teajudo.onrender.com/api/:path*" }] }
```
Isso não é só conveniência: sem isso, o cookie de sessão (Fase 1) vira um
cookie "de terceiro" aos olhos do navegador (frontend e backend em
domínios diferentes), e navegadores modernos (Chrome incluso, não só
Safari) vêm bloqueando isso cada vez mais — mesmo com `SameSite=None;
Secure` configurado certinho no backend, a sessão se perdia a cada
recarregamento da página. Com o proxy, toda chamada de API sai do próprio
`te-ajudo-chi.vercel.app` do ponto de vista do navegador, então o cookie
vira "primeira parte" e para de ser bloqueado. No Vercel, a variável
`VITE_API_URL` **não aponta pro Render** — mas o painel do Vercel não
deixa salvar uma variável com valor vazio (validação própria da
interface), então em vez de depender de string vazia, `App.jsx` só trata
o valor como URL de destino se ele começar com `http`; qualquer outro
valor (ex: `same-origin`, ou qualquer placeholder) vira string vazia e as
chamadas usam caminho relativo (`/api/...`, same-origin, ativando o
proxy). Configure `VITE_API_URL` no Vercel com qualquer texto que não
comece com `http` (ex: `same-origin`).

Variáveis obrigatórias no Render (backend), além das já documentadas em
`.env.example`: `COOKIE_SECRET` e `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`
(sem qualquer uma delas, o servidor recusa subir com `NODE_ENV=production`
— ver seção "Banco de dados" abaixo) e
`BACKEND_PUBLIC_URL=https://teajudo.onrender.com` (pro webhook da
InfinitePay funcionar). `CORS_ORIGIN` continua configurada pro domínio do
Vercel, mas com o proxy ativo isso deixa de ser crítico (as chamadas
passam a ser same-origin) — fica só como fallback pra quem acessar a API
do Render direto.

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
  emoji, iconVariant, minimalIcon, imageData, locked}` — `emoji`/
  `iconVariant`/`minimalIcon` e `imageData` são mutuamente exclusivos (o
  formulário força escolher um ou outro; a UI dá preferência a
  `imageData` quando os dois existem por algum motivo). `iconVariant` é
  `'emoji'` (padrão, usa o campo `emoji`, texto livre — o pai pode digitar
  ou colar qualquer emoji do teclado do aparelho, além dos atalhos
  comuns) ou `'minimal'` (ignora `emoji` e mostra um ícone de linha,
  escolhido pelo pai numa grade em `ButtonsManager` — `MINIMAL_ICON_LIBRARY`
  tem as opções disponíveis; se o botão não tiver `minimalIcon` salvo,
  cai na sugestão da categoria em `CATEGORY_DEFAULT_ICON`, via
  `getMinimalIcon()`)
- `teajudo:settings` — `{pin, dailyLimitMinutes, voiceEnabled, showTimer,
  securityConfigured, parentEmail, buttonStyle, reduceMotion, childName}`
  — **não guarda mais chaves de API** (ElevenLabs e SendGrid/EmailJS foram
  para `backend/.env`). `voiceEnabled` vem **`true` por padrão** (decisão
  explícita do usuário: voz padronizada — o mesmo `ELEVENLABS_VOICE_ID`
  do backend já toca na `WelcomeScreen` e na `TutiBubble` de qualquer
  jeito, então os botões do `ChildPanel` passaram a usar a mesma voz por
  padrão também, em vez de exigir que o pai ligasse manualmente nas
  Configurações; continua com fallback automático pra voz do aparelho se
  o backend estiver fora do ar/sem `ELEVENLABS_API_KEY` configurada — ver
  `playPhrase`). Contas criadas **antes** dessa mudança de padrão já
  tinham `voiceEnabled: false` salvo de verdade no `localStorage` — e um
  valor salvo sempre vence o `DEFAULT_SETTINGS` no merge
  (`{...DEFAULT_SETTINGS, ...s}`), então essas contas continuavam presas
  na voz do aparelho nos botões (mesmo a `WelcomeScreen`/`TutiBubble` já
  tocando a voz nova, já que elas nunca checaram `voiceEnabled`). Corrigido
  com uma migração única no boot: se a flag `teajudo:voice-default-migrated`
  não existir ainda no `localStorage`, força `voiceEnabled: true` uma vez,
  salva os settings e grava a flag — mesmo padrão de versionamento do
  `AUDIO_CACHE_VERSION`, só que de leitura única em vez de comparado a
  cada reprodução. `childName` (nome da criança, usado nas frases do Tuti —
  ver seção "Mascote Tuti" abaixo) é capturado no formulário de cadastro
  (`AuthGate`) e só existe localmente — não é dado de conta, não vai pro
  backend, não sincroniza entre dispositivos
- `teajudo:logs` — últimos 400 eventos de uso: `{ts, type, buttonId,
  category, label}`
- `teajudo:puzzle-results` — últimos 200 resultados de quebra-cabeça:
  `{ts, level, pieceCount, timeSeconds, moves, completed}`
- `teajudo:memory-results` — últimos 200 resultados do jogo da memória:
  `{ts, level, pairCount, timeSeconds, moves, completed}`
- `teajudo:wordbuild-subjects` — repertório de palavras do jogo Formar a
  Palavra, cadastrado pelos pais em `GamesManager` →
  `WordBuildManager`: `{key, word, phrase, iconVariant ('emoji'|'foto'),
  emoji, imageData}` (`emoji`/`imageData` mutuamente exclusivos, mesmo
  padrão dos botões)
- `teajudo:wordbuild-results` — últimos 200 resultados de Formar a
  Palavra: `{ts, word, letterCount, timeSeconds, attempts, completed}`
- `teajudo:matchlines-subjects` — pares cadastrados do jogo Ligar os
  Itens, em `GamesManager` → `MatchLinesManager`: `{key, label, relation
  ('identico'|'categoria'|'associativo'), a: {variant, emoji,
  imageData}, b: {variant, emoji, imageData}}` — `relation` decide em
  qual dos 3 níveis (hierarquia VB-MAPP) o par aparece
- `teajudo:matchlines-results` — últimos 200 resultados de Ligar os
  Itens: `{ts, level, relation, pairCount, timeSeconds, errors,
  completed}` — `errors` (tentativas erradas) decide se o próximo nível
  libera (ver `GamesView`, "bom desempenho" = `errors <= pairCount`)
- `teajudo:puzzle-subjects` — figuras personalizadas (fotos) adicionadas
  pelos pais: `{key, label, imageData}`. Somadas às figuras embutidas
  (`BUILTIN_PUZZLE_SUBJECTS`, fotos reais em `frontend/public/game-subjects/`
  — ver seção "Mascote Tuti" abaixo) via `allSubjects` — usadas tanto no
  quebra-cabeça quanto no jogo da memória
- `teajudo:audio-cache` — cache de áudio da voz: `{[buttonId ou chave do
  Tuti]: {text, v, audioBase64}}` (sem `voiceId` — a voz é uma
  configuração única do servidor, não por requisição). `v` é
  `AUDIO_CACHE_VERSION` (constante em `App.jsx`) — sobe sempre que a voz
  configurada no backend mudar (voz clonada nova, `ELEVENLABS_VOICE_ID`
  trocado etc.); sem isso o cache (que só compara `text`) faria todo
  mundo continuar ouvindo o áudio antigo pra sempre, mesmo com o texto
  idêntico e a voz do servidor já trocada
- `teajudo:daily-usage` — `{date, seconds}` para o limite de tempo de uso

## Banco de dados (backend, Turso/libSQL)
Fase 0 de um sistema de login + assinatura paga (em construção, fases
documentadas à parte). É a **única** fonte de verdade sobre conta e
assinatura — o frontend nunca decide sozinho se o acesso está liberado
(isso viria de uma flag no `localStorage`, fácil de burlar limpando o
navegador).

**Turso, não mais um arquivo SQLite local com `better-sqlite3`.** A
troca aconteceu depois de um bug sério em produção: hospedagens grátis
como o Render **não têm disco persistente** — o container é recriado do
zero a cada deploy/reinício, e um arquivo local (mesmo dentro de
`backend/data/`, gitignored) simplesmente sumia junto, apagando toda
conta cadastrada sem aviso nenhum. Sintoma no ar: contas "esqueciam" a
senha, ou dava pra recriar a mesma conta do zero (`POST /api/auth/register`
nunca dava 409) depois de qualquer redeploy. `@libsql/client` fala com
um banco remoto (Turso — free tier permanente, sem expiração, ao
contrário do Postgres grátis do próprio Render que expira em 30 dias)
usando o mesmo dialeto SQL do SQLite — as tabelas/queries abaixo não
mudaram, só a forma de acessar (agora assíncrona: `lib/db.js` exporta
`dbGet`/`dbAll`/`dbRun`, e todo o resto do backend usa essas três funções
em vez de `db.prepare(...).get/.all/.run()`). Em dev local, sem
`TURSO_DATABASE_URL` configurada, cai automaticamente num arquivo local
(`backend/data/teajudo.db`, gitignored) — mesmo comportamento de antes,
sem precisar de conta externa só pra rodar na sua máquina. **Em
produção, `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` são obrigatórias — o
servidor recusa subir sem elas com `NODE_ENV=production`** (mesmo
espírito do `COOKIE_SECRET`), pra esse bug nunca mais acontecer em
silêncio.

Tudo o mais do app (botões, logs, resultados de jogos etc., listados
acima) continua só no `localStorage` — não precisa de sincronia entre
o tablet da criança e o celular dos pais, só a assinatura precisa ser
"de verdade" no servidor.

- `responsaveis` — `{id, nome, email UNIQUE, senha_hash, criado_em}`
- `assinaturas` — `{id, responsavel_id, status ('trial'|'ativa'|'atraso'|
  'bloqueada'), valor_centavos (default 2990 = R$29,90), vencimento_em,
  ultimo_pagamento_em, infinitepay_order_nsu}` — um responsável pode ter
  mais de uma linha ao longo do tempo; sempre pega a mais recente
  (`getSubscriptionByResponsavel`, em `lib/subscription.js`)
- `pagamentos` — `{id, assinatura_id, valor_centavos, metodo, status,
  transaction_nsu, criado_em}` — histórico de cada cobrança
- `voz_clonada_licenca` — `{responsavel_id, ativa, comprado_em}` — controla
  o upsell da clonagem de voz, separado da assinatura mensal

`lib/subscription.js` tem `TRIAL_DAYS` (constante, hoje 7 — fácil de
mudar, inclusive pra 0 se quiser cobrar sem trial), `createTrialSubscription(responsavelId)`
(chamada automaticamente no cadastro, `POST /api/auth/register`, Fase 1 —
ver seção "Login dos responsáveis" abaixo) e `renewSubscription(...)`
(chamada quando um pagamento é confirmado, Fase 2 — ver seção
"Assinatura via InfinitePay" abaixo). A regra de quantos dias de atraso
viram `'atraso'`/`'bloqueada'` ainda não existe — é da Fase 3/4.

Detalhe de ambiente: `npm run dev` roda com `node --watch --watch-path=src`
(não só `--watch`) porque, sem restringir o caminho observado, toda
escrita no arquivo do banco (em `backend/data/`, fora de `src/`) reiniciava
o servidor sozinho.

## API do backend
Todas as rotas sob `/api`. CORS liberado só para `CORS_ORIGIN` (padrão
`http://localhost:5173`), com `credentials: true` (obrigatório pra rotas
de sessão — ver "Login dos responsáveis" abaixo).

| Rota | Método | Body | Resposta |
|---|---|---|---|
| `/api/health` | GET | — | `{ ok: true }` |
| `/api/tts` | POST | `{ text }` | `{ audioBase64 }` |
| `/api/tts/status` | GET | — | `{ configured: boolean }` |
| `/api/auth/send-code` | POST | `{ email }` | `{ ok, demo, code? }` — `code` só vem preenchido se `demo: true` (SendGrid não configurado) |
| `/api/auth/verify-code` | POST | `{ email, code }` | `{ valid: boolean, reason? }` |
| `/api/auth/status` | GET | — | `{ mailerConfigured: boolean }` |
| `/api/auth/register` | POST | `{ nome, email, senha }` | `{ responsavel }` — cria conta, assinatura trial e já loga (seta cookie de sessão) |
| `/api/auth/login` | POST | `{ email, senha }` | `{ responsavel }` — seta cookie de sessão |
| `/api/auth/logout` | POST | — | `{ ok: true }` — limpa o cookie de sessão |
| `/api/auth/me` | GET | — | `{ responsavel }` (401 se não houver sessão válida) |
| `/api/auth/reset-password` | POST | `{ email, code, novaSenha }` | `{ ok: true }` — troca a senha num único passo (ver nota abaixo) |
| `/api/voice/clone` | POST | multipart: `audio` (arquivo), `name` (opcional) | `{ ok, voiceId }` |
| `/api/voice/status` | GET | — | `{ cloningAvailable, voiceConfigured, hasCustomVoice }` |
| `/api/subscription/config` | GET | — | `{ checkoutConfigured: boolean }` |
| `/api/subscription/status` | GET (auth) | — | `{ status, valorCentavos, vencimentoEm, ultimoPagamentoEm, diasRestantes }` |
| `/api/subscription/checkout` | POST (auth) | — | `{ checkoutUrl }` — gera um link de pagamento novo na InfinitePay |
| `/api/subscription/webhook` | POST | (chamado pela InfinitePay) | `{ ok: true }` — sempre 200; ver nota de segurança abaixo |

Códigos de verificação: gerados em `backend/src/lib/codeStore.js`, guardados
na tabela `codigos_verificacao` (não mais em memória — um Map em memória
some toda vez que o processo reinicia, o que aconteceu de verdade em
produção: pedir um código pouco antes de um redeploy/o serviço "dormir"
por inatividade no Render fazia o código virar "e-mail não encontrado" na
hora de verificar, mesmo digitado certo e dentro do prazo; corrigido
persistindo no banco), com expiração de 10 min, cooldown de 30s entre
reenvios pro mesmo e-mail, máximo de 5 tentativas erradas, e uso único
(a linha é apagada assim que verificado com sucesso).

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

## Login dos responsáveis (Fase 1)
Antes de qualquer outra coisa (inclusive o `ChildPanel`), o app exige uma
conta de responsável — separado do PIN da área dos pais, que continua
existindo do jeito que sempre existiu (é uma segunda camada, pra impedir a
criança de entrar nas Configurações, não uma alternativa ao login).

`backend`: senha com `bcrypt` (`BCRYPT_ROUNDS = 10`, mínimo 8 caracteres),
sessão via cookie assinado httpOnly (`cookie-parser`, não JWT) —
`SESSION_COOKIE_NAME = 'teajudo_session'`, validade de 30 dias. Em
produção (`NODE_ENV=production`) o cookie sai com `sameSite: 'none'` +
`secure: true` (necessário pro cenário Vercel↔Render, domínios
diferentes); em dev, `sameSite: 'lax'` sem `secure` (mesmo site, porta
diferente). `COOKIE_SECRET` (`backend/.env`) é obrigatório em produção —
o servidor recusa subir sem ele (`process.exit(1)`); em dev cai num valor
fixo se deixar em branco. `lib/session.js::requireAuth` é o middleware que
protege `GET /api/auth/me` e vai proteger as rotas de assinatura das
próximas fases. `lib/responsaveis.js::toPublic()` sempre tira o
`senha_hash` antes de qualquer resposta chegar no frontend.

E-mail é sempre normalizado (`lib/responsaveis.js::normalizeEmail` —
minúsculo, sem espaço nas pontas) antes de gravar ou buscar no banco, e
o mesmo vale pros códigos de verificação (`codeStore.js`, mesma
normalização). Sem isso, cadastro e login com grafias diferentes do
mesmo e-mail (ex: teclado do celular capitalizando a primeira letra
sozinho, comum em `type="email"` em alguns navegadores) nunca bateriam —
SQLite compara TEXT por padrão de forma sensível a maiúsculas/minúsculas.
`db.js` também roda uma correção de dados no boot pra normalizar contas
já cadastradas antes dessa mudança existir.

Cadastro (`POST /api/auth/register`) já cria a assinatura trial
(`createTrialSubscription`, ver seção "Banco de dados" acima) e loga
automaticamente — não tem passo de confirmar e-mail antes de poder usar
o app (o trial em si é a fricção mínima).

Recuperação de senha reaproveita o `codeStore.js`/`mailer.js` que já
existia pra troca de PIN (mesmo código de 6 dígitos, mesmo modo demo se
SendGrid não estiver configurado). Só que aqui é **um único passo
atômico** (`POST /api/auth/reset-password` recebe `email` + `code` +
`novaSenha` juntos), não "verificar código" seguido de "trocar senha" —
porque `codeStore.js::verifyCode()` é de uso único (a linha some da
tabela assim que confere), então um fluxo de 2 passos consumiria o código
no "verificar" e falharia no "trocar".

`frontend`: componente `AuthGate` (logo depois de `TEAjudoApp` fechar, no
arquivo `App.jsx`) com 3 modos (`'login' | 'register' | 'forgot'`), mesmo
padrão visual do `SecuritySetup` (card centralizado, mesma paleta). Em
`TEAjudoApp`, os estados `authChecked`/`responsavel` (não só
`loading`/`view`) decidem o que renderizar: enquanto `!authChecked`,
mostra o loading normal (evita "piscar" a tela de login pra quem já tem
sessão válida); depois disso, `!responsavel` renderiza `AuthGate` no lugar
de tudo o resto, inclusive `ChildPanel`. Um `useEffect` no mount chama
`GET /api/auth/me` (com `credentials: 'include'`) pra restaurar a sessão
ao recarregar a página. Logout mora em `SettingsPanel` → card "Sua conta"
→ botão "Sair da conta" → `POST /api/auth/logout`. Toda chamada de auth
usa `credentials: 'include'` (obrigatório pra cookie cross-origin
funcionar em produção).

## Assinatura via InfinitePay (Fase 2)
R$29,90/mês, cobrado pelo Checkout Integrado da InfinitePay
(`https://api.checkout.infinitepay.io`). Documentação oficial:
[checkout-documentacao](https://www.infinitepay.io/checkout-documentacao) e
[central de ajuda](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-da-infinitepay).

**Não existe assinatura recorrente nativa nessa API** — só link de
pagamento avulso (`POST /links`, autenticado só pelo `handle`, a
InfiniteTag pública do recebedor, sem API key). A "recorrência" mensal do
TEAjudo é modelada gerando um **link novo a cada ciclo**: o responsável
clica em "Assinar agora"/"Renovar assinatura", paga, e a assinatura fica
`'ativa'` por 30 dias a partir do pagamento. Isso é a base que as Fases
3 (lembrete de vencimento por e-mail) e 4 (atraso/bloqueio) vão usar —
não tem cobrança automática de cartão salvo, então lembrar o responsável
de renovar é essencial.

`backend`: `lib/infinitepay.js` (`createPaymentLink`, `checkPayment`,
`isCheckoutConfigured`) e `lib/pagamentos.js` (CRUD da tabela
`pagamentos`). Fluxo em `routes/subscription.js`:
1. `POST /checkout` cria uma linha `pagamentos` com `status='pendente'`,
   monta `order_nsu = 'teajudo-p' + pagamento.id` (assim o id fica
   embutido no próprio identificador — não precisa de coluna extra pra
   mapear de volta) e chama `POST /links` na InfinitePay, devolvendo a
   URL do checkout pro frontend abrir numa aba nova.
2. Quando o pagamento é aprovado, a InfinitePay chama de volta
   `POST /webhook` com o `order_nsu`, `transaction_nsu` e `invoice_slug`.
   **A documentação da InfinitePay não menciona assinatura/HMAC nesse
   payload** — ou seja, em teoria qualquer requisição forjada pra essa URL
   seria indistinguível de uma de verdade. Por isso o webhook nunca
   confia direto no corpo recebido: ele só usa isso como gatilho pra
   perguntar de volta pra própria InfinitePay via `POST /payment_check`
   (que devolve `paid`/`paid_amount` de forma independente) antes de
   marcar o pagamento como pago e estender `vencimento_em` em 30 dias.
   Requisições com `order_nsu` desconhecido ou já processado respondem
   200 sem fazer nada (idempotente).
3. `GET /status` (autenticado) é o que o frontend consulta pra saber o
   estado atual — o `SubscriptionCard` (dentro de `SettingsPanel`) chama
   isso no mount e depois de qualquer checkout.

**Pré-requisito na conta InfinitePay do dono do app:** o "Checkout
Externo" precisa estar habilitado manualmente em
`app.infinitepay.io/external-checkout#configuracoes` — sem isso, `POST
/links` responde 404 com `external_checkout_not_enabled` (foi o que
aconteceu testando com um handle fictício; a InfinitePay reconheceu o
formato da requisição, só recusou por causa dessa configuração de
conta). **Já confirmado habilitado e funcionando** na conta de produção
(`INFINITEPAY_HANDLE=william-breno-santos` em `backend/.env`, local,
gitignored) — `POST /checkout` testado de ponta a ponta gerando uma URL
de pagamento real em `checkout.infinitepay.io`, sem completar o
pagamento de verdade (isso fica pra quando o webhook puder ser testado,
ver abaixo). O botão "Assinar agora" no app cai graciosamente num aviso
de "pagamento não configurado" enquanto `INFINITEPAY_HANDLE` estiver
vazio — mesmo padrão de fallback do ElevenLabs/SendGrid.

`BACKEND_PUBLIC_URL` (`.env`) só é necessária pra InfinitePay conseguir
chamar o webhook de volta — em produção. Em `localhost` isso não é
alcançável de fora, então em dev o link de pagamento ainda é gerado
normalmente (testado, ver acima), só a confirmação automática do
pagamento não chega. **Ainda não testado de ponta a ponta com um
pagamento de verdade** — a InfinitePay não parece ter modo sandbox, então
esse teste completo (link → pagar → webhook → assinatura vira `'ativa'`)
fica pra depois do deploy do backend numa URL pública (ou usando um túnel
tipo ngrok antes disso, se quiser antecipar), já que envolve dinheiro de
verdade e não só configuração.

`frontend`: `SubscriptionCard` (dentro de `SettingsPanel`, logo abaixo do
card "Sua conta") mostra status/vencimento/valor e o botão de
assinar/renovar; `window.open` manda o responsável pra página de
pagamento da InfinitePay numa aba separada (o checkout em si acontece
fora do domínio do TEAjudo).

## Lembretes de vencimento (Fase 3)
`backend`: `lib/reminders.js::checkDueDateReminders()` roda todo dia às
9h (`node-cron`, agendado em `server.js`) e também uma vez no boot (cobre
o processo ter reiniciado perto do horário agendado — hospedagens grátis
derrubam o processo por inatividade). Para cada assinatura com status
`'trial'` ou `'ativa'` (atraso/bloqueio é Fase 4), calcula quantos dias
faltam (`subscription.js::diasRestantesAte`) e manda um e-mail
(`mailer.js::sendDueDateReminderEmail`, mesmo padrão HTTP da SendGrid dos
outros e-mails do projeto) só quando faltam exatamente **3, 2 ou 1** dia —
não "todo dia que faltar ≤3", pra não repetir o mesmo aviso. A coluna nova
`assinaturas.ultimo_lembrete_dias` (migração incremental via `ALTER
TABLE` em `lib/db.js`, já que a tabela existia antes desta fase) guarda o
último valor já avisado, então o job é seguro de rodar mais de uma vez no
mesmo dia; `renewSubscription` zera essa coluna a cada renovação, pra um
vencimento novo poder gerar avisos novos. Sem `SENDGRID_API_KEY`
configurado, o envio falha silenciosamente (só um `console.warn`) — o
resto do app continua funcionando normalmente, mesmo padrão de fallback
já usado em todo o projeto.

`frontend`: `SubscriptionDueBanner`, renderizado em `ParentArea` logo
acima das abas (Botões/Jogos/Configurações/Análise) — visível em
qualquer aba da Área dos pais, **nunca no `ChildPanel`** (a criança não
deve ver nada sobre pagamento/vencimento). Usa o mesmo `GET
/api/subscription/status` do `SubscriptionCard`, mas com sua própria
busca independente (fetch simples, sem estado compartilhado). Aparece em
duas situações (estendido na Fase 4 pra cobrir a segunda): faltando 1 a 3
dias pro vencimento (mesmo gatilho do e-mail, some depois disso), ou
`status` já `'atraso'`/`'bloqueada'` (aviso fica visível sempre, com cor
mais forte, até renovar — não faz sentido ter "janela de dias" pra
atraso). O botão "Renovar agora" só troca pra aba Configurações (onde
mora o `SubscriptionCard` com o botão de checkout de verdade) — não
inicia o pagamento direto do banner.

## Atraso e bloqueio (Fase 4)
`backend`: `lib/subscription.js::refreshOverdueStatus(assinatura)` — uma
assinatura `'trial'`/`'ativa'` que passa do vencimento vira `'atraso'`
depois de `DIAS_PARA_ATRASO` (1) dia, e `'bloqueada'` depois de
`DIAS_PARA_BLOQUEAR` (2) dias — constantes fáceis de mudar, mesmo estilo
do `TRIAL_DAYS`. **Só anda pra frente**: uma vez `'bloqueada'`, só volta
pra `'ativa'` de verdade, via `renewSubscription` (pagamento confirmado
no webhook) — nunca sozinha, mesmo que alguém edite `vencimento_em` pro
futuro por engano. A transição é "sob demanda": `getSubscriptionByResponsavel`
já chama `refreshOverdueStatus` antes de devolver a linha, então todo
`GET /api/subscription/status` reflete o estado real na hora, sem
depender do cron ter rodado naquele dia; o cron diário
(`refreshAllOverdueStatuses` em `server.js`, junto com os lembretes da
Fase 3) também roda a mesma checagem pra manter o banco em dia mesmo pra
quem não abre o app.

`frontend`: em `TEAjudoApp`, o estado `subscriptionStatus` é buscado uma
vez ao confirmar o login e de novo toda vez que a Área dos pais fecha
(`onClose` do `ParentArea`) — não fica em polling constante, só nos
pontos em que o status realisticamente pode ter mudado (o pai só renova
de dentro da Área dos pais). Enquanto `subscriptionStatus` ainda é `null`
("não sabemos ainda"), o app **não bloqueia** — evita um flash da tela de
bloqueio pra quem está em dia; o pior caso é um instante a mais do
ChildPanel visível antes do status confirmar, inofensivo. Quando
`status === 'bloqueada'`, `RegularizationScreen` substitui tanto o
`ChildPanel` quanto o `GamesView` (`view === 'panel' | 'games'`) — mas
`view === 'parentGate' | 'securitySetup' | 'parent'` são estados
irmãos, não filhos do ChildPanel, então continuam alcançáveis
normalmente pelo mesmo botão de cadeado de sempre, exatamente como o
enunciado da fase pediu ("Área dos pais continua acessível via PIN").
`RegularizationScreen` é deliberadamente neutra pra criança — nunca
menciona assinatura, pagamento ou dinheiro, só "hora de uma pausa" e o
mesmo botão de entrar na Área dos pais; quem resolve isso é o
responsável, não a criança lendo a tela.

## Mascote Tuti
Ativos em `frontend/public/tuti/` (`Logo.png`, `tuti-intro.mp4`,
`tuti-bubble-character.png`) — servidos pelo Vite em `/tuti/*`. `Logo.png`
já traz a palavra "TEAjudo" desenhada (não só o mascote), então em todo
lugar que usa a logo (favicon em `index.html`, topo do `AuthGate`,
canto superior esquerdo do `ChildPanel` — substituindo o `<h1>TEAjudo</h1>`
fixo em texto) é só a imagem, sem escrever "TEAjudo" de novo em HTML por
baixo dela. A `WelcomeScreen` é a única exceção deliberada: mostra o
nome por extenso em HTML (ver abaixo), não a imagem — decisão do usuário.

`tuti-bubble-character.png` é a versão "corpo inteiro, fundo transparente,
joinha" — usada sem `border-radius`/máscara na `TutiBubble`, o recorte
transparente já dá o efeito de personagem solto flutuando no canto. O
`<video>` da `WelcomeScreen` não usa mais atributo `poster` (o arquivo que
existia ali era na verdade essa mesma imagem do personagem, só com nome
trocado) — sem `poster`, o navegador mostra o primeiro frame do próprio
vídeo enquanto carrega, comportamento nativo, sem precisar de imagem
separada.

`WelcomeScreen` (tela cheia, `frontend/src/App.jsx`) — aparece toda vez
que a sessão é confirmada (login novo OU recarregar a página já logado —
decisão explícita do usuário; antes era 1x por sessão via
`sessionStorage`, removido a pedido dele), gatilho é sessão logada
+ `settings.childName` preenchido (sem os dois, pula — evita uma frase
quebrada tipo "assistente virtual de undefined!" pra quem logou num
navegador novo, já que `childName` é local e não sincroniza entre
dispositivos). Abaixo do vídeo, "TEAjudo" em texto HTML (não `Logo.png`,
que virou a logo do `ChildPanel`) — cores exatas pedidas pelo usuário:
T vermelho (`#C0605A`, já usado no resto do app pra "perigo"/exclusão),
E azul (`CATEGORY_META.sentimentos`), A verde (`CATEGORY_META.acoes`),
"judo" amarelo (`CATEGORY_META.pessoas`). Toca o vídeo (mudo, `autoPlay`) e sintetiza a fala
("Olá, sou o Tuti, assistente virtual de {childName}!") via
`getOrSynthesizeAudio` — mesmo cache de áudio dos botões
(`teajudo:audio-cache`), só que endereçado por uma chave própria
(`welcome:{childName}`) em vez do id do botão. Fecha sozinha ~800ms
depois do que terminar por último entre vídeo e áudio (o vídeo já para
no último frame sozinho, comportamento nativo do `<video>` sem `loop`);
se a síntese de voz falhar (backend fora do ar/não configurado), a tela
não trava esperando um áudio que nunca chega — segue só com o vídeo. Se o
navegador bloquear o autoplay do áudio (comum: o `play()` acontece depois
de um `await`, fora da janela de "gesto do usuário" — bem mais frequente
em mobile), mostra um botão "Tocar a voz do Tuti" pra iniciar manualmente
em vez de falhar em silêncio (`playAudioBase64` aceita um callback
`onBlocked` à parte do `onEnd` justamente pra isso). Tem um botão "Pular"
sempre visível.

Enquanto `audioBlocked` for `true`, a tela **não fecha sozinha** (nem
pelo timer de 800ms depois do vídeo acabar, nem pela rede de segurança de
15s) — antes fechava, porque o vídeo mudo quase nunca é bloqueado e
terminava sozinho enquanto o áudio ainda esperava o toque; quem apertava
"Tocar a voz do Tuti" depois disso ouvia só a voz solta, sem a
apresentação (vídeo já tinha acabado, às vezes a tela já tinha até
fechado). `handleTapToPlayAudio` agora reinicia o vídeo do zero
(`currentTime = 0` + `play()`) junto de tocar o áudio, pra voz e
apresentação sempre andarem juntas.

`TutiBubble` (componente reutilizável, recebe `phrase`/`tabKey` —
arquitetado pra qualquer aba que não seja o `ChildPanel`, hoje só usado
em `GamesView`; uma aba nova no futuro só precisa renderizar
`<TutiBubble tabKey="..." phrase="..." />` pra ganhar o mesmo
comportamento) — personagem ancorado no canto inferior direito
(`position: fixed`, sem cartão/fundo atrás) com um balão de fala,
entrada única (`.tea-fadein`, já existia pro resto do app — reaproveitada
em vez de criar uma keyframe nova) e fechamento automático ~4s depois do
áudio (ou na hora, se tocar nela ou no X). Frequência: contador por aba
em `localStorage` (`teajudo:tuti-bubble-visits:<tabKey>`, não
`sessionStorage` — precisa sobreviver entre sessões), incrementado a
cada entrada na aba; só renderiza a bolha na 4ª, 8ª, 12ª... visita
(`contador % 4 === 0`) — decisão explícita do usuário, pra não virar um
elemento repetitivo toda vez. O `ChildPanel` nunca renderiza esse
componente, então "voltar pro painel" nunca conta como visita de
nenhuma aba.

Figuras dos jogos (`BUILTIN_PUZZLE_SUBJECTS`) — fotos reais em
`frontend/public/game-subjects/` (hoje 5 ilustrações do próprio Tuti em
cenas do dia a dia, ex: andando de bike, acampando), substituindo o
desenho de emoji em canvas que existia antes (`makePuzzleImage`, removida
— o quebra-cabeça e o jogo da memória agora só sabem lidar com foto,
nunca mais com emoji). Cada subject ganhou um campo `imageSrc` (caminho
público) equivalente ao `imageData` (base64) das fotos personalizadas dos
pais — os dois são tratados de forma intercambiável em todo o código
(`s.imageData || s.imageSrc`), então quebra-cabeça e jogo da memória não
precisam saber a origem da foto. A lista é gerada manualmente a partir do
que existe na pasta (não via `import.meta.glob`: esse recurso do Vite não
enxerga arquivos em `public/`, só os que passam pelo bundler) — adicionar
ou remover arquivo em `game-subjects/` exige atualizar
`BUILTIN_PUZZLE_SUBJECTS` também.

## Decisões de design (não reverter sem motivo forte)
Vêm de práticas reais de CAA/TEA — documentando o "porquê":

- **Cores por categoria gramatical** (ações=verde, pessoas=amarelo,
  objetos=laranja, sentimentos=azul, perguntas=roxo, social=rosa), inspirado
  na "Fitzgerald Key" usada em pranchas de CAA reais — a cor carrega
  informação (categoria gramatical), não é só decoração, então esse
  agrupamento não muda. Cada botão também aceita cor individual
  customizada — a cor da categoria é só a sugestão inicial.
  **Visual dos botões é deliberadamente chamativo e "bonito" pras
  crianças** (decisão explícita do usuário, além da função de CAA em si):
  cores **sólidas/vívidas** (não pastel) — o fundo do botão é a própria
  cor, num degradê claro→vívido (não plano) pra dar brilho, com um
  reflexo de vidro/gloss fixo no topo (efeito 3D, estático — sem virar
  animação contínua) e **borda neon** (versão bem clareada da mesma cor +
  glow em camadas via `box-shadow`) nos dois estilos visuais
  (`getButtonCardStyle`, "Tátil" e "Nítido" — o "Nítido" tinha regredido
  pra fundo branco com só um acento colorido numa passada visual
  anterior, contrariando o princípio original de "fundo é a própria cor",
  e foi corrigido). Contraste de texto calculado automaticamente
  (`getContrastText`) nos dois estilos, texto em `font-extrabold` com
  leve `text-shadow` pra mais ênfase (não mudou de tamanho). Fundo geral
  atrás dos botões (não o botão em si) é levemente mais escuro que o
  resto do app (`shadeColor('#FAF7F2', 0.04)`), sempre, em todo o painel
  principal — decisão explícita do usuário, pra dar mais contraste atrás
  dos cartões vívidos. Essa cor é aplicada **uma única vez**, no wrapper
  raiz de `TEAjudoApp` (condicional a `view === 'panel'`), não mais numa
  segunda `<div className="min-h-screen">` dentro do próprio `ChildPanel`
  — duas divs com `min-h-screen` empilhadas forçavam a página a ficar
  2× mais alta que a tela sempre que o conteúdo (poucos botões, poucas
  linhas) era mais curto que a viewport, sobrando uma faixa clara vazia
  embaixo e criando rolagem no desktop que não deveria existir. Todo
  `min-h-screen` do app (`TEAjudoApp`, `RegularizationScreen`) virou
  **`min-h-svh`** (`100svh`, small viewport height — o tamanho da tela
  com a barra do navegador **já visível**) em vez de `100vh`. No
  celular, `100vh` conta a área atrás da barra de endereço, que
  aparece/some ao tocar em qualquer botão — isso fazia a altura
  "calculada" da página mudar sozinha a cada toque, e o navegador reagia
  deslizando a própria barra por cima do conteúdo por um instante
  (relatado como "a tela quebra e volta"). A primeira tentativa foi
  `min-h-dvh` (dynamic viewport height), mas `dvh` **por definição**
  acompanha a barra em tempo real — ou seja, a página continuava
  recalculando/re-fluindo toda vez que a barra escondia ou reaparecia, e
  esse próprio recálculo é que causava o salto visual; só trocar `vh`
  por `dvh` não removia a causa, só mudava o gatilho. `svh` resolve de
  verdade: fica travado no tamanho pequeno (barra visível) o tempo todo,
  então a página nunca cresce quando a barra some sozinha e não há mais
  nada disparando reflow por causa disso — sobra um pouco de espaço
  embaixo quando a barra está escondida, troca aceitável por não ter
  nenhum salto. Overlays de tela cheia que já usavam `fixed inset-0`
  (`WelcomeScreen`, `BreakOverlay`) não tinham esse problema — `inset-0`
  não depende de unidade de viewport. Na mesma leva, o aviso de
  `voiceNotice` (voz personalizada indisponível) deixou de empurrar a
  grade de botões pra baixo quando aparecia (`<p>` inline antes do grid) —
  virou um toast `fixed`, flutuando por cima, sem afetar a altura da
  página; era outra fonte do mesmo sintoma de "layout pulando".
- **Ícone OU foto, nunca os dois ao mesmo tempo** — o formulário de novo
  botão tem um alternador explícito ("Usar ícone" / "Usar foto"); trocar de
  modo limpa a escolha anterior. Reforça previsibilidade: o botão sempre
  tem uma única imagem clara, não uma mistura confusa.
- **Figuras dos jogos são fotos reais, não emoji** — quebra-cabeça e
  jogo da memória usam `imageSrc`/`imageData` (nunca mais um emoji
  desenhado em canvas). Emoji é um símbolo abstrato — reconhecer que
  "🐱" representa "gato" já é um passo de abstração a mais; uma foto de
  verdade tira essa camada extra, mesma lógica de por que as figuras
  personalizadas que os pais sobem em `GamesManager` sempre foram foto,
  nunca emoji. As figuras embutidas de hoje (`game-subjects/`) são do
  próprio mascote Tuti em cenas do dia a dia — não objetos/animais
  variados — o ideal continua sendo fotos genéricas e diversas (mais
  fáceis de generalizar pra vida real da criança); ver pendência na lista
  abaixo.
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
- **Formar a Palavra é cópia com apoio visual, não adivinhação** — a
  palavra correta fica escrita e a imagem visível o tempo todo enquanto
  a criança arrasta as letras; nunca esconde a resposta certa tentando
  "testar" a criança, mesma filosofia de tirar pressão do resto do app.
- **Ligar os Itens segue a hierarquia real do VB-MAPP** (idêntico →
  categoria → associativo/funcional), progressão usada clinicamente em
  currículos de ABA/CAA — pular direto pra associativo sem passar pelos
  anteriores tende a ser difícil demais cedo demais. Erro nesse jogo só
  balança os dois itens e desfaz sozinho (`.tea-shake`), sem nenhuma
  penalidade — mesmo espírito de "erro não trava nem pune" do resto do
  app.
- **Motion.dev / Magic UI / React Bits não estavam disponíveis** no
  ambiente de artifact original — os efeitos (`tea-popin`, `tea-fadein`,
  `tea-pulse-ring`, `tea-shimmer-btn`, confete, o gloss/reflexo estático
  dos botões) foram recriados em CSS puro dentro de `GLOBAL_STYLES`.
  `motion` (`frontend/package.json`) já está instalado desde que o
  projeto saiu do ambiente de artifact — ainda não foi usado em nenhum
  componente (os efeitos atuais continuam em CSS puro, já testados e
  funcionando), mas está disponível pra quem quiser trocar por uma
  animação de verdade da biblioteca no lugar de alguma dessas classes.
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
| Login/cadastro/recuperação de senha do responsável | `AuthGate` |
| Status da assinatura + assinar/renovar (InfinitePay) | `SubscriptionCard` |
| Aviso de vencimento próximo (Área dos pais, não no ChildPanel) | `SubscriptionDueBanner` |
| Tela de bloqueio quando a assinatura vence (substitui o ChildPanel) | `RegularizationScreen` |
| Tela de boas-vindas do Tuti (1x por sessão, vídeo + voz) | `WelcomeScreen` |
| Bolha do Tuti com balão de fala (hoje só na aba Jogos) | `TutiBubble` |
| Painel principal (botões falantes, cores vívidas) | `ChildPanel`, `getContrastText`, `shadeColor` |
| Reprodução de áudio (chama `/api/tts` + fallback local) | `playPhrase` (em `TEAjudoApp`), `playAudioBase64`, `fallbackSpeak` |
| Escolha de jogo (quebra-cabeça, memória, formar a palavra, ligar os itens) | `GamesView` |
| Quebra-cabeça com arraste | `PuzzleBoard` |
| Jogo da memória (mostra e depois vira para achar os pares) | `MemoryBoard` |
| Formar a palavra (copiar arrastando letras, apoio visual sempre visível) | `WordBuildBoard` |
| Ligar os itens (discriminação, hierarquia VB-MAPP, arraste desenha linha) | `MatchLinesBoard` |
| Confete ao concluir | `ConfettiBurst` |
| Portão da área dos pais (PIN) | `ParentGate` |
| Configuração de segurança (e-mail → código → novo PIN, via backend) | `SecuritySetup` |
| Cadastro de botões (ícone OU foto, cor individual, bloqueio/liberação) | `ButtonsManager` |
| Figuras personalizadas para os jogos | `GamesManager` |
| Repertório de palavras do jogo Formar a Palavra | `WordBuildManager` (dentro de `GamesManager`) |
| Repertório de pares do jogo Ligar os Itens | `MatchLinesManager` (dentro de `GamesManager`) |
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

**`handleLogout` também reseta `view` pra `'panel'`** (e limpa
`pinInput`/`pinError`) — sem isso, `responsavel: null` só troca pra
`AuthGate` por cima (o resto do estado do componente continua vivo por
baixo), então sair de dentro da Área dos pais e logar de novo (mesma
conta ou outra) caía direto de volta na Área dos pais, pulando o
`ParentGate`/PIN inteiro. `view` é estado de navegação da sessão, não
deveria sobreviver a um logout.

## Pendências conhecidas
- [ ] Só 5 fotos em `game-subjects/` (todas do próprio Tuti, não de
      objetos/pessoas/animais variados) — o jogo da memória bloqueia os
      níveis que precisam de mais pares do que há fotos disponíveis
      (`unlocked = subjects.length >= l.pairs`, em `GamesView`): com 5
      fotos embutidas e nenhuma personalizada, só os níveis de 3 e 4
      pares abrem; os de 6 e 8 pares ficam bloqueados até os pais
      cadastrarem fotos extra em `GamesManager` (ou até crescer a pasta
      `game-subjects/`)
- [ ] Migrar de `localStorage` para banco de dados real (Postgres/SQLite +
      Prisma, por exemplo) se precisar sincronizar entre o tablet da
      criança e o celular dos pais
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
- [x] Deploy: backend no Render (`https://teajudo.onrender.com`), frontend
      no Vercel (`https://te-ajudo-chi.vercel.app`) — ver seção "Deploy em
      produção" abaixo
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
