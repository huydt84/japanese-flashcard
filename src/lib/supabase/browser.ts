import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const env = supabaseEnv();
  client ??= createBrowserClient(env.url, env.publishableKey);
  return client;
}

