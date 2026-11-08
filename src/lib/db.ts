import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPool = globalThis as typeof globalThis & { kotobaPostgresPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.kotobaPostgresPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Thiếu cấu hình cơ sở dữ liệu.");
    globalForPool.kotobaPostgresPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      options: "-c search_path=auth,public",
    });
  }
  return globalForPool.kotobaPostgresPool;
}

export async function withActor<T>(actorId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [actorId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function actorQuery<Row extends QueryResultRow = QueryResultRow>(
  actorId: string,
  sql: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return withActor(actorId, (client) => client.query<Row>(sql, [...values]));
}
