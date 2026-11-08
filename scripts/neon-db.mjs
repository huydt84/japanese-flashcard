import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadLocalEnv, readLocalEnv, writeLocalEnv } from "./env-file.mjs";

const { Client } = pg;
const projectId = "jolly-morning-09908819";
const isLocal = process.argv.includes("--local");
const action = process.argv[2] ?? "migrate";
const migrationsDirectory = resolve("database/migrations");

function safeDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("DATABASE_URL is missing or invalid."); }
  if (!url.password || !url.hostname) throw new Error("DATABASE_URL is missing database credentials.");
  if (isLocal) {
    if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) throw new Error("Local database commands only connect to loopback.");
  } else if (process.env.NEON_PROJECT_ID !== projectId || !url.hostname.endsWith(".neon.tech")) {
    throw new Error("NEON_PROJECT_ID or DATABASE_URL does not match the dedicated Neon project.");
  } else {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url;
}

function connectionUrl(source, username, password) {
  const url = new URL(source);
  url.username = username;
  url.password = password;
  return url.toString();
}

function directConnectionUrl(source) {
  const url = new URL(source);
  url.hostname = url.hostname.replace("-pooler.", ".");
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15_000, statement_timeout: 120_000, query_timeout: 125_000, application_name: "kotoba-neon-migrations" });
  try { await client.connect(); }
  catch { throw new Error("Could not connect to the configured database. Check the database settings without sharing them."); }
  return client;
}

async function verifyExistingBaseline(client) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM information_schema.columns
    WHERE table_schema='public' AND (table_name,column_name) IN (
      ('profiles','id'),('profiles','email'),('profiles','role'),('profiles','display_name'),
      ('classes','id'),('classes','teacher_id'),('classes','name'),
      ('class_memberships','class_id'),('class_memberships','student_id'),
      ('class_invitations','id'),('class_invitations','class_id'),('class_invitations','recipient_id'),
      ('lessons','id'),('lessons','class_id'),('lessons','status'),
      ('cards','id'),('cards','lesson_id'),('cards','kanji'),('cards','hiragana'),('cards','meaning_vi'),('cards','example_ja'),('cards','example_vi'),
      ('card_progress','student_id'),('card_progress','card_id'),('card_progress','due_at'),
      ('review_logs','id'),('review_logs','student_id'),('review_logs','card_id'),('review_logs','session_id'),
      ('notifications','id'),('notifications','user_id'),
      ('auth_identities','user_id'),('auth_identities','provider'),('auth_identities','provider_id')
    )`,
  );
  if (result.rows[0].count !== 34) throw new Error("Existing application data does not match the expected Kotoba schema; no migration was applied.");
}

async function hasApplicationTables(client) {
  const result = await client.query("SELECT to_regclass('public.profiles') IS NOT NULL AS exists");
  return result.rows[0].exists;
}

async function prepareRuntimeRole(ownerUrl) {
  const localEnv = await readLocalEnv();
  const existingUrl = localEnv.DATABASE_URL;
  let runtimePassword = "";
  let runtimeUrl = "";
  if (existingUrl) {
    try {
      const probe = await connect(existingUrl);
      await probe.query("SELECT 1");
      await probe.end();
      runtimeUrl = existingUrl;
    } catch { runtimeUrl = ""; }
  }
  if (runtimeUrl) {
    const url = new URL(runtimeUrl);
    if (decodeURIComponent(url.username) !== "kotoba_runtime") throw new Error(".env.local DATABASE_URL must use the kotoba_runtime account.");
    return;
  }
  runtimePassword = randomBytes(32).toString("base64url");
  const owner = await connect(directConnectionUrl(ownerUrl));
  try {
    const exists = await owner.query("SELECT 1 FROM pg_roles WHERE rolname='kotoba_runtime'");
    const passwordLiteral = runtimePassword.replaceAll("'", "''");
    if (exists.rowCount) await owner.query(`ALTER ROLE kotoba_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwordLiteral}'`);
    else await owner.query(`CREATE ROLE kotoba_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwordLiteral}'`);
  } finally { await owner.end(); }
  const generatedUrl = connectionUrl(ownerUrl, "kotoba_runtime", runtimePassword);
  await writeLocalEnv({ DATABASE_URL: generatedUrl, AUTH_SECRET: localEnv.AUTH_SECRET ?? randomBytes(32).toString("base64url") });
  const verify = await connect(generatedUrl);
  await verify.end();
}

