export type AgentId = "scout" | "rep" | "closer" | "success";

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  stage: string;
  icon: string;
  tagline: string;
  description: string;
  greeting: string;
}

export interface TrajectoryStep {
  id: string;
  thought: string;
  action: string;
  params: Record<string, unknown>;
  result: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  agentId?: AgentId;
  agentName?: string;
  agentIcon?: string;
  trajectory?: TrajectoryStep[];
  createdAt: string;
}

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  agent?: AgentId;
}

// --- CRM Types ---

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  stage: string;
  status: string;
  score: number;
  source: string | null;
  tags: string[];
  enrichedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  score: number;
  tags: string[];
  createdAt: string;
  _count?: { contacts: number; deals: number };
}

export interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  status: string;
  closeReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; name: string; email: string } | null;
  company: { id: string; name: string } | null;
}

export interface AdminDashboard {
  totalContacts: number;
  totalCompanies: number;
  totalDeals: number;
  totalTickets: number;
  openDealsValue: number;
  openDealsCount: number;
  wonDealsValue: number;
  wonDealsCount: number;
  contactsByStage: { stage: string; _count: number }[];
  dealsByStage: { stage: string; _count: number; _sum: { amount: number | null } }[];
  recentContacts: Contact[];
  recentDeals: Deal[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AgentTask {
  id: string;
  agent: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  interval: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface OnboardingLink {
  id: string;
  token: string;
  status: string;
  portalUrl: string;
  expiresAt: string;
  contact: { id: string; name: string; email: string };
  company: { id: string; name: string };
}

export interface Pipeline {
  stages: { stage: string; count: number; value: number }[];
  totalValue: number;
  totalDeals: number;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export interface Interaction {
  id: string;
  channel: string;
  direction: string;
  content: string;
  createdAt: string;
  contactId?: string;
  dealId?: string;
}
