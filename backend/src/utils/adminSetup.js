#!/usr/bin/env node
// ==========================================
// Admin User Setup — CLI Script
// ==========================================
// Creates an admin user in the database.
//
// Usage:
//   node src/utils/adminSetup.js <username> <password>
//
// Example:
//   node src/utils/adminSetup.js admin YourSecurePassword123!
//
// Requirements:
//   - DATABASE_URL must be set (via .env or environment)
//   - Prisma migrations must have been run
//   - Password must be at least 12 characters with mixed complexity

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

var prisma = new PrismaClient();

// ==========================================
// CONSTANTS
// ==========================================

var BCRYPT_ROUNDS = 12;
var MIN_PASSWORD_LENGTH = 12;

// ==========================================
// VALIDATION
// ==========================================

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  username = username.trim();
  if (username.length < 2 || username.length > 50) {
    return 'Username must be 2-50 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username must be alphanumeric (underscores allowed)';
  }
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters';
  }
  if (password.length > 128) {
    return 'Password must be under 128 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  var args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('');
    console.error('Usage: node src/utils/adminSetup.js <username> <password>');
    console.error('');
    console.error('Example:');
    console.error('  node src/utils/adminSetup.js admin YourSecurePassword123!');
    console.error('');
    console.error('Password requirements:');
    console.error('  - At least ' + MIN_PASSWORD_LENGTH + ' characters');
    console.error('  - At least one uppercase letter');
    console.error('  - At least one lowercase letter');
    console.error('  - At least one number');
    console.error('  - At least one special character');
    console.error('');
    process.exit(1);
  }

  var username = args[0].trim().toLowerCase();
  var password=[REDACTED_PASSWORD]

  // Validate inputs
  var usernameError = validateUsername(username);
  if (usernameError) {
    console.error('❌ Username error: ' + usernameError);
    process.exit(1);
  }

  var passwordError = validatePassword(password);
  if (passwordError) {
    console.error('❌ Password error: ' + passwordError);
    process.exit(1);
  }

  try {
    // Check if username already exists
    var existing = await prisma.adminUser.findUnique({
      where: { username: username },
    });

    if (existing) {
      console.error('❌ Username "' + username + '" already exists.');
      console.error('   Created at: ' + existing.createdAt.toISOString());
      process.exit(1);
    }

    // Hash password with bcrypt (12 rounds)
    console.log('🔐 Hashing password (' + BCRYPT_ROUNDS + ' rounds)...');
    var passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create admin user
    var admin = await prisma.adminUser.create({
      data: {
        username: username,
        passwordHash: passwordHash,
      },
    });

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     ✅ Admin user created successfully   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  ID:       ' + admin.id.substring(0, 28) + '  ║');
    console.log('║  Username: ' + username.padEnd(29) + '║');
    console.log('║  Created:  ' + admin.createdAt.toISOString().substring(0, 19).padEnd(29) + '║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  ⚠️  Store credentials securely!         ║');
    console.log('║  ⚠️  Set ADMIN_JWT_SECRET in .env        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);

    if (error.code === 'P2021') {
      console.error('');
      console.error('   The AdminUser table does not exist.');
      console.error('   Run migrations first: npx prisma migrate dev');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
