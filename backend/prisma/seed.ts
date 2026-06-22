import { prisma } from '../src/core/database.js';

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clean existing data
  await prisma.crmOutbox.deleteMany();
  await prisma.agentTrajectory.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.contentLibrary.deleteMany();

  // 2. Create Companies
  const acme = await prisma.company.create({
    data: {
      name: 'Acme Corporation',
      domain: 'acme.com',
      industry: 'Manufacturing',
      size: '51-200',
      website: 'https://acme.com',
    },
  });

  const techsoft = await prisma.company.create({
    data: {
      name: 'TechSoft Solutions',
      domain: 'techsoft.io',
      industry: 'Software',
      size: '11-50',
      website: 'https://techsoft.io',
    },
  });

  console.log('Companies created.');

  // 3. Create Contacts
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
    },
  });

  console.log('Contacts created.');

  // 4. Create Deals
  await prisma.deal.create({
    data: {
      name: 'Acme Enterprise License',
      companyId: acme.id,
      contactId: alice.id,
      stage: 'DISCOVERY',
      amount: 12000.0,
      status: 'OPEN',
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
    },
  });

  console.log('Deals created.');

  // 5. Create Content Library Documents (RAG)
  await prisma.contentLibrary.create({
    data: {
      companyId: acme.id,
      title: 'Troubleshooting Onboarding Setup',
      content: 'To troubleshoot onboarding setup errors, ensure that your client configuration points to the correct region. Restart the server and clear your browser cache. If the client fails to connect, verify your API keys in the dashboard config panel.',
      category: 'SUPPORT_GUIDES',
      embedding: Array(1536).fill(0.01),
    },
  });

  await prisma.contentLibrary.create({
    data: {
      companyId: techsoft.id,
      title: 'SalesGenius Pricing Packages',
      content: 'SalesGenius has three pricing tiers: Starter at $50/user/month (up to 5 users), Professional at $99/user/month (up to 50 users), and Enterprise at $150/user/month (unlimited users + dedicated agent workflows).',
      category: 'PRICING_PLANS',
      embedding: Array(1536).fill(0.02),
    },
  });

  console.log('Content library populated.');
  console.log('🚀 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
