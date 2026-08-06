import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assertDestructiveCommandAllowed } from '@studdy/configuration';
import { seedCleanRegistration } from './scenarios/clean-registration';
import { seedDiscoveryTutors } from './scenarios/discovery-tutors';
import {
  seedExpiredRequest,
  seedMultiTutorRequestPending,
  seedRequestRules,
} from './scenarios/request-scenarios';

// Local convenience: load apps/web/.env.local so seeding can create Supabase
// auth users without manually exporting env vars. Explicit env always wins.
try {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const envFile = readFileSync(join(repoRoot, 'apps', 'web', '.env.local'), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match !== null && match[1] !== undefined && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // No .env.local — CI and cloud environments provide env directly.
}

if (process.env['SUPABASE_SERVICE_ROLE_KEY'] === undefined) {
  console.warn(
    'WARNING: SUPABASE_SERVICE_ROLE_KEY is not set — synthetic accounts will be seeded ' +
      'without Supabase Auth users and will NOT be able to sign in.',
  );
}

/**
 * Scenario-based seeding (Blueprint §5): `pnpm db:seed --scenario clean_registration`.
 * Additional scenarios (multi_tutor_request_pending, one_tutor_accepted, …)
 * land with their slices (brief §12).
 */
const SCENARIOS: Record<string, () => Promise<void>> = {
  clean_registration: async () => {
    await seedCleanRegistration();
    await seedDiscoveryTutors();
    // Request configuration is always seeded: deadlines must be versioned
    // before any request can snapshot a deadline rule version.
    await seedRequestRules();
  },
  discovery_tutors: seedDiscoveryTutors,
  request_rules: seedRequestRules,
  multi_tutor_request_pending: seedMultiTutorRequestPending,
  request_expired: seedExpiredRequest,
};

async function main(): Promise<void> {
  // Seeding rewrites synthetic data — restricted to local by default.
  assertDestructiveCommandAllowed('db:seed', ['local', 'development']);
  const { values } = parseArgs({
    options: { scenario: { type: 'string', default: 'clean_registration' } },
  });
  const scenarioName = values.scenario ?? 'clean_registration';
  const scenario = SCENARIOS[scenarioName];
  if (scenario === undefined) {
    throw new Error(
      `Unknown scenario "${scenarioName}". Available: ${Object.keys(SCENARIOS).join(', ')}`,
    );
  }
  await scenario();
  console.log(`seed complete: ${scenarioName}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
