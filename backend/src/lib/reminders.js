// Lembretes de vencimento por e-mail (Fase 3) — roda diariamente via
// node-cron (ver server.js) e manda um e-mail quando faltam exatamente 3,
// 2 ou 1 dia pro vencimento da assinatura (trial ou paga; atraso/bloqueada
// é assunto da Fase 4). Só esses 3 dias, não "todo dia que faltar <=3",
// senão o responsável tomaria o mesmo aviso repetido — ultimo_lembrete_dias
// guarda o último valor já avisado pra essa assinatura (resetado a cada
// renovação, ver subscription.js::renewSubscription), então o job é
// seguro de rodar mais de uma vez no mesmo dia (ex: servidor reiniciou).

import { db } from './db.js';
import { diasRestantesAte } from './subscription.js';
import { sendDueDateReminderEmail } from './mailer.js';

const DIAS_PARA_AVISAR = [3, 2, 1];

export async function checkDueDateReminders() {
  const rows = db.prepare(`
    SELECT a.id, a.vencimento_em, a.ultimo_lembrete_dias,
           r.nome AS responsavel_nome, r.email AS responsavel_email
    FROM assinaturas a
    JOIN responsaveis r ON r.id = a.responsavel_id
    WHERE a.status IN ('trial', 'ativa')
  `).all();

  for (const row of rows) {
    const dias = diasRestantesAte(row.vencimento_em);
    if (!DIAS_PARA_AVISAR.includes(dias)) continue;
    if (row.ultimo_lembrete_dias === dias) continue;

    const result = await sendDueDateReminderEmail(row.responsavel_email, {
      nome: row.responsavel_nome,
      diasRestantes: dias,
      vencimentoEm: row.vencimento_em,
    });

    if (result.sent) {
      db.prepare('UPDATE assinaturas SET ultimo_lembrete_dias = ? WHERE id = ?').run(dias, row.id);
    } else {
      console.warn(`[lembrete de vencimento] não enviado (assinatura ${row.id}, ${dias} dia(s)): ${result.reason}`);
    }
  }
}
