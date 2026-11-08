import { spawn } from "node:child_process";
import { loadDeploymentEnvironment, namesMarked, requireEnvironment, validateProductionEnvironment } from "./env-contract.mjs";

await loadDeploymentEnvironment();
const variableNames = await namesMarked("vercel");

if (!variableNames.length) throw new Error(".env.template does not declare any deployable environment variables.");
requireEnvironment(variableNames);
requireEnvironment(["NEON_PROJECT_ID"]);
validateProductionEnvironment();

for (const name of variableNames) {
  const value = process.env[name];
  const child = spawn(
    "pnpm",
    ["exec", "vercel", "env", "add", name, "production,preview", "--force", "--yes"],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  child.stdin.end(value);
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (exitCode !== 0) throw new Error(`Vercel CLI exited with code ${exitCode}.`);
}
