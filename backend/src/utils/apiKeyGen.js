// ==========================================
// API Key Generator — ManagerRate Pro
// ==========================================
// Usage:
//   node src/utils/apiKeyGen.js <orgName> <email> <plan>
//
// Example:
//   node src/utils/apiKeyGen.js "Acme Corp" "admin@acme.com" "growth"
//
// Output:
//   Organization created: Acme Corp (growth plan)
//   API Key: mr_live_a1b2c3d4e5f6...  ← SAVE THIS — shown only once!
//
// The key is hashed before storage. The plaintext is NEVER stored.

const crypto = require('crypto');

/**
 * Generate a secure, prefixed API key.
 * Format: mr_live_<40 hex chars>
 * Total: 48 characters
 */
function generateApiKey() {
  const random = crypto.randomBytes(20).toString('hex'); // 40 hex chars
  return `mr_live_${random}`;
}

/**
 * Hash an API key for storage. Uses SHA-256.
 * The same key always produces the same hash (for lookup).
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get permissions array based on plan.
 */
function getPermissionsForPlan(plan) {
  const base = ['managers:read', 'stats:read'];

  switch (plan) {
    case 'starter':
      return [...base, 'reports:read'];
    case 'growth':
      return [...base, 'reports:read', 'dashboard:read', 'bulk:read'];
    case 'enterprise':
      return [...base, 'reports:read', 'dashboard:read', 'bulk:read', 'export:read', 'admin:read'];
    default:
      return base;
  }
}

/**
 * Get rate limit based on plan.
 */
function getRateLimitForPlan(plan) {
  switch (plan) {
    case 'starter':    return 1000;   // 1K/hour
    case 'growth':     return 5000;   // 5K/hour
    case 'enterprise': return 50000;  // 50K/hour
    default:           return 100;    // Free: 100/hour
  }
}

// ==========================================
// CLI MODE — Run from command line
// ==========================================

async function createOrgAndKey(orgName, email, plan, companyName) {
  // Late require so the module can be imported without DB in tests
  const prisma = require('../config/database');

  const validPlans = ['free', 'starter', 'growth', 'enterprise'];
  if (!validPlans.includes(plan)) {
    throw new Error(`Invalid plan: ${plan}. Must be one of: ${validPlans.join(', ')}`);
  }

  // Generate the key
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const permissions = getPermissionsForPlan(plan);
  const rateLimit = getRateLimitForPlan(plan);

  // Create org + key in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Check if org already exists
    let org = await tx.organization.findUnique({ where: { email } });

    if (org) {
      console.log(`  Organization already exists: ${org.name} (${org.plan})`);
      // Update plan if different
      if (org.plan !== plan) {
        org = await tx.organization.update({
          where: { id: org.id },
          data: { plan },
        });
        console.log(`  Plan updated to: ${plan}`);
      }
    } else {
      org = await tx.organization.create({
        data: {
          name: orgName,
          email,
          plan,
          companyName: companyName || null,
        },
      });
      console.log(`  Organization created: ${org.name} (${plan} plan)`);
    }

    // Create the API key
    const apiKey = await tx.apiKey.create({
      data: {
        keyHash,
        organizationId: org.id,
        name: `${orgName} - Primary Key`,
        permissions,
        rateLimit,
        // Starter/Growth: 1 year expiry. Enterprise: no expiry.
        expiresAt: plan !== 'enterprise'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    return { org, apiKey };
  });

  return {
    organization: result.org,
    apiKeyId: result.apiKey.id,
    plainKey,  // Only time this is available!
    permissions,
    rateLimit,
    expiresAt: result.apiKey.expiresAt,
  };
}

// Run as CLI script
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node src/utils/apiKeyGen.js <orgName> <email> <plan> [companyName]');
    console.log('Plans: free, starter, growth, enterprise');
    console.log('');
    console.log('Example:');
    console.log('  node src/utils/apiKeyGen.js "Acme Corp" "admin@acme.com" "growth" "Acme Corp"');
    process.exit(1);
  }

  const [orgName, email, plan, companyName] = args;

  require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

  createOrgAndKey(orgName, email, plan, companyName)
    .then((result) => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  API KEY GENERATED — SAVE THIS NOW!                     ║');
      console.log('║  This key is shown ONLY ONCE and cannot be recovered.   ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Key: ${result.plainKey}`);
      console.log(`║  Plan: ${result.organization.plan}`);
      console.log(`║  Permissions: ${result.permissions.join(', ')}`);
      console.log(`║  Rate Limit: ${result.rateLimit}/hour`);
      console.log(`║  Expires: ${result.expiresAt ? result.expiresAt.toISOString() : 'Never'}`);
      console.log('╚══════════════════════════════════════════════════════════╝');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { generateApiKey, hashApiKey, getPermissionsForPlan, getRateLimitForPlan, createOrgAndKey };
