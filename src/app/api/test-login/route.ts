import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_TEST_AUTH !== "1") return new Response(null, { status: 404 });
  const { email, password } = await request.json() as { email?: string; password?: string };
  if (!email || !password) return Response.json({ error: "missing_credentials" }, { status: 400 });
  const { error } = await (await createClient()).auth.signInWithPassword({ email, password });
  return error ? Response.json({ error: error.message }, { status: 401 }) : Response.json({ ok: true });
}

