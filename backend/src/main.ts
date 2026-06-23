import { createServer } from 'http';
import { prisma } from './core/database.js';
import app from './app.js';
import { env } from './config/env.js';
import { startCrmSyncWorker } from './services/crm_sync.js';
import { startAgentScheduler } from './services/agent_scheduler.js';

const server = createServer(app);

const activeServer = server.listen(env.PORT, () => {
  console.log(`🚀 SalesGenius API running at http://localhost:${env.PORT}`);
  startCrmSyncWorker();
  startAgentScheduler();
});

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
