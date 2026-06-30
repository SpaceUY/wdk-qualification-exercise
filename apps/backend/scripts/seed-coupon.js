/**
 * Seed a test cashback coupon for a given user email.
 *
 * Usage:
 *   node scripts/seed-coupon.js <email> [usdt_amount]
 *
 * Examples:
 *   node scripts/seed-coupon.js user@example.com
 *   node scripts/seed-coupon.js user@example.com 25
 *
 * Reads DB connection from .env.local (or .env as fallback).
 * Defaults to 10 USDT → 0.5 UTL cashback (5%).
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const full = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

function computeUtlCashback(usdtRaw) {
  const cashbackBps = 500n; // 5%
  const decimalAdj = 10n ** 12n; // USDT 6 dec → UTL 18 dec
  return (usdtRaw * cashbackBps * decimalAdj) / 10000n;
}

async function main() {
  loadEnv();

  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/seed-coupon.js <email> [usdt_amount]');
    process.exit(1);
  }

  const usdtWhole = parseInt(process.argv[3] ?? '10', 10);
  const usdtRaw = BigInt(usdtWhole) * 10n ** 6n; // 6 decimals
  const utlRaw = computeUtlCashback(usdtRaw);

  // 'db' is the Docker Compose service name — only valid inside the container.
  // When running from the host, remap it to localhost.
  const rawHost = process.env.DATABASE_HOST ?? 'localhost';
  const host = rawHost === 'db' ? 'localhost' : rawHost;

  const client = new Client({
    host,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME ?? 'cashback_db',
  });

  await client.connect();

  try {
    const userRes = await client.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (userRes.rowCount === 0) {
      console.error(`No user found with email: ${email}`);
      console.error('The user must have logged in at least once via the mobile app.');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;

    const code = crypto.randomBytes(16).toString('hex');
    // Fake tx hash — unique per run, not a real Sepolia hash
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    const merchantAddress = '0x' + '0'.repeat(39) + '1'; // placeholder
    const blockNumber = 0;

    await client.query(
      `INSERT INTO coupons
        (code, tx_hash, usdt_amount_raw, utl_amount_raw, merchant_address, block_number, user_id, redeemed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [code, txHash, usdtRaw.toString(), utlRaw.toString(), merchantAddress, blockNumber, userId],
    );

    console.log('Coupon seeded successfully:');
    console.log('  code          :', code);
    console.log('  user          :', email, '(' + userId + ')');
    console.log('  USDT paid     :', usdtWhole, 'USDT');
    console.log('  UTL cashback  :', Number(utlRaw) / 1e18, 'UTL');
    console.log('  utlAmountRaw  :', utlRaw.toString());
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
