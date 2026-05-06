import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ['POST'],
  })
);

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages. Réessayez dans quelques minutes.' },
});

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  senderEmail: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().min(1).max(5000),
  website: z.string().max(0).optional(),
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const { name, senderEmail, subject, message, website } = parsed.data;

  if (website && website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  const finalSubject = subject.trim() || `Message de ${name}`;
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  try {
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: process.env.MAIL_TO!,
      replyTo: senderEmail,
      subject: `[Portfolio] ${finalSubject}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px;">
          <h2 style="color: #6025F5;">Nouveau message depuis le portfolio</h2>
          <p><strong>De :</strong> ${name}</p>
          <p><strong>Email :</strong> <a href="mailto:${senderEmail}">${senderEmail}</a></p>
          <p><strong>Sujet :</strong> ${finalSubject}</p>
          <hr style="border: none; border-top: 1px solid #e8e6f0; margin: 1rem 0;">
          <p style="white-space: pre-wrap; line-height: 1.6;">${escapedMessage}</p>
        </div>
      `,
      text: `De: ${name} <${senderEmail}>\nSujet: ${finalSubject}\n\n${message}`,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({ error: 'Envoi impossible pour le moment.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API listening on :${port}`));