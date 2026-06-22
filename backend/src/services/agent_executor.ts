import { prisma } from '../core/database.js';
import { trajectoryEvents } from '../api/endpoints.js';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { getAgent, type AgentId } from '../agents.js';
import { researchNiche, type ResearchResult } from './web_search.js';

const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'openai/gpt-5.4';

interface AgentParams {
  sessionId: string;
  contactId?: string;
  message: string;
  channel: string;
  agent?: string;
  tenantId?: string;
}

export async function runAgentPipeline(params: AgentParams) {
  const { sessionId, message, channel, tenantId } = params;
  const agent = getAgent(params.agent);
  console.log(`[${agent.id}] agent loop session=${sessionId} contact=${params.contactId || 'none'}`);

  // Resolve a contact (explicit, or the most recent LEAD for Scout)
  let contact = params.contactId
    ? await prisma.contact.findUnique({
        where: { id: params.contactId },
        include: { company: true, deals: { where: { status: 'OPEN' } } },
      })
    : await prisma.contact.findFirst({
        where: { ...(tenantId ? { tenantId } : {}), stage: { in: ['LEAD', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION'] } },
        orderBy: { updatedAt: 'desc' },
        include: { company: true, deals: { where: { status: 'OPEN' } } },
      });

  const inboundData: any = {
    contactId: contact?.id,
    companyId: contact?.companyId,
    channel,
    direction: 'INBOUND',
    content: message,
    sentiment: analyzeBasicSentiment(message),
  };
  if (tenantId) inboundData.tenant = { connect: { id: tenantId } };
  const inboundInteraction = await prisma.interaction.create({ data: inboundData });

  const emitTrajectory = async (thought: string, action: string, actionParams: any, result?: string) => {
    const step = await prisma.agentTrajectory.create({
      data: { interactionId: inboundInteraction.id, thought, action, params: actionParams || {}, result, confidence: 0.9 },
    });
    trajectoryEvents.emit('update', { sessionId, interactionId: inboundInteraction.id, type: 'trajectory_step', step });
  };

  // ---- Full sales-lifecycle tool implementations (shared by LLM + fallback) ----
  const tools = makeTools({ contact, agentId: agent.id as AgentId, emitTrajectory, tenantId });

  let finalResponse: string;
  try {
    finalResponse = await runRealLLM({ message, contact, agent, tools, emitTrajectory });
  } catch (err: any) {
    console.warn(`[${agent.id}] LLM failed, running deterministic orchestrator:`, err?.cause?.message || err?.message || err);
    await emitTrajectory(`Primary LLM unavailable — ${agent.name} running deterministic orchestration`, 'orchestrator', { agent: agent.id });
    finalResponse = await runOrchestrator(message, contact, agent, tools);
  }

  const outboundData: any = {
    contactId: contact?.id,
    companyId: contact?.companyId,
    channel,
    direction: 'OUTBOUND',
    content: finalResponse,
    sentiment: 'NEUTRAL',
  };
  if (tenantId) outboundData.tenant = { connect: { id: tenantId } };
  const outboundInteraction = await prisma.interaction.create({ data: outboundData });

  await prisma.crmOutbox.create({
    data: { eventType: 'contact.update', payload: { agent: agent.id, contactId: contact?.id, message } as any, status: 'PENDING' },
  });

  trajectoryEvents.emit('update', { sessionId, interactionId: inboundInteraction.id, type: 'complete', response: finalResponse, outboundInteraction });
  console.log(`[${agent.id}] execution complete session=${sessionId}`);
}

function makeTools(opts: { contact: any; agentId: AgentId; emitTrajectory: (t: string, a: string, p?: any, r?: string) => Promise<void>; tenantId?: string }) {
  const { contact, agentId, emitTrajectory, tenantId } = opts;
  return {
    webSearch: async (niche: string, location?: string, count = 5) => {
      await emitTrajectory(`Researching the web for "${niche}" leads${location ? ` in ${location}` : ''}`, 'web_search', { niche, location, count });
      const { source, results } = await researchNiche({ niche, location, count });
      await emitTrajectory(`Found ${results.length} prospects (source: ${source})`, 'web_search_result', { source, count: results.length }, results.map((r) => r.company).join(', '));
      return { source, results };
    },
    generateLead: async (r: ResearchResult) => {
      const companyData: any = { name: r.company, domain: r.website.replace(/^https?:\/\//, '').replace(/^www\./, ''), industry: r.industry, size: r.size, website: r.website };
      if (tenantId) companyData.tenant = { connect: { id: tenantId } };
      const company = await prisma.company.create({ data: companyData });
      const contactData: any = { companyId: company.id, name: r.contactName, email: r.email, role: r.role, stage: 'LEAD', status: 'ACTIVE', score: 40, tags: [agentId, 'web-lead'] };
      if (tenantId) contactData.tenant = { connect: { id: tenantId } };
      const c = await prisma.contact.create({ data: contactData });
      await emitTrajectory(`Created lead: ${r.contactName} @ ${r.company}`, 'generate_lead', { company: r.company, contact: r.contactName }, `lead ${c.id}`);
      return c;
    },
    bulkGenerate: async (niche: string, location: string | undefined, count: number) => {
      const { source, results } = await researchNiche({ niche, location, count });
      const made: any[] = [];
      for (const r of results) {
        try {
          const cData: any = { name: r.company, domain: r.website.replace(/^https?:\/\//, '').replace(/^www\./, ''), industry: r.industry, size: r.size, website: r.website };
          if (tenantId) cData.tenant = { connect: { id: tenantId } };
          const company = await prisma.company.create({ data: cData });
          const ctData: any = { companyId: company.id, name: r.contactName, email: r.email, role: r.role, stage: 'LEAD', status: 'ACTIVE', score: 40, tags: [agentId, 'web-lead'] };
          if (tenantId) ctData.tenant = { connect: { id: tenantId } };
          const c = await prisma.contact.create({ data: ctData });
          made.push(c);
        } catch (e: any) { /* duplicate email — skip */ }
      }
      await emitTrajectory(`Generated ${made.length} leads in ${niche} (source: ${source})`, 'bulk_generate', { niche, count: made.length, source }, made.map((m) => `${m.name}`).join(', '));
      return made;
    },
    updateContactStage: async (stage: string, reason?: string) => {
      if (!contact) return 'No contact selected.';
      await prisma.contact.update({ where: { id: contact.id }, data: { stage } });
      const result = `Stage → ${stage}`;
      await emitTrajectory(reason || `Moving ${contact.name} to ${stage}`, 'update_contact_stage', { stage, reason }, result);
      return result;
    },
    createProposal: async (dealName: string, amount: number) => {
      if (!contact) return 'No contact selected.';
      const dealData: any = { name: dealName, companyId: contact.companyId, contactId: contact.id, stage: 'PROPOSAL', amount, status: 'OPEN' };
      if (tenantId) dealData.tenant = { connect: { id: tenantId } };
      const deal = await prisma.deal.create({ data: dealData });
      await prisma.contact.update({ where: { id: contact.id }, data: { stage: 'PROPOSAL' } });
      await emitTrajectory(`Drafted proposal "${dealName}" for $${amount.toLocaleString()}`, 'create_proposal', { dealName, amount }, `deal ${deal.id}`);
      return `Proposal ${deal.id} created`;
    },
    closeDeal: async (status: 'WON' | 'LOST') => {
      if (!contact) return 'No open deal.';
      const deal = await prisma.deal.findFirst({ where: { contactId: contact.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
      if (!deal) return 'No open deal.';
      await prisma.deal.update({ where: { id: deal.id }, data: { status, stage: status === 'WON' ? 'CLOSED_WON' : 'CLOSED_LOST' } });
      if (status === 'WON' && contact) await prisma.contact.update({ where: { id: contact.id }, data: { stage: 'WON' } });
      await emitTrajectory(`Marked deal ${deal.name} as ${status}`, 'close_deal', { dealId: deal.id, status });
      return `Deal ${status}`;
    },
    searchKnowledgeBase: async (query: string) => {
      await emitTrajectory(`Searching knowledge base for "${query}"`, 'search_knowledge_base', { query });
      const results = await prisma.$queryRawUnsafe<any[]>(`SELECT title, content FROM content_library WHERE content ILIKE $1 OR title ILIKE $1 LIMIT 2`, `%${query}%`);
      const text = results && results.length > 0 ? results.map((r) => `[${r.title}]: ${r.content}`).join('\n') : 'No specific article found.';
      await emitTrajectory('Knowledge base search complete', 'kb_result', { query }, text.slice(0, 120));
      return text;
    },
    createTicket: async (subject: string, description: string, priority: string, category?: string) => {
      const ticketData: any = { contactId: contact?.id, companyId: contact?.companyId, subject, description, priority, category: category || 'GENERAL' };
      if (tenantId) ticketData.tenant = { connect: { id: tenantId } };
      const ticket = await prisma.ticket.create({ data: ticketData });
      await emitTrajectory(`Created ${priority} ticket: ${subject}`, 'create_ticket', { subject, priority }, `ticket ${ticket.id}`);
      return `Ticket ${ticket.id}`;
    },
    escalate: async (reason: string, urgency = 'HIGH') => {
      await emitTrajectory(`Escalating to human: ${reason}`, 'escalate_to_human', { reason, urgency });
      return 'Escalated';
    },
    handoffToSales: async (leadIds: string[]) => {
      if (leadIds.length === 0) return 'No leads to hand off.';
      await prisma.contact.updateMany({ where: { id: { in: leadIds } }, data: { stage: 'DISCOVERY' } });
      await emitTrajectory(`Handed ${leadIds.length} leads to Sales (Aria) for engagement`, 'handoff_to_sales', { count: leadIds.length }, leadIds.join(','));
      return `Handed ${leadIds.length} leads to Aria (Sales)`;
    },
  };
}

/** Real LLM path via the AI Gateway. Throws on any error so the orchestrator runs. */
async function runRealLLM(args: { message: string; contact: any; agent: any; tools: any; emitTrajectory: any }): Promise<string> {
  const { message, contact, agent, tools, emitTrajectory } = args;
  const systemPrompt = buildSystemPrompt(contact, agent);

  const result = await generateText({
    model: CHAT_MODEL,
    system: systemPrompt,
    prompt: message,
    tools: {
      web_search: tool({
        description: 'Search the web for prospect companies in a niche and return decision-maker contacts',
        inputSchema: z.object({ niche: z.string(), location: z.string().optional(), count: z.number().optional() }),
        execute: async ({ niche, location, count }) => JSON.stringify(await tools.webSearch(niche, location, count)),
      }),
      generate_lead: tool({
        description: 'Persist a researched prospect as a lead (company + contact) in the CRM',
        inputSchema: z.object({
          company: z.string(), website: z.string(), industry: z.string(), size: z.string().optional(),
          contactName: z.string(), email: z.string(), role: z.string().optional(), snippet: z.string().optional(),
          location: z.string().optional(),
        }),
        execute: async (r) => JSON.stringify(await tools.generateLead(r as ResearchResult)),
      }),
      handoff_to_sales: tool({
        description: 'Hand generated leads to the Sales agent for engagement',
        inputSchema: z.object({ leadIds: z.array(z.string()) }),
        execute: async ({ leadIds }) => tools.handoffToSales(leadIds),
      }),
      update_contact_stage: tool({
        description: 'Move the active contact to a new sales stage',
        inputSchema: z.object({ stage: z.enum(['LEAD', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']), reason: z.string().optional() }),
        execute: async ({ stage, reason }) => tools.updateContactStage(stage, reason),
      }),
      create_proposal: tool({
        description: 'Create a deal/proposal with an amount for the active contact',
        inputSchema: z.object({ dealName: z.string(), amount: z.number() }),
        execute: async ({ dealName, amount }) => tools.createProposal(dealName, amount),
      }),
      close_deal: tool({
        description: 'Close the active deal as WON or LOST',
        inputSchema: z.object({ status: z.enum(['WON', 'LOST']) }),
        execute: async ({ status }) => tools.closeDeal(status),
      }),
      search_knowledge_base: tool({
        description: 'Search internal knowledge base (pricing, docs, guides)',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => tools.searchKnowledgeBase(query),
      }),
      create_ticket: tool({
        description: 'Create a support ticket',
        inputSchema: z.object({ subject: z.string(), description: z.string(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']), category: z.enum(['TECHNICAL', 'BILLING', 'GENERAL']).optional() }),
        execute: async ({ subject, description, priority, category }) => tools.createTicket(subject, description, priority, category),
      }),
      escalate_to_human: tool({
        description: 'Escalate to a human agent',
        inputSchema: z.object({ reason: z.string(), urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional() }),
        execute: async ({ reason, urgency }) => tools.escalate(reason, urgency),
      }),
    },
    stopWhen: stepCountIs(12),
    onStepFinish: async ({ toolCalls, toolResults }) => {
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i]; const tr = toolResults[i];
        await emitTrajectory(`Called tool: ${tc.toolName}`, tc.toolName, tc.input, typeof tr === 'string' ? tr : JSON.stringify(tr));
      }
    },
  });
  return result.text || '';
}

/**
 * Deterministic orchestrator — fully functional without an LLM.
 * Routes by active agent + intent, drives the real tools, and formats a reply.
 */
async function runOrchestrator(message: string, contact: any, agent: any, tools: any): Promise<string> {
  const lower = message.toLowerCase();
  const has = (...w: string[]) => w.some((x) => lower.includes(x));
  const name = contact?.name?.split(' ')[0] || 'there';

  // ---- Cross-agent commands ----
  if (has('/help', 'help me')) return helpText();
  if (lower.trim() === '/clear') return 'Cleared.';

  // ---- Niche lead generation / web research (Scout primary, any agent) ----
  const nicheMatch1 = message.match(/(?:leads?|prospects?|companies|clients?)\s+(?:for|in|around|near)\s+([a-zA-Z0-9 &-]+)/i);
  const nicheMatch2 = has('find', 'search', 'generate', 'prospect') ? message.match(/([a-zA-Z0-9 &-]{3,})/) : null;
  const nicheMatch = nicheMatch1 || nicheMatch2;
  const wantsLeads = has('lead', 'prospect', 'find companies', 'generate', 'research', 'niche', '/generate', '/scout');
  if (wantsLeads || lower.startsWith('/generate')) {
    const niche = nicheMatch?.[1]?.trim() || (lower.startsWith('/generate') ? message.split(/\s+/).slice(1).join(' ') : '') || 'small business';
    const cleanNiche = (niche || 'small business').replace(/\b(in|near|around|for|me|please)\b/gi, '').trim() || 'small business';
    const locMatch = message.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
    const location = locMatch?.[1];
    const count = has('few') ? 3 : has('lots', 'many', 'batch', '20', '10') ? 8 : 5;
    const made = await tools.bulkGenerate(cleanNiche, location, count);
    if (made.length === 0) return `I couldn't generate leads for "${cleanNiche}". Try a different niche?`;
    const list = made.slice(0, 8).map((m: any, i: number) => `${i + 1}. **${m.name}** — ${m.email}`).join('\n');
    return `🛰️ **Scout found ${made.length} ${cleanNiche} leads${location ? ` in ${location}` : ''}:**\n\n${list}\n\nWant me to **hand these to Aria (Sales)** for outreach? Type \`/handoff\` or switch agents with \`/rep\`.`;
  }

  if (has('/handoff', 'hand off', 'handoff', 'pass to sales', 'engage')) {
    const leads = await prisma.contact.findMany({ where: { stage: 'LEAD' }, orderBy: { createdAt: 'desc' }, take: 10 });
    if (leads.length === 0) return 'No fresh LEADs to hand off. Generate some first with `/generate <niche>`.';
    await tools.handoffToSales(leads.map((l) => l.id));
    return `🤝 Handed ${leads.length} leads to **Aria (Sales)**. They've been moved to DISCOVERY and are ready for engagement. Switch to \`/rep\` to start outreach.`;
  }

  if (has('/pipeline', 'pipeline', 'forecast')) {
    const stages = await prisma.contact.groupBy({ by: ['stage'], _count: true });
    const openDeals = await prisma.deal.aggregate({ where: { status: 'OPEN' }, _sum: { amount: true } });
    const wonDeals = await prisma.deal.aggregate({ where: { status: 'WON' }, _sum: { amount: true } });
    const lines = stages.map((s) => `• ${s.stage}: ${s._count}`).join('\n');
    return `📊 **Pipeline**\n\n${lines}\n\n💰 Open: $${(openDeals._sum.amount || 0).toLocaleString()}  |  Won: $${(wonDeals._sum.amount || 0).toLocaleString()}`;
  }

  if (has('/leads', 'list leads', 'show leads', 'contacts')) {
    const leads = await prisma.contact.findMany({ include: { company: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
    if (leads.length === 0) return 'No contacts yet. Generate some with `/generate <niche>`.';
    return leads.map((l, i) => `${i + 1}. **${l.name}** — ${l.company?.name || '—'} · ${l.stage} · ${l.email}`).join('\n');
  }

  // ---- Escalation (any agent) ----
  if (has('angry', 'furious', 'unacceptable', 'refund', 'cancel', 'lawsuit', 'terrible', 'worst', 'disappointed')) {
    await tools.escalate('Customer expressed strong negative sentiment', 'HIGH');
    return `I'm so sorry, ${name}. I've escalated this to a human teammate with HIGH urgency — they'll reach out directly. We'll make this right.`;
  }

  // ---- Agent-specific routing ----
  if (agent.id === 'closer') {
    if (has('/proposal', 'proposal', 'quote', 'contract')) {
      const amt = Number(message.match(/\$?\s?(\d[\d,]{2,})/)?.[1]?.replace(/,/g, '') || 15000);
      if (contact) { await tools.createProposal(`${contact.company?.name || 'New'} — Enterprise`, amt); return `🎯 **Nova** drafted a proposal for **${contact.name}** at **$${amt.toLocaleString()}**. Stage → PROPOSAL. Say \`/close\` when they sign!`; }
      return 'Pick a contact first (`/leads`) and I\'ll draft the proposal.';
    }
    if (has('/close', 'close deal', 'won', 'signed', 'close it')) {
      const r = await tools.closeDeal('WON');
      return `🎉 Deal ${r.includes('WON') ? 'WON' : ''}! Congrats! 🏆 The deal is marked CLOSED_WON and ${contact?.name || 'the contact'} is now in WON stage. Hand off to \`/success\` for onboarding.`;
    }
  }

  if (agent.id === 'success') {
    if (has('/ticket', 'ticket', 'broken', 'bug', 'error', 'issue', 'not working', 'help', 'support')) {
      const priority = has('urgent', 'asap', 'critical', 'down') ? 'URGENT' : 'MEDIUM';
      await tools.createTicket(message.slice(0, 80), message, priority, 'TECHNICAL');
      const kb = await tools.searchKnowledgeBase(message.slice(0, 40));
      const tip = kb && kb !== 'No specific article found.' ? `\n\n📖 Related: ${kb.slice(0, 180)}…` : '';
      return `🤝 **Ember** opened a ${priority} ticket for you${contact ? `, ${name}` : ''}.${tip}\n\nOur team is on it — anything else?`;
    }
    if (has('renew', 'renewal', 'upsell')) {
      return `🔁 Let's talk renewals! Based on ${contact?.company?.name || 'your account'}'s usage, I'd recommend the Enterprise tier. Want me to draft a renewal proposal with \`/closer\`?`;
    }
  }

  // ---- Sales / engagement (Rep + general pricing/demo) ----
  if (has('pric', 'price', 'cost', 'plan', 'tier', 'subscription', 'how much', 'quote', 'license', 'upgrade', 'package', 'budget')) {
    const kb = await tools.searchKnowledgeBase('pricing');
    if (agent.id === 'rep' && contact) await tools.updateContactStage('PROPOSAL', 'Pricing discussion');
    const snippet = kb.length > 200 ? kb.slice(0, 200) + '…' : kb;
    return `💬 **Aria** here! Here's our pricing:\n\n${snippet}\n\nWant a tailored quote? I can bring in \`/closer\` to draft a proposal.`;
  }

  if (has('demo', 'meeting', 'schedule', 'book', 'calendar', 'walkthrough')) {
    if (contact) await tools.updateContactStage('DISCOVERY', 'Demo requested');
    return `💬 I'd love to set up a demo${contact ? ` for ${name} at ${contact.company?.name || 'your team'}` : ''}! What day works this week? I'll coordinate with solutions engineering.`;
  }

  // ---- Greeting ----
  const wc = lower.replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean).length;
  if (wc <= 3 && has('hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'yo', 'sup')) {
    return `${agent.greeting}`;
  }

  // ---- Default ----
  return `${agent.icon} **${agent.name}** (${agent.role}) here. I can ${agent.description.toLowerCase()}\n\n${helpText()}`;
}

function helpText(): string {
  return `**Commands**\n• \`/generate <niche>\` — Scout finds web leads for any niche\n• \`/handoff\` — pass leads to Sales\n• \`/leads\` — list contacts\n• \`/pipeline\` — pipeline + revenue summary\n• \`/pricing\` — pricing info\n• \`/proposal\` — Nova drafts a deal (Closer)\n• \`/close\` — mark deal WON (Closer)\n• \`/ticket\` — open a support ticket (Success)\n• \`/scout\` \`/rep\` \`/closer\` \`/success\` — switch agent\n• \`/help\` — this menu`;
}

function buildSystemPrompt(contact: any, agent: any): string {
  return `You are ${agent.name}, the ${agent.role} agent at SalesGenius. Specialty: ${agent.description}

Current contact: ${contact ? `${contact.name} (${contact.email}) — ${contact.company?.name || '—'} — stage ${contact.stage}` : 'none selected'}.

You drive the full sales lifecycle. Use tools proactively:
- web_search + generate_lead to prospect any niche
- handoff_to_sales to pass leads to the Sales agent
- create_proposal + close_deal to close
- search_knowledge_base for pricing/docs
- create_ticket / escalate_to_human for support

Be warm, concise, action-oriented. Plain text. Always advance the deal.`;
}

function analyzeBasicSentiment(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('angry') || lower.includes('broken') || lower.includes('terrible') || lower.includes('cancel')) return 'NEGATIVE';
  if (lower.includes('great') || lower.includes('love') || lower.includes('awesome') || lower.includes('happy')) return 'POSITIVE';
  return 'NEUTRAL';
}
