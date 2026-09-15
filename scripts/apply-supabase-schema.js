#!/usr/bin/env node
/**
 * Applies supabase/schema.sql to the Supabase Postgres database pointed to
 * by SUPABASE_DB_URL. Run once after creating the Supabase project, and
 * again any time schema.sql changes.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run supabase:schema
 *
 * Find this connection string in Supabase dashboard:
 *   Project Settings -> Database -> Connection string (URI, "Session" mode).
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      'Missing SUPABASE_DB_URL. Set it to your Supabase project\'s connection string and retry.',
    );
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    console.log(`Applying ${sqlPath} ...`);
    await client.query(sql);
    console.log('Schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply schema:', error.message);
  process.exit(1);
});
