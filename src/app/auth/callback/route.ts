import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = new URL("/app", url.origin);
      try {
        const requested = new URL(next, url.origin);
        if (requested.origin === url.origin) destination = requested;
      } catch { /* Invalid return URLs use the workspace entry point. */ }
      return NextResponse.redirect(destination);
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=1", url.origin));
}
