import { parseArgs } from 'node:util';
import { assertDestructiveCommandAllowed } from '@studdy/configuration';
import { seedCleanRegistration } from './scenarios/clean-registration';

/**
 * Scenario-based seeding (Blueprint §5): `pnpm db:seed --scenario clean_registration`.
 * Additional scenarios (multi_tutor_request_pending, one_tutor_accepted, …)
 * land with their slices (brief §12).
 */
const SCENARIOS: Record<string, () => Promise<void>> = {
  clean_registration: seedCleanRegistration,
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
