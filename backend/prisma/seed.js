// ==========================================
// Database Seed — Sample Data
// ==========================================
// Run: npm run db:seed

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  'Leadership & Vision', 'Communication Skills', 'Career Development Support',
  'Work-Life Balance', 'Fairness & Transparency', 'Conflict Resolution',
  'Empathy & Emotional Intelligence', 'Decision Making', 'Team Building',
  'Accountability', 'Technical Competence',
];

const sampleManagers = [
  { name: 'Sarah Chen', slug: 'sarachen', url: 'https://linkedin.com/in/sarachen' },
  { name: 'Michael Rodriguez', slug: 'michaelrodriguez', url: 'https://linkedin.com/in/michaelrodriguez' },
  { name: 'Priya Patel', slug: 'priyapatel', url: 'https://linkedin.com/in/priyapatel' },
  { name: 'James OBrien', slug: 'jamesobrien', url: 'https://linkedin.com/in/jamesobrien' },
  { name: 'Aiko Tanaka', slug: 'aikotanaka', url: 'https://linkedin.com/in/aikotanaka' },
];

const sampleReviews = [
  { managerSlug: 'sarachen', company: 'Amazon Web Services', pros: 'Excellent at setting clear goals. Always available for 1:1s and genuinely listens.', cons: 'Sometimes too focused on deliverables, misses morale issues.', rec: true },
  { managerSlug: 'sarachen', company: 'Amazon Web Services', pros: 'Great at fostering team collaboration and psychological safety.', cons: 'Meeting heavy. Could use async communication more.', rec: true },
  { managerSlug: 'sarachen', company: 'Meta Financial Services', pros: 'Brought strong engineering culture. Transparent about decisions.', cons: 'Still adjusting to new company culture.', rec: true },
  { managerSlug: 'michaelrodriguez', company: 'Google', pros: 'Strong technical background. Removes blockers quickly.', cons: 'Can be indecisive on cross-team issues.', rec: true },
  { managerSlug: 'michaelrodriguez', company: 'Stripe', pros: 'Excellent at conflict resolution. Finds win-win solutions.', cons: 'Needs to improve on giving constructive negative feedback.', rec: true },
  { managerSlug: 'priyapatel', company: 'Microsoft', pros: 'Very empathetic and understanding of personal situations.', cons: 'Could improve on recognizing contributions publicly.', rec: true },
  { managerSlug: 'priyapatel', company: 'Figma', pros: 'Brought incredible design leadership from Microsoft.', cons: 'Pace of change can overwhelm the team.', rec: true },
  { managerSlug: 'jamesobrien', company: 'Amazon Web Services', pros: 'Strong technical depth. Mentors engineers with patience.', cons: 'Takes on too much and becomes a bottleneck.', rec: true },
  { managerSlug: 'aikotanaka', company: 'Netflix', pros: 'Data-driven decision maker. Very fair in performance reviews.', cons: 'Could communicate vision more clearly to the team.', rec: true },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.report.deleteMany();
  await prisma.helpfulVote.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.review.deleteMany();
  await prisma.manager.deleteMany();

  // Create managers
  const managerMap = {};
  for (const m of sampleManagers) {
    const manager = await prisma.manager.create({
      data: {
        name: m.name,
        linkedinUrl: m.url,
        linkedinSlug: m.slug,
      },
    });
    managerMap[m.slug] = manager.id;
    console.log(`  ✅ Created manager: ${m.name}`);
  }

  // Create reviews with ratings
  for (const r of sampleReviews) {
    const managerId = managerMap[r.managerSlug];
    const review = await prisma.review.create({
      data: {
        managerId,
        company: r.company,
        recommends: r.rec,
        pros: r.pros,
        cons: r.cons,
        advice: 'Invest more in leadership training and mentorship.',
        status: 'published',
      },
    });

    // Random ratings per category
    const base = 2.5 + Math.random() * 2.5;
    for (const cat of CATEGORIES) {
      await prisma.rating.create({
        data: {
          reviewId: review.id,
          category: cat,
          score: Math.max(1, Math.min(5, Math.round(base + (Math.random() - 0.5) * 2))),
        },
      });
    }

    console.log(`  ✅ Created review for ${r.managerSlug} at ${r.company}`);
  }

  console.log('\n🎉 Seed complete!');
}

seed()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
