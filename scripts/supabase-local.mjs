import { spawnSync } from "node:child_process";

const action = process.argv[2];
if (!new Set(["start", "status", "stop"]).has(action)) {
  throw new Error(`Unknown local Supabase action: ${action ?? "(missing)"}.`);
}

const result = spawnSync("pnpm", ["exec", "supabase", action], { encoding: "utf8" });

if (result.status !== 0) {
  process.stderr.write(`Supabase local ${action} failed.\n`);
  process.exit(result.status ?? 1);
}

if (action === "stop") {
  console.log("Supabase local stopped. Data was preserved.");
  process.exit(0);
}

const statusResult = spawnSync("pnpm", ["exec", "supabase", "status", "--output", "json"], { encoding: "utf8" });
if (statusResult.status !== 0) {
  console.error("Supabase local status failed.");
  process.exit(statusResult.status ?? 1);
}
const output = `${statusResult.stdout}\n${statusResult.stderr}`;
const jsonStart = output.indexOf("{");
if (jsonStart < 0) throw new Error("Supabase CLI returned an unexpected response.");
const jsonEnd = output.lastIndexOf("}");
const status = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

console.log(action === "start" ? "Supabase local is ready." : "Supabase local is running.");
console.log(`API: ${status.API_URL}`);
console.log(`Studio: ${status.STUDIO_URL}`);
console.log(`Database: ${new URL(status.DB_URL).hostname}:${new URL(status.DB_URL).port}`);
