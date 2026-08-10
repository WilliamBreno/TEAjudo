const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM;

const mailerConfigured = !!(SENDGRID_API_KEY && SENDGRID_FROM);

export const isMailerConfigured = mailerConfigured;

// Envia via API HTTP da SendGrid (porta 443), não SMTP — hospedagens grátis
// (Render, Railway, etc.) costumam bloquear a saída em portas de SMTP
// (25/587) para conter spam, o que fazia o envio travar por minutos até
// dar timeout. HTTP não tem esse problema.
// Retorna { sent: boolean }. Se não estiver configurado, NÃO envia nada e
// avisa o chamador (a rota decide se mostra o código em modo demo).
export async function sendVerificationCodeEmail(toEmail, code) {
  if (!mailerConfigured) {
    return { sent: false, reason: 'mailer_not_configured' };
  }
  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: SENDGRID_FROM, name: 'TEAjudo' },
        subject: 'Seu código de verificação — TEAjudo',
        content: [
          {
            type: 'text/plain',
            value: `Seu código de verificação é: ${code}\n\nEle expira em 10 minutos. Se você não pediu essa troca de PIN, pode ignorar este e-mail.`,
          },
          {
            type: 'text/html',
            value: `
              <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
                <h2 style="color:#2F6F62;">TEAjudo</h2>
                <p>Seu código de verificação é:</p>
                <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color:#2F6F62;">${code}</p>
                <p style="color:#777; font-size: 13px;">Ele expira em 10 minutos. Se você não pediu essa troca de PIN, pode ignorar este e-mail.</p>
              </div>
            `,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Falha ao enviar e-mail (SendGrid):', resp.status, detail);
      return { sent: false, reason: 'send_failed' };
    }
    return { sent: true };
  } catch (err) {
    console.error('Falha ao enviar e-mail (SendGrid):', err.message);
    return { sent: false, reason: 'send_failed' };
  }
}
