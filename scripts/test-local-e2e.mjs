import { spawnSync } from "node:child_process";

if (!process.env.LOCAL_SUPABASE_URL || !process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Set LOCAL_SUPABASE_URL and LOCAL_SUPABASE_PUBLISHABLE_KEY in .env before running local browser tests.");
}

const status = spawnSync("pnpm", ["exec", "supabase", "status", "--output", "json"], { encoding: "utf8" });
if (status.status !== 0) throw new Error("Start the local Supabase stack before running browser tests.");
const start = status.stdout.indexOf("{");
const end = status.stdout.lastIndexOf("}");
if (start < 0 || end < start) throw new Error("Supabase local status returned an unexpected response.");
const local = JSON.parse(status.stdout.slice(start, end + 1));
if (new URL(local.API_URL).origin !== new URL(process.env.LOCAL_SUPABASE_URL).origin) {
  throw new Error("LOCAL_SUPABASE_URL does not point to the running local Supabase stack.");
}

const baseURL = "http://127.0.0.1:3110";
const testArgs = process.argv.slice(2);
if (testArgs[0] === "--") testArgs.shift();
const test = spawnSync("pnpm", ["exec", "playwright", "test", ...testArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    LOCAL_SITE_URL: baseURL,
    NEXT_DIST_DIR: ".next-playwright-local",
    RUN_AUTH_E2E: "1",
    TEST_SUPABASE_URL: local.API_URL,
    TEST_SUPABASE_SECRET_KEY: local.SECRET_KEY,
  },
});
process.exit(test.status ?? 1);
