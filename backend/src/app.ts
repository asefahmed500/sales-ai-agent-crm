import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { router as authRouter } from './features/auth/auth.routes.js';
import { router as crmRouter } from './features/crm/crm.routes.js';
import { router as clientRouter } from './features/client/client.routes.js';
import { router as onboardingRouter } from './features/onboarding/onboarding.routes.js';
import { router as documentsRouter } from './features/documents/documents.routes.js';
import { router as chatRouter } from './features/chat/chat.routes.js';
import { router as publicRouter } from './features/public/public.routes.js';
import { router as notificationsRouter } from './features/notifications/notifications.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/crm', crmRouter);
app.use('/api/client', clientRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/documents', documentsRouter);
app.use('/api', chatRouter);
app.use('/api', publicRouter);
app.use('/api', notificationsRouter);

// Root landing page
app.get('/', (_req, res) => {
  res.send(`
    <html>
      <head><title>SalesGenius API</title></head>
      <body style="font-family: sans-serif; background-color: #F9FBE7; color: #2D2424; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center;">
        <h1 style="font-size: 32px; background: linear-gradient(135deg, #FEA1A1 0%, #ECCDB4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">SalesGenius API Gateway</h1>
        <p style="color: #6A6A6A; font-size: 16px; margin: 0 0 24px 0;">The backend API service is running successfully.</p>
        <a href="${env.FRONTEND_URL}" style="padding: 12px 24px; background: #2D2424; color: #F9FBE7; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 14px rgba(45, 36, 36, 0.2); transition: background 0.2s;">Open Frontend Dashboard</a>
        <div style="margin-top:16px;font-size:13px;color:#888;">
          Auth: POST /api/auth/login | CRM: /api/crm/* | Client: /api/client/* | Onboarding: /api/onboarding/*
        </div>
      </body>
    </html>
  `);
});

app.use(errorHandler);

export default app;
