#!/usr/bin/env node
/**
 * RLS classification gate (brief §8; Database spec §18.1):
 * every table created in generated migrations must appear in
 * packages/database/rls-classification.json with an intentional
 * classification. CI fails otherwise.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseRoot = join(repoRoot, 'packages', 'database');
const generatedDir = join(databaseRoot, 'migrations', 'generated');
const classificationPath = join(databaseRoot, 'rls-classification.json');

const classification = JSON.parse(readFileSync(classificationPath, 'utf8'));
const classifiedTables = new Set(Object.keys(classification.tables));

const createTablePattern = /CREATE TABLE(?: IF NOT EXISTS)? "([a-z_]+)"\."([a-z_]+)"/gi;

const discovered = new Set();
if (existsSync(generatedDir)) {
  for (const file of readdirSync(generatedDir)) {
    if (!file.endsWith('.sql')) continue;
    const contents = readFileSync(join(generatedDir, file), 'utf8');
    for (const match of contents.matchAll(createTablePattern)) {
      discovered.add(`${match[1]}.${match[2]}`);
    }
  }
}

const missing = [...discovered].filter((table) => !classifiedTables.has(table));
const stale = [...classifiedTables].filter((table) => !discovered.has(table));

if (discovered.size === 0) {
  console.warn('check:rls — no generated migrations found; run pnpm db:generate first.');
}

if (stale.length > 0) {
  console.warn(
    `check:rls — classifications without a matching table (review): ${stale.join(', ')}`,
  );
}

if (missing.length > 0) {
  console.error(
    `check:rls FAILED — tables missing an intentional RLS classification in packages/database/rls-classification.json:\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

console.log(`check:rls passed — ${discovered.size} tables classified.`);
