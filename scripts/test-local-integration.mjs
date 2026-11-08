import { spawnSync } from "node:child_process";
import { localOwnerUrl, localRuntimeUrl } from "./local-db-config.mjs";

const test = spawnSync("pnpm", ["exec", "vitest", "run", "tests/integration/postgres-flow.test.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    RUN_NEON_INTEGRATION: "1",
    TEST_DATABASE_URL: localOwnerUrl,
    TEST_RUNTIME_DATABASE_URL: localRuntimeUrl,
  },
});
process.exit(test.status ?? 1);
