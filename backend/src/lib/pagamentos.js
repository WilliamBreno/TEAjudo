// CRUD da tabela pagamentos — histórico de cada cobrança gerada (uma por
// ciclo/tentativa de assinatura, ver routes/subscription.js).

import { dbGet, dbRun } from './db.js';

export async function createPendingPagamento(assinaturaId, valorCentavos) {
  const info = await dbRun(
    "INSERT INTO pagamentos (assinatura_id, valor_centavos, status) VALUES (?, ?, 'pendente')",
    [assinaturaId, valorCentavos]
  );
  return findPagamentoById(info.lastInsertRowid);
}

export async function findPagamentoById(id) {
  return dbGet('SELECT * FROM pagamentos WHERE id = ?', [id]);
}

export async function markPagamentoPago(id, { transactionNsu, metodo }) {
  await dbRun(
    "UPDATE pagamentos SET status = 'pago', transaction_nsu = ?, metodo = ? WHERE id = ?",
    [transactionNsu || null, metodo || null, id]
  );
}
