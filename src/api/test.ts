import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { sendMail } from '../../server/lib/mailer';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/send-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });

  try {
    const info = await sendMail({
      to,
      subject: 'Test Email from Lux Nails & Spa',
      text: 'This is a test email to verify connectivity.'
    });
    res.json({ success: true, message: 'Test email sent successfully', info });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email', details: error.message });
  }
});

export default router;
