// Helpers de assinatura usados desde a Fase 1 (cadastro cria o trial) até
// a Fase 4 (atraso/bloqueio).

import { dbGet, dbAll, dbRun } from './db.js';

// Fácil de mudar, inclusive pra 0 se quiser cobrar sem período de teste.
export const TRIAL_DAYS = 7;

// Fase 4: quantos dias de atraso (depois do vencimento) até virar
// 'atraso', e depois 'bloqueada'. Enquanto só 'atraso', o ChildPanel
// continua funcionando normalmente — só a Área dos pais mostra o aviso
// (SubscriptionDueBanner, frontend); só 'bloqueada' troca o ChildPanel
// pela tela de regularização.
export const DIAS_PARA_ATRASO = 1;
export const DIAS_PARA_BLOQUEAR = 2;

export function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// vencimento_em é salvo em UTC ('YYYY-MM-DD HH:MM:SS', sem timezone) —
// precisa desse 'Z' pra virar um Date válido antes de comparar com agora.
export function diasRestantesAte(vencimentoEm) {
  const vencimento = new Date(vencimentoEm.replace(' ', 'T') + 'Z');
  return Math.ceil((vencimento.getTime() - Date.now()) / 86400000);
}

export async function createTrialSubscription(responsavelId) {
  const vencimento = toSqlDateTime(new Date(Date.now() + TRIAL_DAYS * 86400000));
  const info = await dbRun(
    "INSERT INTO assinaturas (responsavel_id, status, vencimento_em) VALUES (?, 'trial', ?)",
    [responsavelId, vencimento]
  );
  return getSubscriptionById(info.lastInsertRowid);
}

export async function getSubscriptionById(id) {
  return dbGet('SELECT * FROM assinaturas WHERE id = ?', [id]);
}

// Um responsável pode, na teoria, acabar com mais de uma linha ao longo
// do tempo — pega sempre a mais recente. Já aplica a transição de
// atraso/bloqueio (ver refreshOverdueStatus) antes de devolver, então
// quem chama essa função sempre vê o status em dia, sem precisar esperar
// o cron rodar de novo.
export async function getSubscriptionByResponsavel(responsavelId) {
  const assinatura = await dbGet(
    'SELECT * FROM assinaturas WHERE responsavel_id = ? ORDER BY id DESC LIMIT 1',
    [responsavelId]
  );
  return assinatura ? refreshOverdueStatus(assinatura) : assinatura;
}

// Fase 4: 'trial'/'ativa' que passou do vencimento vira 'atraso' (>=1 dia
// de atraso) e depois 'bloqueada' (>=2 dias) — só anda pra frente aqui;
// voltar pra 'ativa' só acontece via pagamento de verdade
// (renewSubscription, chamada pelo webhook). Atualiza o banco só quando o
// status realmente muda (idempotente, seguro de chamar a cada request).
export async function refreshOverdueStatus(assinatura) {
  if (assinatura.status !== 'trial' && assinatura.status !== 'ativa' && assinatura.status !== 'atraso') {
    return assinatura; // 'bloqueada' é o fim da linha; só destrava com pagamento
  }
  const diasAtraso = -diasRestantesAte(assinatura.vencimento_em);
  let novoStatus = assinatura.status;
  if (diasAtraso >= DIAS_PARA_BLOQUEAR) novoStatus = 'bloqueada';
  else if (diasAtraso >= DIAS_PARA_ATRASO) novoStatus = 'atraso';

  if (novoStatus === assinatura.status) return assinatura;
  await dbRun('UPDATE assinaturas SET status = ? WHERE id = ?', [novoStatus, assinatura.id]);
  return { ...assinatura, status: novoStatus };
}

// Chamada pelo cron diário (server.js), além da checagem "sob demanda" já
// feita em getSubscriptionByResponsavel — garante que o status fica em
// dia mesmo pra quem não abrir o app naquele dia.
export async function refreshAllOverdueStatuses() {
  const rows = await dbAll("SELECT * FROM assinaturas WHERE status IN ('trial', 'ativa', 'atraso')");
  for (const row of rows) await refreshOverdueStatus(row);
}

// Chamada quando um pagamento é confirmado (ver routes/subscription.js,
// POST /webhook) — sempre marca 'ativa' e empurra o vencimento 30 dias a
// partir de agora (não a partir do vencimento antigo: renovar atrasado
// não deve "herdar" os dias já perdidos). Zera ultimo_lembrete_dias: o
// vencimento mudou, então qualquer lembrete já mandado era sobre a data
// antiga e não deve impedir um aviso novo mais pra frente.
export async function renewSubscription(assinaturaId, { vencimentoEm, ultimoPagamentoEm, infinitepayOrderNsu }) {
  await dbRun(
    `UPDATE assinaturas
     SET status = 'ativa', vencimento_em = ?, ultimo_pagamento_em = ?,
         infinitepay_order_nsu = ?, ultimo_lembrete_dias = NULL
     WHERE id = ?`,
    [vencimentoEm, ultimoPagamentoEm, infinitepayOrderNsu, assinaturaId]
  );
}
