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

export const sendMail = async (options: nodemailer.SendMailOptions) => {
  if (!host) {
    console.log('[MAILER STUB] Would send email to:', options.to);
    console.log('[MAILER STUB] Subject:', options.subject);
    console.log('[MAILER STUB] Text:', options.text);
    return { messageId: 'stub-message-id' };
  }
  
  try {
    const info = await transporter.sendMail({
      from: '"Lux Nails & Spa" <noreply@luxnails.egebeya.et>',
      ...options
    });
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
