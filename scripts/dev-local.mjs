import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { localRuntimeUrl } from "./local-db-config.mjs";

const nextArgs = process.argv.slice(2);
if (nextArgs[0] === "--") nextArgs.shift();
const child = spawn("pnpm", ["exec", "next", "dev", ...nextArgs], {
  env: {
    ...process.env,
    DATABASE_URL: localRuntimeUrl,
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3110",
    AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(32).toString("base64url"),
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
