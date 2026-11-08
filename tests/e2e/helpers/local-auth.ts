import { Pool } from "pg";
import type { Page } from "@playwright/test";

const globalForTestDb = globalThis as typeof globalThis & { kotobaE2ePool?: Pool };

function pool() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("The isolated PostgreSQL test database is not configured.");
  globalForTestDb.kotobaE2ePool ??= new Pool({ connectionString, max: 2, idleTimeoutMillis: 5_000 });
  return globalForTestDb.kotobaE2ePool;
}

export async function testQuery<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
  return pool().query<Row>(sql, [...values]);
}

export async function createTestUser(email: string, role: "teacher" | "student" | "admin", name = "Local Test", activeMode: "teacher" | "student" | null = null) {
  const id = crypto.randomUUID();
  await testQuery(
    `INSERT INTO auth.users (id,name,email,"emailVerified") VALUES ($1,$2,$3,now())`,
    [id, name, email.toLowerCase()],
  );
  await testQuery(
    `UPDATE public.profiles SET role=$2::public.user_role,active_mode=$3,onboarding_completed_at=now() WHERE id=$1`,
    [id, role, activeMode],
  );
  return id;
}

export async function deleteTestUsers(ids: readonly string[]) {
  if (ids.length) await testQuery("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [ids]);
}

export async function loginAsUser(page: Page, userId: string) {
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const csrfResponse = await page.request.get(`${origin}/api/auth/csrf`);
  if (!csrfResponse.ok()) throw new Error(`Local Auth.js CSRF request failed (${csrfResponse.status()}).`);
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
  const response = await page.request.post(`${origin}/api/auth/callback/test-login`, {
    form: { csrfToken, userId, secret: process.env.TEST_AUTH_SECRET ?? "", callbackUrl: "/app", json: "true" },
    maxRedirects: 0,
  });
  const status = response.status();
  if (status < 200 || status >= 400) throw new Error(`Local Auth.js login failed (${status}).`);
}

export async function closeTestDatabase() {
  await globalForTestDb.kotobaE2ePool?.end();
  delete globalForTestDb.kotobaE2ePool;
}
