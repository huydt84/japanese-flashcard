import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import pg from "pg";

const sourceProject = "fkwdrdnyzuippanyjtpf";
const targetProject = "jolly-morning-09908819";
const recoveryImage = "public.ecr.aws/supabase/postgres:17.6.1.166";
const tables = ["profiles", "classes", "class_memberships", "class_invitations", "lessons", "cards", "card_progress", "review_logs", "notifications"];
const identityColumns = ["id", "user_id", "provider", "provider_id", "identity_data", "created_at", "updated_at", "last_sign_in_at"];
const identityDefinition = `CREATE TABLE public.auth_identities (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL, provider_id text NOT NULL, identity_data jsonb NOT NULL,
  created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz,
  UNIQUE (provider, provider_id)
)`;
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const namesSql = tables.map(literal).join(",");
const action = process.argv[2] ?? "plan";
const backupArgument = process.argv[3];
const clients = new Set();
let container;
let phase = "prepare";

function command(executable, args, { input, env = process.env, allowFailure = false } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(executable, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", () => reject(new Error(`Cannot start ${executable}.`)));
    child.on("close", (code) => {
      const result = { code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };
      if (code && !allowFailure) {
        const diagnostic = result.stderr.split("\n").find((line) => /ERROR:|FATAL:/.test(line))?.replace(/"[^"]*"|'[^']*'/g, "[redacted]");
        reject(new Error(`${executable} failed with exit ${code} during ${phase}.${diagnostic ? ` ${diagnostic}` : " Output withheld to protect backup data."}`));
      }
      else done(result);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

async function recoveryQuery(sql) {
  const result = await command("docker", ["exec", "--interactive", "--user", "postgres", container, "psql", "--username", "supabase_admin", "-X", "-q", "-A", "-t", "--set", "ON_ERROR_STOP=1", "--dbname", "postgres"], { input: sql });
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function fingerprint(rows) {
  const records = rows.map((row) => JSON.stringify(stable(row))).sort();
  return { rows: rows.length, sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex") };
}

async function connect(config) {
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 20_000, statement_timeout: 60_000, query_timeout: 65_000, application_name: "kotoba-data-migration" });
  clients.add(client);
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'; SET DateStyle = 'ISO, YMD'");
  return client;
}

function neonConfiguration() {
  if (process.env.NEON_PROJECT_ID !== targetProject) throw new Error("NEON_PROJECT_ID does not match the dedicated flashcard project.");
  const url = new URL(process.env.NEON_MIGRATION_URL ?? process.env.DATABASE_URL ?? "");
  if (!url.hostname.endsWith(".neon.tech") || !url.password) throw new Error("DATABASE_URL must identify the dedicated Neon database.");
  return {
    host: url.hostname.replace("-pooler.", "."), port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true,
  };
}

async function targetSnapshot(client) {
  const snapshot = {};
  for (const name of [...tables, "auth_identities"]) {
    const { rows } = await client.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM public.${quote(name)} t`);
    snapshot[name] = fingerprint(rows[0].data);
  }
  return snapshot;
}

async function run() {
  if (!["plan", "rehearse", "apply", "verify"].includes(action) || !backupArgument) throw new Error("Usage: pnpm run db:migrate:backup <plan|rehearse|apply|verify> <backup.gz>");
  const compressed = await readFile(resolve(backupArgument));
  const backupHash = createHash("sha256").update(compressed).digest("hex");
  const sql = (await promisify(gunzip)(compressed)).toString("utf8");
  if (!sql.includes("-- Dumped from database version 17.") || !sql.includes("COPY public.profiles ")) throw new Error("Expected a PostgreSQL 17 Supabase backup containing Kotoba tables.");
  const backupCounts = {};
  let copying;
  for (const line of sql.split(/\r?\n/)) {
    if (copying) {
      if (line === "\\.") copying = undefined;
      else backupCounts[copying]++;
      continue;
    }
    const match = line.match(/^COPY (public\.[a-z_]+|auth\.identities|auth\.users) /);
    if (match) { copying = match[1]; backupCounts[copying] = 0; }
  }
  if (copying || tables.some((name) => backupCounts[`public.${name}`] === undefined)) throw new Error("Backup is incomplete.");
  const folder = resolve("backups", `supabase-${backupHash.slice(0, 16)}`);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const preservedBackup = resolve(folder, "source.backup.gz");
  if (resolve(backupArgument) !== preservedBackup) await copyFile(resolve(backupArgument), preservedBackup);
  await chmod(preservedBackup, 0o600);

  container = `kotoba-recovery-${backupHash.slice(0, 12)}-${process.pid}`;
  const recoveryPassword = randomBytes(32).toString("hex");
  phase = "start isolated recovery";
  await command("docker", ["run", "--rm", "--detach", "--name", container, "--label", "app=kotoba-data-recovery", "--publish", "127.0.0.1::5432", "--env", "POSTGRES_PASSWORD", recoveryImage], { env: { ...process.env, POSTGRES_PASSWORD: recoveryPassword } });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    // The image uses a socket-only temporary server while initializing. Wait for TCP.
    const result = await command("docker", ["exec", "--user", "postgres", container, "pg_isready", "--host", "127.0.0.1", "--username", "postgres"], { allowFailure: true });
    if (result.code === 0) { ready = true; break; }
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) throw new Error("Recovery database did not start.");
  // The image preinstalls Auth foreign keys. A cluster backup must restore into an empty database.
  phase = "prepare empty isolated database";
  await command("docker", ["exec", "--interactive", "--user", "postgres", container, "psql", "--username", "supabase_admin", "-X", "-q", "--set", "ON_ERROR_STOP=1", "--dbname", "template1"], {
    input: "DROP DATABASE postgres WITH (FORCE);\nCREATE DATABASE postgres OWNER postgres TEMPLATE template0;\n",
  });
  // A cluster dump can contain existing-role errors. Exact table hashes below gate every import.
  phase = "restore isolated backup";
  const restored = await command("docker", ["exec", "--interactive", "--user", "postgres", container, "psql", "--username", "supabase_admin", "-X", "-q", "--dbname", "postgres"], { input: sql, allowFailure: true });
  const restoreErrors = restored.stderr.split("\n").filter((line) => line.startsWith("ERROR:"));
  if (restoreErrors.some((line) => !/^ERROR:\s+role "[^"]+" already exists$/.test(line))) throw new Error("The isolated restore reported an unexpected SQL error. No destination data was changed.");
  if (restored.code) {
    const diagnostic = restored.stderr.split("\n").find((line) => /ERROR:|FATAL:/.test(line))?.replace(/"[^"]*"|'[^']*'/g, "[redacted]");
    throw new Error(`The isolated backup restore did not finish.${diagnostic ? ` ${diagnostic}` : ""}`);
  }
  phase = "verify isolated restore";
  const data = await recoveryQuery(`SET TIME ZONE 'UTC'; SET DateStyle = 'ISO, YMD'; SELECT jsonb_build_object(${tables.map((name) => `${literal(name)}, (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.${quote(name)} t)`).join(",")}, 'auth_identities', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT ${identityColumns.map(quote).join(",")} FROM auth.identities) t), 'auth_user_count', (SELECT count(*) FROM auth.users));`);
  for (const name of tables) if (data[name].length !== backupCounts[`public.${name}`]) throw new Error(`Backup restore row mismatch: ${name}.`);
  if (data.auth_identities.length !== backupCounts["auth.identities"] || data.auth_user_count !== backupCounts["auth.users"]) throw new Error(`Backup restore account counts differ: identities ${data.auth_identities.length}/${backupCounts["auth.identities"]}, users ${data.auth_user_count}/${backupCounts["auth.users"]}.`);
  const profiles = new Set(data.profiles.map((profile) => profile.id));
  if (data.auth_identities.some((identity) => !profiles.has(identity.user_id))) throw new Error("An authentication identity has no matching profile.");
  const source = Object.fromEntries([...tables, "auth_identities"].map((name) => [name, fingerprint(data[name])]));
  const report = { generatedAt: new Date().toISOString(), sourceProject, targetProject, sourceBackupSha256: backupHash, source, backupPreserved: preservedBackup, existingRoleWarnings: restoreErrors.length };
  console.log(JSON.stringify({ sourceRecovered: true, backupCounts, backupPreserved: preservedBackup }));

  phase = "connect destination";
  const target = action === "rehearse" ? await (async () => {
    await recoveryQuery(`ALTER ROLE postgres PASSWORD ${literal(recoveryPassword)}; CREATE DATABASE kotoba_neon_rehearsal OWNER postgres TEMPLATE template0;`);
    const published = await command("docker", ["port", container, "5432/tcp"]);
    const port = Number(published.stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1]);
    if (!port) throw new Error("Recovery port is not bound to loopback.");
    return connect({ host: "127.0.0.1", port, user: "postgres", password: recoveryPassword, database: "kotoba_neon_rehearsal", ssl: false });
  })() : await connect(neonConfiguration());

  const destinationTables = () => target.query("SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename");
  if (action === "plan") {
    const { rows: existing } = await destinationTables();
    report.destinationTables = existing;
    report.readyForEmptyDestinationImport = existing.length === 0;
    await writeFile(resolve(folder, "plan.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ destinationReachable: true, destinationTables: existing, readyForEmptyDestinationImport: existing.length === 0, plan: resolve(folder, "plan.json") }));
    return;
  }

  if (action === "verify") {
    phase = "verify destination";
    const actual = await targetSnapshot(target);
    if (JSON.stringify(actual) !== JSON.stringify(source)) throw new Error("Destination fingerprints differ from the source backup.");
    report.destination = actual;
    report.verified = true;
    await writeFile(resolve(folder, "verify-verified.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ verified: true, tables: actual, report: resolve(folder, "verify-verified.json") }));
    return;
  }

  phase = "lock empty destination";
  await target.query("BEGIN");
  await target.query("SELECT pg_advisory_xact_lock(hashtext('kotoba-supabase-migration'))");
  const { rows: existing } = await destinationTables();
  if (existing.length) {
    const markerExists = existing.some((table) => table.schemaname === "public" && table.tablename === "data_migrations");
    if (!markerExists) throw new Error("Destination is not empty. Refusing to overwrite existing tables.");
    const { rows } = await target.query("SELECT source_backup_sha256 FROM public.data_migrations WHERE source_project = $1", [sourceProject]);
    if (rows[0]?.source_backup_sha256 !== backupHash || JSON.stringify(await targetSnapshot(target)) !== JSON.stringify(source)) throw new Error("Destination contains a different migration or changed data. Refusing to overwrite it.");
    await target.query("ROLLBACK");
    console.log(JSON.stringify({ alreadyMigrated: true, verified: true }));
    return;
  }

  phase = "create enum types";
  const enumTypes = await recoveryQuery(`SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT typ.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_catalog.pg_type typ JOIN pg_catalog.pg_namespace ns ON ns.oid=typ.typnamespace JOIN pg_catalog.pg_enum e ON e.enumtypid=typ.oid WHERE ns.nspname='public' GROUP BY typ.typname) t;`);
  for (const type of enumTypes) await target.query(`CREATE TYPE public.${quote(type.name)} AS ENUM (${type.labels.map(literal).join(",")})`);
  phase = "create table schema";
  const dumped = await command("docker", ["exec", "--user", "postgres", container, "pg_dump", "--username", "supabase_admin", "--dbname", "postgres", "--schema-only", "--section=pre-data", "--no-owner", "--no-acl", "--no-comments", ...tables.flatMap((name) => ["--table", `public.${name}`])]);
  const ddl = dumped.stdout.split("\n").filter((line) => !line.startsWith("\\")).join("\n");
  await target.query(ddl);
  // pg_dump clears search_path; the catalog's foreign-key definitions use public names.
  await target.query("SET LOCAL search_path = public");
  const columns = await recoveryQuery(`SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN (${namesSql}) AND is_generated='NEVER' ORDER BY table_name, ordinal_position) t;`);
  for (const name of tables) {
    phase = `import ${name}`;
    const fields = columns.filter((column) => column.table_name === name).map((column) => quote(column.column_name));
    await target.query(`INSERT INTO public.${quote(name)} (${fields.join(",")}) SELECT ${fields.join(",")} FROM jsonb_populate_recordset(NULL::public.${quote(name)}, $1::jsonb)`, [JSON.stringify(data[name])]);
  }
  const constraints = await recoveryQuery(`SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT rel.relname AS table_name, c.conname AS name, c.contype AS kind, pg_get_constraintdef(c.oid) AS definition, refns.nspname AS reference_schema, refrel.relname AS reference_table FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class rel ON rel.oid=c.conrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=rel.relnamespace LEFT JOIN pg_catalog.pg_class refrel ON refrel.oid=c.confrelid LEFT JOIN pg_catalog.pg_namespace refns ON refns.oid=refrel.relnamespace WHERE ns.nspname='public' AND rel.relname IN (${namesSql}) AND c.contype IN ('p','u','f','x') ORDER BY CASE WHEN c.contype='f' THEN 1 ELSE 0 END, rel.relname, c.conname) t;`);
  for (const constraint of constraints) {
    phase = `create ${constraint.table_name} constraints`;
    if (constraint.table_name === "profiles" && constraint.reference_schema === "auth" && constraint.reference_table === "users") continue;
    if (constraint.kind === "f" && (constraint.reference_schema !== "public" || !tables.includes(constraint.reference_table))) throw new Error("An unsupported external foreign key needs review.");
    await target.query(`ALTER TABLE public.${quote(constraint.table_name)} ADD CONSTRAINT ${quote(constraint.name)} ${constraint.definition}`);
  }
  const indexes = await recoveryQuery(`SELECT COALESCE(jsonb_agg(pg_get_indexdef(i.indexrelid)), '[]'::jsonb) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class rel ON rel.oid=i.indrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=rel.relnamespace WHERE ns.nspname='public' AND rel.relname IN (${namesSql}) AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conindid=i.indexrelid);`);
  phase = "create indexes";
  for (const index of indexes) await target.query(index);
  phase = "preserve account identities";
  await target.query(identityDefinition);
  await target.query(`INSERT INTO public.auth_identities (${identityColumns.map(quote).join(",")}) SELECT ${identityColumns.map(quote).join(",")} FROM jsonb_populate_recordset(NULL::public.auth_identities, $1::jsonb)`, [JSON.stringify(data.auth_identities)]);
  // Keep all imported tables private until the server-side auth migration is deployed.
  phase = "restrict imported table access";
  for (const name of [...tables, "auth_identities"]) await target.query(`ALTER TABLE public.${quote(name)} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.${quote(name)} FROM PUBLIC`);
  phase = "compare destination fingerprints";
  const actual = await targetSnapshot(target);
  if (JSON.stringify(actual) !== JSON.stringify(source)) throw new Error("Destination fingerprints differ. The import is being rolled back.");
  await target.query("CREATE TABLE public.data_migrations (source_project text PRIMARY KEY, source_backup_sha256 text NOT NULL, manifest jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now())");
  await target.query("REVOKE ALL ON public.data_migrations FROM PUBLIC");
  await target.query("INSERT INTO public.data_migrations (source_project, source_backup_sha256, manifest) VALUES ($1, $2, $3::jsonb)", [sourceProject, backupHash, JSON.stringify(source)]);
  await target.query("COMMIT");
  report.destination = actual;
  report.verified = true;
  report.rehearsal = action === "rehearse";
  await writeFile(resolve(folder, `${action}-verified.json`), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ migrated: true, verified: true, rehearsal: action === "rehearse", tables: actual, report: resolve(folder, `${action}-verified.json`) }));
}

try {
  await run();
} catch (error) {
  // Database errors may contain row data or connection details; report only a stable code.
  console.error(error?.code ? `Migration failed during ${phase} (${error.code}); no database detail printed.` : error instanceof SyntaxError || error instanceof TypeError ? `Invalid input during ${phase}; details withheld.` : error.message);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
  if (container) await command("docker", ["stop", container], { allowFailure: true }).catch(() => { process.exitCode = 1; });
}
