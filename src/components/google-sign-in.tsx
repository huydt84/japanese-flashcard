import Image from "next/image";
import { signInWithGoogle } from "@/app/auth/actions";

export function GoogleSignIn({ configured }: { configured: boolean }) {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        disabled={!configured}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
          {/* Official gradient logo: https://developers.google.com/identity/branding-guidelines */}
          <Image src="/google-g.png" alt="" width={200} height={204} className="h-5 w-auto" unoptimized />
        </span>
        Tiếp tục với Google
      </button>
      {!configured ? <p className="mt-3 max-w-sm text-sm font-medium text-muted">Đăng nhập Google chưa được cấu hình.</p> : null}
    </form>
  );
}
