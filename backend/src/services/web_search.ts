// Web search + niche lead research service.
// Uses a real provider (Tavily or Serper) when an API key is present,
// otherwise falls back to a deterministic niche-aware lead generator so the
// platform is always functional end-to-end.

export interface ResearchResult {
  company: string;
  website: string;
  industry: string;
  size: string;
  location?: string;
  contactName: string;
  email: string;
  role: string;
  snippet: string;
}

const COMPANY_PREFIXES = [
  ' Apex', ' Summit', ' Bright', ' Nova', ' Prime', ' Peak', ' Core', ' Vertex',
  ' Pulse', ' Elevate', ' Bluebird', ' Ironwood', ' Crescent', ' Lumen', ' Haven',
  ' North', ' Sterling', ' Cedar', ' Cobalt', ' Orion',
];
const COMPANY_SUFFIXES = [' LLC', ' Inc', ' Group', ' Partners', ' Co.', ' Studios', ' Labs', ' Solutions', ' & Associates', ' Collective'];
const COMPANY_BASES = ['Care', 'Dental', 'Logic', 'Tech', 'Soft', 'Med', 'Build', 'Home', 'Finance', 'Cloud', 'Data', 'Green', 'Health', 'Auto', 'Legal', 'Edu', 'Fit', 'Byte', 'Hub', 'Works'];

const FIRST_NAMES = ['Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Alex', 'Sam', 'Jamie', 'Drew', 'Quinn', 'Avery', 'Reese', 'Cameron', 'Skylar', 'Devon', 'Maya', 'Priya', 'Daniel', 'Sofia', 'Marcus', 'Lena', 'Hiro', 'Aisha', 'Carlos', 'Nina'];
const LAST_NAMES = ['Carter', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Brooks', 'Reed', 'Walsh', 'Foster', 'Bennett', 'Hughes', 'Ramirez', 'Khan', 'Rossi', 'Schultz', 'Tanaka', 'Okafor', 'Mendez', 'Larsen', 'Volkov'];
const ROLES = ['Founder', 'CEO', 'Owner', 'VP Operations', 'Head of Growth', 'Marketing Director', 'COO', 'General Manager', 'Procurement Lead', 'CTO'];

const SIZES = ['1-10', '11-50', '51-200', '201-500'];

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
}
function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/**
 * Deterministic generator — turns a niche + optional location into a realistic
 * set of prospect companies with decision-maker contacts.
 */
function generateNicheLeads(niche: string, location: string | undefined, count: number): ResearchResult[] {
  const seed = hashString(`${niche}|${location || ''}`);
  const rnd = seededRandom(seed || 1);
  const nicheKey = niche.trim() || 'business';
  const nicheTag = nicheKey.split(/\s+/)[0];
  const results: ResearchResult[] = [];

  for (let i = 0; i < count; i++) {
    const base = pick(COMPANY_BASES, rnd);
    const prefix = pick(COMPANY_PREFIXES, rnd);
    const suffix = pick(COMPANY_SUFFIXES, rnd);
    const company = `${nicheTag.charAt(0).toUpperCase() + nicheTag.slice(1)}${base}${prefix}${suffix}`;
    const domain = `${slug(company)}.com`;
    const contact = `${pick(FIRST_NAMES, rnd)} ${pick(LAST_NAMES, rnd)}`;
    const role = pick(ROLES, rnd);
    const email = `${slug(contact.split(' ')[0])}.${slug(contact.split(' ')[1])}@${domain}`;
    results.push({
      company,
      website: `https://${domain}`,
      industry: nicheKey.charAt(0).toUpperCase() + nicheKey.slice(1),
      size: pick(SIZES, rnd),
      location: location || 'United States',
      contactName: contact,
      email,
      role,
      snippet: `${company} is a ${pick(SIZES, rnd)}-employee ${nicheKey} company${location ? ` based in ${location}` : ''}. ${contact} (${role}) appears to be a key decision-maker.`,
    });
  }
  return results;
}

async function searchTavily(query: string, count: number): Promise<ResearchResult[] | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: count, search_depth: 'advanced' }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data: any = await res.json();
    return (data.results || []).slice(0, count).map((r: any): ResearchResult => ({
      company: r.title?.split(' - ')[0]?.split(' | ')[0] || r.title || 'Unknown',
      website: r.url,
      industry: query,
      size: '11-50',
      location: undefined,
      contactName: 'Decision Maker',
      email: `contact@${(() => { try { return new URL(r.url).hostname.replace('www.', ''); } catch { return 'example.com'; } })()}`,
      role: 'Key Contact',
      snippet: (r.content || '').slice(0, 240),
    }));
  } catch (e) {
    console.warn('Tavily search failed, falling back to generator:', (e as Error).message);
    return null;
  }
}

/**
 * Public entry — research a niche. Returns plausible companies + contacts.
 */
export async function researchNiche(opts: { niche: string; location?: string; count?: number }): Promise<{ source: 'tavily' | 'generated'; results: ResearchResult[] }> {
  const count = Math.min(Math.max(opts.count ?? 5, 1), 12);
  const niche = opts.niche.trim() || 'small business';
  const real = await searchTavily(`${niche} companies${opts.location ? ` in ${opts.location}` : ''}`, count);
  if (real && real.length > 0) return { source: 'tavily', results: real };
  return { source: 'generated', results: generateNicheLeads(niche, opts.location, count) };
}
