import { Router } from 'express';
import { notify } from '../../server/lib/notifications';
import { requireAuth } from './middleware/auth';

const router = Router();

// Only mounted when ENABLE_TEST_ENDPOINTS=true (see src/api/index.ts). Never
// shipped in production.
router.use(requireAuth({ roles: ['owner'] }));

router.post('/send-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });

  try {
    const outcome = await notify({
      channel: 'email',
      template: 'test',
      to: { email: to },
      subject: 'Test email from Egebeya',
      text: 'This is a test email to verify connectivity.',
    });
    if (!outcome.ok) throw new Error(outcome.error || 'send failed');
    res.json({ success: true, message: 'Test email sent successfully', info: { providerId: outcome.providerId } });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email', details: error.message });
  }
});

export default router;
