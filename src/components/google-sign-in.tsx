"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";

export function GoogleSignIn({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!configured) {
      setError("Hãy cấu hình Supabase trong .env.local để đăng nhập.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) throw authError;
    } catch {
      setError("Không thể mở đăng nhập Google. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={signIn}
        disabled={loading}
        className="button-primary w-full sm:w-auto disabled:cursor-wait disabled:opacity-60"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
          {/* Official gradient logo: https://developers.google.com/identity/branding-guidelines */}
          <Image
            src="/google-g.png"
            alt=""
            width={200}
            height={204}
            className="h-5 w-auto"
            unoptimized
          />
        </span>
        {loading ? "Đang chuyển hướng…" : "Tiếp tục với Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 max-w-sm text-sm font-medium text-wrong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
