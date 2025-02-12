import express from 'express';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

router.post('/send-email', async (req, res) => {
  try {
    const { pdfBytes, clientEmail } = req.body;
    const info = await sendEmail(pdfBytes, clientEmail);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 