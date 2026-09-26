import { spawnSync } from "node:child_process";
import { namesMarked, requireEnvironment, validateProductionEnvironment } from "./env-contract.mjs";

requireEnvironment(await namesMarked("supabase-cli"));
requireEnvironment(await namesMarked("vercel"));
validateProductionEnvironment();

const result = spawnSync(
  "pnpm",
  ["exec", "supabase", "db", "dump", "--project-ref", process.env.SUPABASE_PROJECT_REF, "--schema", "public"],
  { encoding: "utf8", env: process.env, maxBuffer: 20 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error("Unable to inspect the production schema.");
  process.exit(result.status ?? 1);
}

const schema = result.stdout;
const checks = {
  "initial schema": ["profiles", "classes", "lessons", "cards", "card_progress", "review_logs", "notifications"]
    .every((name) => schema.includes(`CREATE TABLE IF NOT EXISTS \"public\".\"${name}\"`)),
  "admin workspace": schema.includes('CREATE OR REPLACE FUNCTION "public"."set_admin_mode"'),
  "card reordering": schema.includes('CREATE OR REPLACE FUNCTION "public"."move_card"'),
  "invited class visibility": schema.includes('CREATE POLICY "students read invited classes"'),
  "fixed review schedule": schema.includes('CREATE OR REPLACE FUNCTION "public"."record_review_v2"')
    && schema.includes('"good_streak" smallint') && schema.includes('"last_rating" "public"."review_rating"'),
};

for (const [name, present] of Object.entries(checks)) console.log(`${name}: ${present ? "present" : "missing"}`);
if (!checks["initial schema"] || !checks["admin workspace"] || !checks["card reordering"] || !checks["fixed review schedule"]) process.exitCode = 1;
