import { Router } from 'express';
import { requireAuth } from '../lib/session.js';
import { getSubscriptionByResponsavel, renewSubscription, toSqlDateTime, diasRestantesAte } from '../lib/subscription.js';
import { createPendingPagamento, findPagamentoById, markPagamentoPago } from '../lib/pagamentos.js';
import { createPaymentLink, checkPayment, isCheckoutConfigured } from '../lib/infinitepay.js';

const router = Router();

const FRONTEND_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
// Só existe (e faz sentido) quando o backend está publicado numa URL
// alcançável pela internet — a InfinitePay precisa conseguir chamar de
// volta. Em dev local isso não é alcançável, então o webhook_url fica de
// fora do link e a confirmação depende do responsável voltar pro app
// depois de pagar (GET /status reflete o estado real assim que o
// pagamento cair, via webhook, numa próxima checagem).
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || '';

router.get('/config', (_req, res) => {
  res.json({ checkoutConfigured: isCheckoutConfigured() });
});

router.get('/status', requireAuth, async (req, res) => {
  const assinatura = await getSubscriptionByResponsavel(req.responsavel.id);
  if (!assinatura) {
    return res.status(404).json({ error: 'Assinatura não encontrada.' });
  }
  const diasRestantes = diasRestantesAte(assinatura.vencimento_em);
  res.json({
    status: assinatura.status,
    valorCentavos: assinatura.valor_centavos,
    vencimentoEm: assinatura.vencimento_em,
    ultimoPagamentoEm: assinatura.ultimo_pagamento_em,
    diasRestantes,
  });
});

router.post('/checkout', requireAuth, async (req, res) => {
  if (!isCheckoutConfigured()) {
    return res.status(503).json({ error: 'Pagamento não configurado no servidor.' });
  }
  const assinatura = await getSubscriptionByResponsavel(req.responsavel.id);
  if (!assinatura) {
    return res.status(404).json({ error: 'Assinatura não encontrada.' });
  }

  const pagamento = await createPendingPagamento(assinatura.id, assinatura.valor_centavos);
  // order_nsu carrega o id do próprio pagamento — assim o webhook acha a
  // linha certa sem precisar de uma coluna extra só pra esse mapeamento.
  const orderNsu = `teajudo-p${pagamento.id}`;

  try {
    const { checkoutUrl } = await createPaymentLink({
      orderNsu,
      valorCentavos: assinatura.valor_centavos,
      descricao: 'Assinatura TEAjudo (mensal)',
      customerName: req.responsavel.nome,
      customerEmail: req.responsavel.email,
      redirectUrl: FRONTEND_ORIGIN,
      webhookUrl: BACKEND_PUBLIC_URL ? `${BACKEND_PUBLIC_URL}/api/subscription/webhook` : undefined,
    });
    res.json({ checkoutUrl });
  } catch (err) {
    console.error('[subscription/checkout]', err);
    res.status(502).json({ error: 'Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.' });
  }
});

// Chamada pela própria InfinitePay quando um pagamento é aprovado — não
// pelo navegador do responsável, então sem requireAuth. A documentação
// da InfinitePay não menciona assinatura/HMAC no payload do webhook, ou
// seja, em teoria qualquer um que descubra essa URL poderia tentar
// forjar uma chamada. Por isso NUNCA confiamos direto no corpo recebido:
// o webhook só serve de gatilho pra perguntarmos de volta pra própria
// InfinitePay, via payment_check, se aquele pagamento realmente foi
// confirmado — só então o banco é atualizado.
router.post('/webhook', async (req, res) => {
  const { order_nsu, transaction_nsu, invoice_slug } = req.body || {};
  const match = /^teajudo-p(\d+)$/.exec(order_nsu || '');
  if (!match) {
    console.warn('[subscription/webhook] order_nsu não reconhecido:', order_nsu);
    return res.status(200).json({ ok: true });
  }

  const pagamento = await findPagamentoById(Number(match[1]));
  if (!pagamento || pagamento.status === 'pago') {
    return res.status(200).json({ ok: true });
  }

  try {
    const check = await checkPayment({ orderNsu: order_nsu, transactionNsu: transaction_nsu, slug: invoice_slug });
    const valorConfirmado = check.paid_amount ?? check.amount ?? 0;
    if (!check.paid || valorConfirmado < pagamento.valor_centavos) {
      console.warn('[subscription/webhook] payment_check não confirmou pagamento válido para', order_nsu, check);
      return res.status(200).json({ ok: true });
    }

    await markPagamentoPago(pagamento.id, { transactionNsu: transaction_nsu, metodo: check.capture_method });
    const agora = new Date();
    await renewSubscription(pagamento.assinatura_id, {
      vencimentoEm: toSqlDateTime(new Date(agora.getTime() + 30 * 86400000)),
      ultimoPagamentoEm: toSqlDateTime(agora),
      infinitepayOrderNsu: order_nsu,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    // 200 mesmo em erro: devolver 400 faria a InfinitePay re-tentar
    // indefinidamente por um problema que pode ser transitório do nosso
    // lado. O responsável ainda consegue confirmar reabrindo o app
    // (GET /status reflete o estado real assim que reprocessarmos).
    console.error('[subscription/webhook] erro ao verificar pagamento', err);
    res.status(200).json({ ok: true });
  }
});

export default router;
