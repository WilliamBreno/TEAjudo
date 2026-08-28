// Cliente HTTP pro Checkout Integrado da InfinitePay (fetch nativo, sem
// SDK — mesmo padrão do lib/elevenlabs.js e lib/mailer.js). A API não usa
// API key: autentica só pelo "handle" (a InfiniteTag pública do
// recebedor) no corpo da requisição. Não existe assinatura recorrente
// nativa — cada cobrança é um link de pagamento avulso; a "recorrência"
// mensal do TEAjudo é modelada gerando um novo link a cada ciclo (ver
// routes/subscription.js e lib/subscription.js).

const CHECKOUT_BASE = 'https://api.checkout.infinitepay.io';

export function isCheckoutConfigured() {
  return !!process.env.INFINITEPAY_HANDLE;
}

function getHandle() {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) {
    const err = new Error('INFINITEPAY_HANDLE não configurado no servidor (.env)');
    err.code = 'not_configured';
    throw err;
  }
  return handle;
}

// Retorna { checkoutUrl } com a URL pra redirecionar o responsável.
export async function createPaymentLink({
  orderNsu, valorCentavos, descricao, customerName, customerEmail, redirectUrl, webhookUrl,
}) {
  const handle = getHandle();
  const body = {
    handle,
    order_nsu: orderNsu,
    items: [{ description: descricao, quantity: 1, price: valorCentavos }],
    redirect_url: redirectUrl,
  };
  if (webhookUrl) body.webhook_url = webhookUrl;
  if (customerName || customerEmail) {
    body.customer = { name: customerName, email: customerEmail };
  }

  const resp = await fetch(`${CHECKOUT_BASE}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`InfinitePay retornou status ${resp.status} ao criar o link de pagamento. ${detail}`.trim());
    err.code = 'upstream_error';
    throw err;
  }

  const data = await resp.json();
  if (!data.url) {
    const err = new Error('InfinitePay não retornou a URL do checkout.');
    err.code = 'upstream_error';
    throw err;
  }
  return { checkoutUrl: data.url };
}

// Consulta independente do status de uma transação — nunca confiamos só
// no corpo do webhook (a InfinitePay não assina/autentica o payload que
// envia), então todo pagamento confirmado passa por aqui antes de
// atualizar o banco. Retorna { success, paid, amount, paid_amount,
// installments, capture_method }.
export async function checkPayment({ orderNsu, transactionNsu, slug }) {
  const handle = getHandle();
  const resp = await fetch(`${CHECKOUT_BASE}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`InfinitePay retornou status ${resp.status} ao verificar o pagamento. ${detail}`.trim());
    err.code = 'upstream_error';
    throw err;
  }
  return resp.json();
}
