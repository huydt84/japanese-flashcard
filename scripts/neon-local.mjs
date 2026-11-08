import { spawn } from "node:child_process";
import net from "node:net";
import pg from "pg";
import { localDatabasePassword, localOwnerUrl } from "./local-db-config.mjs";

const { Client } = pg;
const container = "kotoba-postgres-local";
const label = "kotoba.project=japanese-flashcard";
const action = process.argv[2] ?? "status";

function run(executable, args, { capture = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    const stdout = [];
    const stderr = [];
    child.stdout?.on("data", (chunk) => stdout.push(chunk));
    child.stderr?.on("data", (chunk) => stderr.push(chunk));
    child.on("error", () => reject(new Error(`${executable} is unavailable.`)));
    child.on("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout).toString("utf8").trim())
      : reject(new Error(`${executable} failed with exit ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`)));
  });
}

async function inspectContainer() {
  try {
    const result = await run("docker", ["inspect", "--format", "{{index .Config.Labels \"kotoba.project\"}} {{.State.Running}}", container], { capture: true });
    if (!result.startsWith("japanese-flashcard ")) throw new Error("A container with the local database name exists but is not owned by this project.");
    return result.endsWith(" true");
  } catch (error) {
    if (error.message.includes("exit 1")) return null;
    throw error;
  }
}

async function portIsAvailable() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(55439, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const client = new Client({ connectionString: localOwnerUrl, connectionTimeoutMillis: 1000 });
    try { await client.connect(); await client.end(); return; }
    catch { await client.end().catch(() => {}); await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  throw new Error("Local PostgreSQL did not become ready on 127.0.0.1:55439.");
}

if (action === "status") {
  const running = await inspectContainer();
  console.log(running ? "Local PostgreSQL is running." : running === false ? "Local PostgreSQL is stopped." : "Local PostgreSQL is not created.");
} else if (action === "start") {
  const existing = await inspectContainer();
  if (existing === false) await run("docker", ["start", container]);
  else if (existing === null) {
    if (!await portIsAvailable()) throw new Error("Port 55439 is already in use; no container was started.");
    await run("docker", ["run", "--detach", "--name", container, "--label", label,
      "--env", "POSTGRES_USER=kotoba_owner", "--env", `POSTGRES_PASSWORD=${localDatabasePassword}`,
      "--env", "POSTGRES_DB=kotoba", "--publish", "127.0.0.1:55439:5432",
      "--volume", "kotoba-postgres-local:/var/lib/postgresql/data", "postgres:17.6"], { capture: true });
  }
  await waitForDatabase();
  console.log("Local PostgreSQL is ready.");
} else if (action === "stop") {
  const running = await inspectContainer();
  if (running === true) await run("docker", ["stop", container], { capture: true });
  console.log("Local PostgreSQL is stopped; its volume is preserved.");
} else if (action === "migrate") {
  await waitForDatabase();
  await run("node", ["scripts/neon-db.mjs", "migrate", "--local"], {
    env: { ...process.env, DATABASE_URL: localOwnerUrl, LOCAL_DB_PASSWORD: localDatabasePassword },
  });
} else if (action === "reset") {
  if (process.argv[3] !== "--confirm-reset-local-data") throw new Error("Reset requires --confirm-reset-local-data.");
  const client = new Client({ connectionString: localOwnerUrl });
  await client.connect();
  try { await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth"); }
  finally { await client.end(); }
  console.log("Local database schemas were reset.");
} else {
  throw new Error("Use start, stop, status, migrate, or reset.");
}
