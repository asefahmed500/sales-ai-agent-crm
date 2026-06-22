// Runtime-safe ESM seed for the Docker production image.
// Uses the Prisma 7 driver adapter directly (no tsx / no database.ts import).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/salesgenius?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.company.count();
  if (existing > 0) {
    console.log(`[seed] Database already has ${existing} companies. Skipping seed.`);
    return;
  }

  console.log('[seed] Seeding database...');

  await prisma.crmOutbox.deleteMany();
  await prisma.agentTrajectory.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.onboardingLink.deleteMany();
  await prisma.agentTask.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.contentLibrary.deleteMany();
  await prisma.tenant.deleteMany();

  // Create a tenant first
  const tenant = await prisma.tenant.create({
    data: { name: 'SalesGenius Demo' },
  });
  const { id: tenantId } = tenant;
  console.log('[seed] Tenant created.');

  const acme = await prisma.company.create({
    data: {
      name: 'Acme Corporation',
      domain: 'acme.com',
      industry: 'Manufacturing',
      size: '51-200',
      website: 'https://acme.com',
      tenantId,
    },
  });

  const techsoft = await prisma.company.create({
    data: {
      name: 'TechSoft Solutions',
      domain: 'techsoft.io',
      industry: 'Software',
      size: '11-50',
      website: 'https://techsoft.io',
      tenantId,
    },
  });

  const globex = await prisma.company.create({
    data: {
      name: 'Globex Industries',
      domain: 'globex.com',
      industry: 'Logistics',
      size: '201-500',
      website: 'https://globex.com',
      tenantId,
    },
  });

  console.log('[seed] Companies created.');

  const alice = await prisma.contact.create({
    data: {
      companyId: acme.id,
      name: 'Alice Smith',
      email: 'alice@acme.com',
      phone: '+1-555-0199',
      role: 'Procurement Manager',
      stage: 'DISCOVERY',
      status: 'ACTIVE',
      score: 45,
      tags: ['warm-lead', 'decision-maker'],
      tenantId,
    },
  });

  const bob = await prisma.contact.create({
    data: {
      companyId: techsoft.id,
      name: 'Bob Jones',
      email: 'bob@techsoft.io',
      phone: '+1-555-0245',
      role: 'CTO',
      stage: 'PROPOSAL',
      status: 'ACTIVE',
      score: 75,
      tags: ['hot-lead', 'tech-decision-maker'],
      tenantId,
    },
  });

  const carol = await prisma.contact.create({
    data: {
      companyId: globex.id,
      name: 'Carol Diaz',
      email: 'carol@globex.com',
      phone: '+1-555-0312',
      role: 'VP Operations',
      stage: 'LEAD',
      status: 'ACTIVE',
      score: 20,
      tags: ['new-lead'],
      tenantId,
    },
  });

  console.log('[seed] Contacts created.');

  await prisma.deal.create({
    data: {
      name: 'Acme Enterprise License',
      companyId: acme.id,
      contactId: alice.id,
      stage: 'DISCOVERY',
      amount: 12000.0,
      status: 'OPEN',
      tenantId,
    },
  });

  await prisma.deal.create({
    data: {
      name: 'TechSoft Platform Upgrade',
      companyId: techsoft.id,
      contactId: bob.id,
      stage: 'PROPOSAL',
      amount: 25000.0,
      status: 'OPEN',
      tenantId,
    },
  });

  console.log('[seed] Deals created.');

  await prisma.contentLibrary.create({
    data: {
      companyId: acme.id,
      title: 'Troubleshooting Onboarding Setup',
      content:
        'To troubleshoot onboarding setup errors, ensure that your client configuration points to the correct region. Restart the server and clear your browser cache. If the client fails to connect, verify your API keys in the dashboard config panel.',
      category: 'SUPPORT_GUIDES',
      embedding: Array(1536).fill(0.01),
      tenantId,
    },
  });

  await prisma.contentLibrary.create({
    data: {
      companyId: techsoft.id,
      title: 'SalesGenius Pricing Packages',
      content:
        'SalesGenius has three pricing tiers: Starter at $50/user/month (up to 5 users), Professional at $99/user/month (up to 50 users), and Enterprise at $150/user/month (unlimited users + dedicated agent workflows).',
      category: 'PRICING_PLANS',
      embedding: Array(1536).fill(0.02),
      tenantId,
    },
  });

  console.log('[seed] Content library populated.');

  // Create admin user
  const adminHash = await bcrypt.hash('admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@salesgenius.io' },
    update: {},
    create: {
      email: 'admin@salesgenius.io',
      password: adminHash,
      name: 'System Admin',
      role: 'OWNER',
      tenantId,
    },
  });
  console.log('[seed] Admin user created (admin@salesgenius.io / admin123!).');

  // Create a sample agent task for daily lead enrichment
  await prisma.agentTask.create({
    data: {
      agent: 'scout',
      type: 'LEAD_ENRICHMENT',
      status: 'ACTIVE',
      config: { niche: 'enterprise SaaS', location: 'United States', leadsPerRun: 5 },
      interval: 86400, // daily
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + 86400 * 1000),
      tenantId,
    },
  });
  console.log('[seed] Agent enrichment task created.');

  // Create a sample ticket
  await prisma.ticket.create({
    data: {
      subject: 'Welcome and Onboarding',
      description: 'New client onboarding process - welcome email and setup guide',
      priority: 'MEDIUM',
      status: 'OPEN',
      category: 'GENERAL',
      contactId: alice.id,
      companyId: acme.id,
      tenantId,
    },
  });
  console.log('[seed] Sample ticket created.');

  console.log('[seed] Seeding complete!');
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
