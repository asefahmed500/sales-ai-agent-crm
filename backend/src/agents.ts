// SalesGenius agent registry — full sales lifecycle (Lead → Engage → Close → Retain)

export type AgentId = 'scout' | 'rep' | 'closer' | 'success';

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  stage: string;
  icon: string;
  accent: string;       // tailwind color token base, e.g. 'sky'
  tagline: string;
  description: string;
  greeting: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'Lead Generation',
    stage: 'LEAD',
    icon: '🛰️',
    accent: 'violet',
    tagline: 'Finds & qualifies new leads',
    description: 'Prospecting, ICP matching, contact discovery, lead scoring and enrichment.',
    greeting: "Hi! I'm Scout 🛰️ — I find and qualify new leads. Tell me an industry or company to prospect, or type `/generate` to create a fresh lead.",
  },
  {
    id: 'rep',
    name: 'Aria',
    role: 'Sales Engagement',
    stage: 'DISCOVERY',
    icon: '💬',
    accent: 'sky',
    tagline: 'Engages leads & runs discovery',
    description: 'Discovery calls, pricing, demos, objection handling, moves deals forward.',
    greeting: "Hey! I'm Aria 💬 — your sales engagement agent. Ask me about pricing, book a demo, or pick a contact to engage.",
  },
  {
    id: 'closer',
    name: 'Nova',
    role: 'Deal Closing',
    stage: 'NEGOTIATION',
    icon: '🎯',
    accent: 'amber',
    tagline: 'Negotiates & closes deals',
    description: 'Proposals, quotes, negotiation within guardrails, contracts, payment links.',
    greeting: "I'm Nova 🎯 — I close deals. Use `/proposal` to draft a quote or `/close` to mark a deal won.",
  },
  {
    id: 'success',
    name: 'Ember',
    role: 'Customer Success',
    stage: 'WON',
    icon: '🤝',
    accent: 'emerald',
    tagline: 'Onboards, supports & renews',
    description: 'Onboarding, support tickets, health scoring, renewals, upsells.',
    greeting: "Hi, I'm Ember 🤝 — customer success. I handle onboarding, support tickets and renewals. How can I help?",
  },
];

export function getAgent(id?: string): AgentDef {
  return AGENTS.find((a) => a.id === id) || AGENTS[1];
}
