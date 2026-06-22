import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { prisma } from './core/database.js';
import { router as apiRouter } from './api/endpoints.js';
import { router as authRouter } from './api/auth.js';
import { router as crmRouter } from './api/crm.js';
import { router as clientRouter } from './api/client.js';
import { router as onboardingRouter } from './api/onboarding.js';
import { router as documentsRouter } from './api/documents.js';
import { startCrmSyncWorker } from './services/crm_sync.js';
import { startAgentScheduler } from './services/agent_scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API Routes
app.use('/api', apiRouter);
app.use('/api/auth', authRouter);
app.use('/api/crm', crmRouter);
app.use('/api/client', clientRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/documents', documentsRouter);

// Root landing page
app.get('/', (_req, res) => {
  res.send(`
    <html>
      <head>
        <title>SalesGenius API</title>
      </head>
      <body style="font-family: sans-serif; background-color: #F9FBE7; color: #2D2424; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center;">
        <h1 style="font-size: 32px; background: linear-gradient(135deg, #FEA1A1 0%, #ECCDB4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">SalesGenius API Gateway</h1>
        <p style="color: #6A6A6A; font-size: 16px; margin: 0 0 24px 0;">The backend API service is running successfully.</p>
        <a href="http://localhost:3000" style="padding: 12px 24px; background: #2D2424; color: #F9FBE7; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 14px rgba(45, 36, 36, 0.2); transition: background 0.2s;">Open Frontend Dashboard (Port 3000)</a>
        <div style="margin-top:16px;font-size:13px;color:#888;">
          Auth: POST /api/auth/login | CRM: /api/crm/* | Client: /api/client/* | Onboarding: /api/onboarding/*
        </div>
      </body>
    </html>
  `);
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message || 'Something went wrong' });
});

// Start Server and handle connections
const activeServer = server.listen(PORT, () => {
  console.log(`🚀 SalesGenius API running at http://localhost:${PORT}`);
  startCrmSyncWorker();
  startAgentScheduler();
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('Shutting down server gracefully...');
  activeServer.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Database connection disconnected.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
