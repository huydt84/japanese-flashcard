import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { localOwnerUrl, localRuntimeUrl } from "./local-db-config.mjs";

const { Client } = pg;
const client = new Client({ connectionString: localOwnerUrl, connectionTimeoutMillis: 2000 });
try {
  await client.connect();
  const migration = await client.query("SELECT to_regclass('public.kotoba_schema_migrations') IS NOT NULL AS ready");
  const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname='kotoba_runtime'");
  if (!migration.rows[0].ready || !role.rowCount) throw new Error("Run db:migrate:local before the authenticated browser tests.");
} catch (error) {
  if (error.message.includes("Run db:migrate:local")) throw error;
  throw new Error("Start the isolated PostgreSQL database and apply its migrations before browser tests.");
} finally { await client.end().catch(() => {}); }

const baseURL = "http://127.0.0.1:3110";
const testArgs = process.argv.slice(2);
if (testArgs[0] === "--") testArgs.shift();
const test = spawnSync("pnpm", ["exec", "playwright", "test", ...testArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: localRuntimeUrl,
    TEST_DATABASE_URL: localOwnerUrl,
    TEST_AUTH_SECRET: randomBytes(32).toString("base64url"),
    AUTH_SECRET: randomBytes(32).toString("base64url"),
    ALLOW_TEST_AUTH: "1",
    NEXT_PUBLIC_SITE_URL: baseURL,
    NEXT_DIST_DIR: ".next-playwright-local",
    RUN_AUTH_E2E: "1",
  },
});
process.exit(test.status ?? 1);