async function run() {
  const ownerUrl = safeDatabaseUrl(process.env.NEON_MIGRATION_URL ?? process.env.DATABASE_URL);
  if (action === "prepare-runtime") {
    await prepareRuntimeRole(directConnectionUrl(ownerUrl.toString()));
    console.log(JSON.stringify({ runtimeRoleReady: true }));
    return;
  }
  // Advisory locks are session-scoped; use Neon’s direct endpoint so a pooler cannot retain the lock after disconnect.
  const client = await connect(isLocal ? ownerUrl.toString() : directConnectionUrl(ownerUrl.toString()));
  let lockHeld = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('kotoba-neon-migrations')) AS acquired");
    if (!lock.rows[0].acquired) throw new Error("Another Neon maintenance task is active. Retry after it finishes.");
    lockHeld = true;
    const tracking = await client.query("SELECT to_regclass('public.kotoba_schema_migrations') IS NOT NULL AS exists");
    if (!tracking.rows[0].exists && action === "migrate") {
      await client.query(`CREATE TABLE public.kotoba_schema_migrations (
        version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query("REVOKE ALL ON public.kotoba_schema_migrations FROM PUBLIC");
    }
    const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
    const pending = [];
    for (const filename of files) {
      const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const exists = tracking.rows[0].exists
        ? await client.query("SELECT sha256 FROM public.kotoba_schema_migrations WHERE version=$1", [filename])
        : { rowCount: 0, rows: [] };
      if (exists.rowCount) {
        if (exists.rows[0].sha256 !== sha256) throw new Error(`Applied migration ${filename} changed; add a new migration instead.`);
        continue;
      }
      if (filename === "000_app_schema.sql" && await hasApplicationTables(client)) {
        await verifyExistingBaseline(client);
        pending.push({ filename, sql: null, sha256, adopt: true });
      } else pending.push({ filename, sql, sha256, adopt: false });
    }
    if (action === "history") {
      const history = tracking.rows[0].exists
        ? await client.query("SELECT version,applied_at FROM public.kotoba_schema_migrations ORDER BY version")
        : { rows: [] };
      console.log(JSON.stringify({ migrations: history.rows.map((row) => ({ version: row.version, appliedAt: row.applied_at })) }));
      return;
    }
    if (action === "inspect") {
      const stats = await client.query(`SELECT relname AS table, n_live_tup::bigint AS estimated_rows
        FROM pg_stat_user_tables WHERE schemaname='public'
        AND relname IN ('profiles','classes','class_memberships','class_invitations','lessons','cards','card_progress','review_logs','notifications')
        ORDER BY relname`);
      console.log(JSON.stringify({ tables: stats.rows.map((row) => ({ table: row.table, estimatedRows: Number(row.estimated_rows) })) }));
      return;
    }
    if (action === "verify") {
      await verifyExistingBaseline(client);
      const rls = await client.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('profiles','classes','class_memberships','class_invitations','lessons','cards','card_progress','review_logs','notifications') AND c.relrowsecurity`);
      const auth = await client.query("SELECT to_regclass('auth.users') IS NOT NULL AS exists");
      const role = await client.query("SELECT (rolbypassrls = false AND rolsuper = false) AS safe FROM pg_roles WHERE rolname='kotoba_runtime'");
      const identity = await client.query(`SELECT
        (SELECT count(*)::int FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id WHERE u.id IS NULL) AS profiles_without_auth_users,
        (SELECT count(*)::int FROM public.auth_identities i LEFT JOIN auth.accounts a
          ON a."userId"=i.user_id AND lower(a.provider)='google' AND a."providerAccountId"=i.provider_id
          WHERE lower(i.provider)='google' AND a.id IS NULL) AS identities_without_google_accounts`);
      if (rls.rows[0].count !== 9 || !auth.rows[0].exists || !role.rows[0]?.safe
        || identity.rows[0].profiles_without_auth_users !== 0 || identity.rows[0].identities_without_google_accounts !== 0) {
        throw new Error("Neon schema, migrated identities, or runtime-role verification failed.");
      }
      console.log(JSON.stringify({ verified: true, rlsTables: rls.rows[0].count, authReady: auth.rows[0].exists, runtimeRoleSafe: role.rows[0].safe, profileIdentitiesMapped: true }));
      return;
    }
    if (action === "dry-run") {
      console.log(JSON.stringify({ pending: pending.map(({ filename, adopt }) => ({ migration: filename, action: adopt ? "adopt existing schema" : "apply" })) }));
      return;
    }
    if (action !== "migrate") throw new Error("Use prepare-runtime, migrate, dry-run, verify, inspect, or history.");
    if (pending.length && !isLocal && pending.some(({ filename }) => filename.startsWith("002_"))) await prepareRuntimeRole(ownerUrl.toString());
    if (pending.length && isLocal && pending.some(({ filename }) => filename.startsWith("002_"))) {
      const localPassword = process.env.LOCAL_DB_PASSWORD;
      if (!localPassword) throw new Error("LOCAL_DB_PASSWORD is missing from the local database runner.");
      const owner = await connect(directConnectionUrl(ownerUrl.toString()));
      const literal = localPassword.replaceAll("'", "''");
      const exists = await owner.query("SELECT 1 FROM pg_roles WHERE rolname='kotoba_runtime'");
      if (exists.rowCount) await owner.query(`ALTER ROLE kotoba_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${literal}'`);
      else await owner.query(`CREATE ROLE kotoba_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${literal}'`);
      await owner.end();
    }
    for (const migration of pending) {
      console.log(JSON.stringify({ migration: migration.filename, action: migration.adopt ? "adopting" : "applying" }));
      await client.query("BEGIN");
      try {
        if (!migration.adopt) await client.query(migration.sql);
        if (!tracking.rows[0].exists && isLocal) {
          await client.query(`CREATE TABLE IF NOT EXISTS public.kotoba_schema_migrations (
            version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
          )`);
          await client.query("REVOKE ALL ON public.kotoba_schema_migrations FROM PUBLIC");
          tracking.rows[0].exists = true;
        }
        await client.query("INSERT INTO public.kotoba_schema_migrations (version,sha256) VALUES ($1,$2)", [migration.filename, migration.sha256]);
        await client.query("COMMIT");
        console.log(JSON.stringify({ migration: migration.filename, status: "committed" }));
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.filename} failed. Database changes were rolled back.`, { cause: error });
      }
    }
    console.log(JSON.stringify({ migrated: pending.map(({ filename, adopt }) => ({ migration: filename, action: adopt ? "adopted" : "applied" })) }));
  } finally {
    try {
      if (lockHeld) await client.query("SELECT pg_advisory_unlock(hashtext('kotoba-neon-migrations'))");
    } finally { await client.end(); }
  }
}

if (isLocal) await loadLocalEnv({ override: false });
await run();
