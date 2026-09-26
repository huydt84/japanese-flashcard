import { readFile } from "node:fs/promises";

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
    if (!value || /^(your_|<)/i.test(value)) throw new Error(`${name} is missing from ${source}.`);
  }
}

export function validateProductionEnvironment() {
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const projectRef = process.env.SUPABASE_PROJECT_REF.trim();

  for (const url of [siteUrl, supabaseUrl]) {
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error(`${url.hostname} is a local address and cannot be used for production deployment.`);
    }
    if (url.protocol !== "https:") throw new Error(`${url.href} must use HTTPS for production deployment.`);
  }

  if (supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    throw new Error("SUPABASE_PROJECT_REF does not match NEXT_PUBLIC_SUPABASE_URL.");
  }
}
