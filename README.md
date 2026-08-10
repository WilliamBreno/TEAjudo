# TEAjudo

Sistema de Comunicação Aumentativa e Alternativa (CAA) para crianças
autistas — painel de botões falantes com voz personalizável, jogos de
quebra-cabeça, área dos pais com PIN protegido por verificação de e-mail e
liberação gradual de vocabulário, e uma área de análise com sugestões
baseadas no uso.

Projeto dividido em duas partes:

```
TEAjudo/
├── frontend/   → app React (Vite + Tailwind v4)
└── backend/    → servidor Node/Express (protege as chaves de API)
```

## Por que tem um backend?

Duas coisas exigem uma chave/credencial secreta que **não pode** ficar
exposta no navegador:

1. **Voz clonada (ElevenLabs)** — a chave da API fica só no servidor.
2. **Verificação de e-mail para troca de PIN** — o backend gera o código,
   envia via SendGrid e confere a resposta; o código nunca é gerado nem
   validado no navegador.

Sem o backend rodando, o app inteiro continua funcionando normalmente — só
esses dois recursos caem em modo de fallback (voz padrão do aparelho / erro
avisando para checar o backend).

## Rodando localmente

Precisa de **dois terminais** (frontend e backend rodam separados):

**Terminal 1 — backend**
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

**Terminal 2 — frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abra o endereço que o Vite mostrar (normalmente `http://localhost:5173`).

## Configuração opcional (dentro de `backend/.env`)

- `ELEVENLABS_API_KEY` — necessária tanto para a voz clonada quanto para
  gravar e clonar uma voz direto pela interface (Área dos pais →
  Configurações → "Gravar uma voz para clonar"). Crie a chave em
  [elevenlabs.io](https://elevenlabs.io).
- `ELEVENLABS_VOICE_ID` — opcional se você já gravou uma voz pela própria
  interface (nesse caso o app usa automaticamente a última voz clonada,
  guardada em `backend/data/voice-config.json`). Preencha manualmente aqui
  se preferir usar uma voz já existente na sua conta ElevenLabs.
- `SENDGRID_API_KEY` / `SENDGRID_FROM` — para o código de verificação de
  troca de PIN chegar de verdade por e-mail (via API HTTP da SendGrid, não
  SMTP — evita bloqueio de porta em hospedagens grátis). Sem isso, o código
  aparece na tela em modo de demonstração (só para desenvolvimento local).
  `SENDGRID_FROM` precisa ser um remetente verificado na sua conta SendGrid.

Veja `CLAUDE.md` para detalhes de arquitetura, endpoints da API, decisões
de design e pendências conhecidas.

## Aviso

Este app é uma ferramenta de apoio à comunicação e ao acompanhamento da
família — não substitui avaliação, diagnóstico ou orientação de
fonoaudiólogos, terapeutas ocupacionais ou outros profissionais que
acompanham a criança.
