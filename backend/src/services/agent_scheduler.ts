import { prisma } from '../core/database.js';
import { researchNiche } from './web_search.js';

const SCHEDULE_INTERVAL = 60_000; // Check every 60 seconds

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startAgentScheduler() {
  if (intervalHandle) return;
  console.log('[AgentScheduler] Starting background scheduler...');
  runDueTasks();
  intervalHandle = setInterval(runDueTasks, SCHEDULE_INTERVAL);
}

export function stopAgentScheduler() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

async function runDueTasks() {
  try {
    const now = new Date();
    const dueTasks = await prisma.agentTask.findMany({
      where: { status: 'ACTIVE', nextRunAt: { lte: now } },
    });

    for (const task of dueTasks) {
      console.log(`[AgentScheduler] Running task ${task.id} (${task.type}) for agent ${task.agent}`);
      try {
        await executeTask(task);
        const nextRun = new Date(Date.now() + task.interval * 1000);
        await prisma.agentTask.update({
          where: { id: task.id },
          data: { lastRunAt: now, nextRunAt: nextRun },
        });
      } catch (err) {
        console.error(`[AgentScheduler] Task ${task.id} failed:`, err);
        await prisma.agentTask.update({
          where: { id: task.id },
          data: { status: 'FAILED' },
        });
      }
    }
  } catch (err) {
    console.error('[AgentScheduler] Error checking tasks:', err);
  }
}

async function executeTask(task: { id: string; tenantId: string; agent: string; type: string; config: any }) {
  switch (task.type) {
    case 'LEAD_ENRICHMENT':
      await runLeadEnrichment(task);
      break;
    case 'FOLLOW_UP':
      await runFollowUp(task);
      break;
    case 'PIPELINE_ADVANCE':
      await runPipelineAdvance(task);
      break;
    default:
      console.warn(`[AgentScheduler] Unknown task type: ${task.type}`);
  }
}

async function runLeadEnrichment(task: { tenantId: string; config: any }) {
  const { tenantId } = task;
  const niche = task.config.niche || 'technology startups';
  const location = task.config.location || 'United States';
  const count = task.config.leadsPerRun || 5;

  console.log(`[LeadEnrichment] Searching for ${count} ${niche} leads in ${location}`);
  const { results } = await researchNiche({ niche: `${niche} companies in ${location}`, count });

  let enriched = 0;
  for (const lead of results) {
    try {
      const existing = await prisma.contact.findFirst({ where: { email: lead.email, tenantId } });
      if (existing) continue;

      // Parse domain from website
      let domain: string | null = null;
      try { domain = new URL(lead.website).hostname.replace('www.', ''); } catch {}

      // Find or create company
      let company = await prisma.company.findFirst({ where: { domain, tenantId } });
      if (!company && lead.company) {
        company = await prisma.company.create({
          data: { name: lead.company, domain, industry: lead.industry, size: lead.size, tenant: { connect: { id: tenantId } } } as any,
        });
      }

      await prisma.contact.create({
        data: {
          name: lead.contactName,
          email: lead.email,
          role: lead.role || 'Unknown',
          stage: 'LEAD',
          source: 'AGENT',
          companyId: company?.id,
          enrichedAt: new Date(),
          tenant: { connect: { id: tenantId } },
        } as any,
      });

      // Log interaction
      if (company) {
        await prisma.interaction.create({
          data: {
            companyId: company.id,
            channel: 'NOTE',
            direction: 'OUTBOUND',
            content: `Auto-enriched lead: ${lead.contactName} - ${lead.role} at ${lead.company}`,
            summary: `Scout auto-enriched new lead from ${niche} search`,
            tenant: { connect: { id: tenantId } },
          } as any,
        });
      }

      enriched++;
    } catch (err: any) {
      if (err?.code !== 'P2002') {
        console.warn('[LeadEnrichment] Error saving lead:', err?.message);
      }
    }
  }

  console.log(`[LeadEnrichment] Enriched ${enriched} new leads`);
}

async function runFollowUp(task: { tenantId: string; config: any }) {
  const { tenantId } = task;
  const daysSinceLastContact = task.config.daysSinceLastContact || 7;
  const cutoff = new Date(Date.now() - daysSinceLastContact * 24 * 60 * 60 * 1000);

  // Find contacts in discovery stage with no recent interactions
  const staleContacts = await prisma.contact.findMany({
    where: { tenantId, stage: 'DISCOVERY', updatedAt: { lte: cutoff } },
    include: { company: true, interactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    take: 10,
  });

  for (const contact of staleContacts) {
    const lastContact = contact.interactions[0];
    if (!lastContact || lastContact.createdAt < cutoff) {
      await prisma.interaction.create({
        data: {
          contactId: contact.id,
          companyId: contact.companyId,
          channel: 'NOTE',
          direction: 'OUTBOUND',
          content: `[AUTO] Follow-up needed: No contact for ${daysSinceLastContact}+ days. Stage: ${contact.stage}. Contact name: ${contact.name}`,
          summary: `Auto-flagged stale lead for follow-up (${daysSinceLastContact}d)`,
          tenant: { connect: { id: tenantId } },
        } as any,
      });
    }
  }
}

async function runPipelineAdvance(task: { tenantId: string; config: any }) {
  const { tenantId } = task;
  const scoreThreshold = task.config.scoreThreshold || 70;
  const maxAmount = task.config.maxAmount || 10000;

  // Auto-advance qualified leads with high scores from PROSPECT to QUALIFIED
  const ready = await prisma.contact.findMany({
    where: { tenantId, stage: 'PROSPECT', score: { gte: scoreThreshold } },
    take: 10,
  });

  for (const contact of ready) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { stage: 'QUALIFIED' },
    });
    await prisma.interaction.create({
      data: {
        contactId: contact.id,
        companyId: contact.companyId,
        channel: 'NOTE',
        direction: 'OUTBOUND',
        content: `[AUTO] Pipeline advanced: PROSPECT → QUALIFIED (score: ${contact.score})`,
        summary: 'Auto-advanced by Nova pipeline task',
        tenant: { connect: { id: tenantId } },
      } as any,
    });
  }
}
