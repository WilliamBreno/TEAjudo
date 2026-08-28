// CRUD da tabela pagamentos — histórico de cada cobrança gerada (uma por
// ciclo/tentativa de assinatura, ver routes/subscription.js).

import { db } from './db.js';

export function createPendingPagamento(assinaturaId, valorCentavos) {
  const info = db.prepare(`
    INSERT INTO pagamentos (assinatura_id, valor_centavos, status)
    VALUES (?, ?, 'pendente')
  `).run(assinaturaId, valorCentavos);
  return findPagamentoById(info.lastInsertRowid);
}

export function findPagamentoById(id) {
  return db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(id);
}

export function markPagamentoPago(id, { transactionNsu, metodo }) {
  db.prepare(`
    UPDATE pagamentos SET status = 'pago', transaction_nsu = ?, metodo = ? WHERE id = ?
  `).run(transactionNsu || null, metodo || null, id);
}
