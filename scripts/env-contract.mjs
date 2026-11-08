import { readFile } from "node:fs/promises";
import { loadLocalEnv } from "./env-file.mjs";

const templateUrl = new URL("../.env.template", import.meta.url);

export async function namesMarked(marker) {
  const template = await readFile(templateUrl, "utf8");
  const suffix = `# @${marker}`;
  return template
    .split(/\r?\n/)
    .filter((line) => line.trimEnd().endsWith(suffix))
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)\s*=/)?.[1])
    .filter(Boolean);
}

export function requireEnvironment(names, source = ".env") {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value || /your[_-]|<[^>]+>/i.test(value)) throw new Error(`${name} is missing from ${source}.`);
  }
}

export function validateProductionEnvironment() {
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const databaseUrl = new URL(process.env.DATABASE_URL);

  for (const url of [siteUrl, databaseUrl]) {
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error("Production deployment cannot use a local URL.");
    }
    if (url.protocol !== "https:" && url.protocol !== "postgresql:") throw new Error("Production URLs must use HTTPS or PostgreSQL TLS.");
  }

  if (process.env.NEON_PROJECT_ID !== "jolly-morning-09908819" || !databaseUrl.hostname.endsWith(".neon.tech")) throw new Error("The Neon project or connection URL does not match this application.");
  if (decodeURIComponent(databaseUrl.username) !== "kotoba_runtime") throw new Error("Vercel must use the restricted kotoba_runtime database role.");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  if (!process.env.AUTH_GOOGLE_ID?.endsWith(".apps.googleusercontent.com") || !process.env.AUTH_GOOGLE_SECRET) throw new Error("Google OAuth client credentials are required.");
}

export async function loadDeploymentEnvironment() {
  await loadLocalEnv({ override: true });
}
