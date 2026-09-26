import { spawnSync } from "node:child_process";

if (!process.env.LOCAL_SUPABASE_URL || !process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Set LOCAL_SUPABASE_URL and LOCAL_SUPABASE_PUBLISHABLE_KEY in .env before local integration tests.");
}

const status = spawnSync("pnpm", ["exec", "supabase", "status", "--output", "json"], { encoding: "utf8" });
if (status.status !== 0) throw new Error("Start the local Supabase stack before integration tests.");
const start = status.stdout.indexOf("{");
const end = status.stdout.lastIndexOf("}");
if (start < 0 || end < start) throw new Error("Supabase local status returned an unexpected response.");
const local = JSON.parse(status.stdout.slice(start, end + 1));
if (new URL(local.API_URL).origin !== new URL(process.env.LOCAL_SUPABASE_URL).origin) {
  throw new Error("LOCAL_SUPABASE_URL does not point to the running local Supabase stack.");
}

const test = spawnSync("pnpm", ["exec", "vitest", "run", "tests/integration/supabase-flow.test.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    RUN_SUPABASE_INTEGRATION: "1",
    TEST_SUPABASE_URL: local.API_URL,
    TEST_SUPABASE_PUBLISHABLE_KEY: process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY,
    TEST_SUPABASE_SECRET_KEY: local.SECRET_KEY,
  },
});
process.exit(test.status ?? 1);
