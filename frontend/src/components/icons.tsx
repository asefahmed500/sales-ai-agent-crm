import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const ScoutIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    <path d="M7.5 7.5L10 10M14 10l2.5-2.5M7.5 16.5L10 14M16.5 16.5L14 14" opacity="0.4" />
  </svg>
);

const AriaIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 12a9 9 0 01-9 9H4.5a1.5 1.5 0 01-1.5-1.5V12a9 9 0 019-9c4.97 0 9 4.03 9 9z" />
    <path d="M8 10h8M8 14h5" opacity="0.6" />
  </svg>
);

const NovaIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);

const EmberIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 2l1.09 4.36a8 8 0 005.55 5.55L23 13l-4.36 1.09a8 8 0 00-5.55 5.55L12 24l-1.09-4.36a8 8 0 00-5.55-5.55L1 13l4.36-1.09a8 8 0 005.55-5.55L12 2z" />
    <path d="M12 8l.82 2.18a4 4 0 002.78 2.78L17.64 13 14.82 13.82" opacity="0.5" />
  </svg>
);

const SvgIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export const AGENT_ICONS: Record<string, Icon> = {
  scout: ScoutIcon,
  rep: AriaIcon,
  closer: NovaIcon,
  success: EmberIcon,
};

export function AgentIcon({ agentId, className, size = 20 }: { agentId: string; className?: string; size?: number }) {
  const Icon = AGENT_ICONS[agentId] || SvgIcon;
  return <Icon width={size} height={size} className={className} />;
}
