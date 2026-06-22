import { prisma } from '../core/database.js';

const POLL_INTERVAL_MS = 5000;
let isRunning = false;

/**
 * Start the background sync worker.
 */
export function startCrmSyncWorker() {
  console.log('🔄 Starting CRM Outbox Background Sync Worker...');
  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await processPendingOutboxEvents();
    } catch (err) {
      console.error('Error in CRM Sync loop:', err);
    } finally {
      isRunning = false;
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Process pending events in the outbox queue.
 */
async function processPendingOutboxEvents() {
  const pendingEvents = await prisma.crmOutbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  if (pendingEvents.length === 0) return;

  console.log(`Processing ${pendingEvents.length} pending CRM sync events...`);

  for (const event of pendingEvents) {
    try {
      // Mark event as processing
      await prisma.crmOutbox.update({
        where: { id: event.id },
        data: { status: 'PROCESSING' },
      });

      // Simulate external API call (e.g. HubSpot, Salesforce)
      await syncWithExternalApi(event.eventType, event.payload);

      // Mark event as completed
      await prisma.crmOutbox.update({
        where: { id: event.id },
        data: { status: 'COMPLETED' },
      });

      console.log(`✓ Event ${event.id} (${event.eventType}) synchronized successfully.`);
    } catch (err: any) {
      console.error(`✗ Failed to sync event ${event.id}:`, err.message);

      const nextRetryCount = event.retryCount + 1;
      const status = nextRetryCount >= 5 ? 'FAILED' : 'PENDING'; // Fail after 5 retries

      await prisma.crmOutbox.update({
        where: { id: event.id },
        data: {
          status,
          retryCount: nextRetryCount,
          errorMessage: err.message || 'Unknown integration error',
        },
      });
    }
  }
}

/**
 * Mock external integration API request.
 */
async function syncWithExternalApi(eventType: string, payload: any) {
  // Simulate network latency (500ms)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulating random network failure (5% chance)
  if (Math.random() < 0.05) {
    throw new Error('Integration Gateway Timeout (HubSpot Connection Refused)');
  }

  // Handle specific sync rules
  switch (eventType) {
    case 'contact.update':
      // Call HubSpot update contact endpoint simulation
      break;
    case 'deal.create':
      // Call Salesforce create lead endpoint simulation
      break;
    default:
      // General integration handler
      break;
  }
}
