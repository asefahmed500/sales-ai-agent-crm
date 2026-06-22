import type { AgentDef, SlashCommand } from "./types";

export const DEFAULT_AGENTS: AgentDef[] = [
  {
    id: "scout",
    name: "Scout",
    role: "Lead Generation",
    stage: "LEAD",
    icon: "scout",
    tagline: "Finds & qualifies new leads",
    description:
      "Searches the web for any niche, enriches and creates leads.",
    greeting:
      "Hi! I'm Scout — I find and qualify leads in any niche. Try: `/generate dental clinics in Austin`",
  },
  {
    id: "rep",
    name: "Aria",
    role: "Sales Engagement",
    stage: "DISCOVERY",
    icon: "rep",
    tagline: "Engages leads & runs discovery",
    description: "Discovery, pricing, demos, objection handling.",
    greeting:
      "Hey! I'm Aria — your sales engagement agent. Ask about pricing or pick a lead to engage.",
  },
  {
    id: "closer",
    name: "Nova",
    role: "Deal Closing",
    stage: "NEGOTIATION",
    icon: "closer",
    tagline: "Negotiates & closes deals",
    description: "Proposals, quotes, negotiation, contracts.",
    greeting:
      "I'm Nova — I close deals. Pick a lead and say `/proposal` to draft a quote.",
  },
  {
    id: "success",
    name: "Ember",
    role: "Customer Success",
    stage: "WON",
    icon: "success",
    tagline: "Onboards, supports & renews",
    description: "Onboarding, tickets, renewals, upsells.",
    greeting:
      "Hi, I'm Ember — customer success. I handle tickets and renewals. How can I help?",
  },
];

export const ACCENT: Record<
  string,
  { chip: string; dot: string; ring: string; soft: string; text: string }
> = {
  scout: {
    chip: "bg-violet-100 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    ring: "ring-violet-300",
    soft: "bg-violet-50",
    text: "text-violet-700",
  },
  rep: {
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    ring: "ring-sky-300",
    soft: "bg-sky-50",
    text: "text-sky-700",
  },
  closer: {
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-300",
    soft: "bg-amber-50",
    text: "text-amber-700",
  },
  success: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    ring: "ring-emerald-300",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/generate",
    label: "Generate leads",
    description: "Scout searches the web for a niche",
    agent: "scout",
  },
  {
    command: "/handoff",
    label: "Hand off to Sales",
    description: "Move leads to DISCOVERY for Aria",
  },
  { command: "/leads", label: "List leads", description: "Show recent contacts" },
  { command: "/pipeline", label: "Pipeline", description: "Revenue & stage summary" },
  { command: "/pricing", label: "Pricing", description: "Pricing packages", agent: "rep" },
  {
    command: "/proposal",
    label: "Draft proposal",
    description: "Nova creates a deal",
    agent: "closer",
  },
  { command: "/close", label: "Close deal", description: "Mark active deal WON", agent: "closer" },
  {
    command: "/ticket",
    label: "Open ticket",
    description: "Create a support ticket",
    agent: "success",
  },
  {
    command: "/scout",
    label: "Switch to Scout",
    description: "Lead generation agent",
    agent: "scout",
  },
  {
    command: "/rep",
    label: "Switch to Aria",
    description: "Sales engagement agent",
    agent: "rep",
  },
  {
    command: "/closer",
    label: "Switch to Nova",
    description: "Deal closing agent",
    agent: "closer",
  },
  {
    command: "/success",
    label: "Switch to Ember",
    description: "Customer success agent",
    agent: "success",
  },
  { command: "/clear", label: "Clear chat", description: "Start a fresh conversation" },
  { command: "/help", label: "Help", description: "Show all commands" },
];
