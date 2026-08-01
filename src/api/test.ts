import { Router } from 'express';
import { sendMail } from '../../server/lib/mailer';
import { requireAuth } from './middleware/auth';

const router = Router();

// Only mounted when ENABLE_TEST_ENDPOINTS=true (see src/api/index.ts). Never
// shipped in production.
router.use(requireAuth({ roles: ['owner'] }));

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
