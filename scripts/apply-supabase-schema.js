#!/usr/bin/env node
/**
 * Applies every migration in supabase/migrations/, in filename order, to
 * the Supabase Postgres database pointed to by SUPABASE_DB_URL. Tracks
 * which migrations have already run in a `schema_migrations` table, so
 * re-running this script only applies new migrations — unlike a single
 * `schema.sql` (this project's earlier approach), where `create table if
 * not exists` silently does nothing for a table that already exists, so a
 * later change (a new column, a new function version) never gets applied
 * on re-run. Each migration here is a real, timestamped, additive step.
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
      "Missing SUPABASE_DB_URL. Set it to your Supabase project's connection string and retry.",
    );
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error(`No migrations found in ${migrationsDir}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    // Verification stays enabled by default. The opt-in override is useful
    // for environments whose local CA bundle cannot validate the pooler chain.
    ssl: {
      rejectUnauthorized:
        process.env.SUPABASE_DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  });

  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows } = await client.query(
      'select name from schema_migrations',
    );
    const applied = new Set(rows.map((r) => r.name));

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`apply ${file}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (name) values ($1)',
          [file],
        );
        await client.query('commit');
        appliedCount += 1;
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }

    console.log(
      appliedCount === 0
        ? 'Schema already up to date.'
        : `Applied ${appliedCount} migration(s) successfully.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply schema:', error.message);
  process.exit(1);
});
