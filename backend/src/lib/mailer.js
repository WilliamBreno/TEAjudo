import nodemailer from 'nodemailer';

const smtpConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // true para 465, false para 587/25 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // O padrão do nodemailer é ~2min antes de desistir — tempo demais para
    // deixar o pai esperando na tela. Se a porta SMTP estiver bloqueada
    // (comum em hospedagens grátis), falha rápido e cai no modo demo.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

export const isMailerConfigured = smtpConfigured;

// Retorna { sent: boolean }. Se o SMTP não estiver configurado, NÃO envia
// nada e avisa o chamador (a rota decide se mostra o código em modo demo).
export async function sendVerificationCodeEmail(toEmail, code) {
  if (!transporter) {
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: 'Seu código de verificação — TEAjudo',
      text: `Seu código de verificação é: ${code}\n\nEle expira em 10 minutos. Se você não pediu essa troca de PIN, pode ignorar este e-mail.`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <h2 style="color:#2F6F62;">TEAjudo</h2>
          <p>Seu código de verificação é:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color:#2F6F62;">${code}</p>
          <p style="color:#777; font-size: 13px;">Ele expira em 10 minutos. Se você não pediu essa troca de PIN, pode ignorar este e-mail.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err.message);
    return { sent: false, reason: 'send_failed' };
  }
}
