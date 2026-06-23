export type AgentId = 'scout' | 'rep' | 'closer' | 'success';

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  stage: string;
  tagline: string;
  description: string;
  greeting: string;
  icon: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'Lead Generation',
    stage: 'PROSPECT',
    tagline: 'Find and qualify new leads',
    description: 'Specializes in identifying prospects, researching companies, and initiating first contact.',
    greeting: 'Ready to hunt for new leads! Give me a niche or target market, and I\'ll find prospects for you.',
    icon: 'radar',
  },
  {
    id: 'rep',
    name: 'Aria',
    role: 'Sales Engagement',
    stage: 'QUALIFIED',
    tagline: 'Engage and nurture leads',
    description: 'Handles follow-ups, discovery calls, and moves leads through the pipeline.',
    greeting: 'Hi there! I\'m Aria, your sales engagement specialist. Let\'s nurture those leads!',
    icon: 'chat',
  },
  {
    id: 'closer',
    name: 'Nova',
    role: 'Closing',
    stage: 'NEGOTIATION',
    tagline: 'Close deals with confidence',
    description: 'Expert in proposals, negotiations, and closing strategies.',
    greeting: 'Nova here — ready to close! Share a deal and I\'ll help you craft the perfect proposal.',
    icon: 'target',
  },
  {
    id: 'success',
    name: 'Ember',
    role: 'Customer Success',
    stage: 'CLOSED_WON',
    tagline: 'Delight and retain customers',
    description: 'Focuses on onboarding, support, and building long-term relationships.',
    greeting: 'Hey, I\'m Ember! Let\'s make sure your customers are happy and thriving.',
    icon: 'sparkle',
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

