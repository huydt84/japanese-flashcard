const host = "127.0.0.1";
const port = 55439;
const database = "kotoba";
const owner = "kotoba_owner";
const runtime = "kotoba_runtime";
const password = "kotoba-local-only-2026";

export const localOwnerUrl = `postgresql://${owner}:${password}@${host}:${port}/${database}`;
export const localRuntimeUrl = `postgresql://${runtime}:${password}@${host}:${port}/${database}`;
export const localDatabasePassword = password;
