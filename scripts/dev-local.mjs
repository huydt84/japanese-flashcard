import { spawn } from "node:child_process";

const required = ["LOCAL_SITE_URL", "LOCAL_SUPABASE_URL", "LOCAL_SUPABASE_PUBLISHABLE_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is missing from .env.`);
}

const child = spawn("pnpm", ["exec", "next", "dev"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SITE_URL: process.env.LOCAL_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.LOCAL_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY,
    ALLOW_TEST_AUTH: "1",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
