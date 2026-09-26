import { spawn } from "node:child_process";
import { namesMarked, requireEnvironment, validateProductionEnvironment } from "./env-contract.mjs";

const action = process.argv[2];
const projectRef = process.env.SUPABASE_PROJECT_REF;
const actions = {
  link: ["link", "--project-ref", projectRef, "--yes"],
  list: ["migration", "list", "--project-ref", projectRef],
  inspect: ["inspect", "db", "table-stats", "--project-ref", projectRef],
  "dry-run": ["db", "push", "--project-ref", projectRef, "--dry-run", "--yes"],
  push: ["db", "push", "--project-ref", projectRef, "--yes"],
};

if (!actions[action]) throw new Error(`Unknown Supabase action: ${action ?? "(missing)"}.`);
requireEnvironment(await namesMarked("supabase-cli"));
requireEnvironment(await namesMarked("vercel"));
validateProductionEnvironment();

const child = spawn("pnpm", ["exec", "supabase", ...actions[action]], {
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
