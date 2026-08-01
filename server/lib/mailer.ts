import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587');
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const transporter = nodemailer.createTransport({
  host: host || 'smtp.ethereal.email',
  port,
  auth: user ? {
    user,
    pass,
  } : undefined,
});

// Neutral platform sender. The from-address is NOT tenant-branded.
const FROM = process.env.SMTP_FROM || '"Egebeya" <noreply@egebeya.et>';

// Never log raw PII. When an address is printed it is truncated so support
// can still tell which mailbox a stub went to.
function redact(addr: string | undefined): string {
  if (!addr) return '<none>';
  const at = addr.indexOf('@');
  const local = at === -1 ? addr : addr.slice(0, at);
  const domain = at === -1 ? '' : addr.slice(at);
  return `${local.slice(0, 3)}***${domain}`;
}

export const sendMail = async (options: nodemailer.SendMailOptions) => {
  if (!host) {
    console.log('[MAILER STUB] Would send email to:', redact(String(options.to ?? '')));
    console.log('[MAILER STUB] Subject:', options.subject);
    return { messageId: 'stub-message-id' };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      ...options
    });
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
