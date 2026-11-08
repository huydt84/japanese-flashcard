import { chmod, readFile, writeFile } from "node:fs/promises";

const path = ".env.local";

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, value.lastIndexOf('"')); }
  }
  if (value.startsWith("'")) return value.slice(1, value.lastIndexOf("'"));
  return value.replace(/\s+#.*$/, "").trim();
}

export function parseEnvFile(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values[match[1]] = parseValue(match[2]);
  }
  return values;
}

export async function readLocalEnv() {
  try { return parseEnvFile(await readFile(path, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return {}; throw error; }
}

export async function loadLocalEnv({ override = true } = {}) {
  const values = await readLocalEnv();
  for (const [name, value] of Object.entries(values)) {
    if (override || process.env[name] === undefined) process.env[name] = value;
  }
  return values;
}

export async function writeLocalEnv(updates) {
  let lines = [];
  try { lines = (await readFile(path, "utf8")).split(/\r?\n/); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  for (const [name, value] of Object.entries(updates)) {
    const encoded = `${name}=${JSON.stringify(value)}`;
    const index = lines.findIndex((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] === name);
    if (index < 0) lines.push(encoded);
    else lines[index] = encoded;
  }
  const content = lines.join("\n").replace(/\n*$/, "\n");
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}
