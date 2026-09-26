import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { GoogleSignIn } from "@/components/google-sign-in";
import { LandingCard } from "@/components/landing-card";
import { hasSupabaseEnv } from "@/lib/env";

export default function Home() {
  return <main className="flex min-h-[100dvh] flex-col">
    <header className="mx-auto flex h-18 max-w-[1380px] items-center justify-between px-5 sm:px-8"><Brand /><span className="hidden text-sm font-medium text-muted sm:block">  Học từ vựng bằng Flashcard</span></header>
    <section className="mx-auto grid w-full flex-1 max-w-[1380px] items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:py-16">
      <div className="max-w-2xl"><h1 className="text-balance text-[clamp(3.1rem,6vw,5.25rem)] font-bold leading-[.94] tracking-[-0.04em]">Học từ vựng<br /><span className="text-brand">tiếng Nhật.</span></h1><p className="mt-7 max-w-[48ch] text-lg leading-relaxed text-muted">Tạo bài từ vựng tiếng Nhật, mời học viên và để Kotoba sắp đúng thẻ vào đúng lúc cần ôn.</p><div className="mt-9"><GoogleSignIn configured={hasSupabaseEnv()} /></div><div className="mt-8 flex items-center gap-3 text-sm font-semibold text-muted"><ArrowRightIcon size={18} weight="bold" /><span>Kanji ở mặt trước. Cách đọc, nghĩa và ví dụ ở mặt sau.</span></div></div>
      <div className="relative flex justify-center lg:justify-end"><div className="absolute -left-2 top-10 hidden h-32 w-px bg-line lg:block" aria-hidden="true" /><LandingCard /></div>
    </section>
    <footer className="mx-auto flex w-full max-w-[1380px] flex-col gap-3 border-t border-line px-5 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <span>© 2026 Kotoba. Học đều, nhớ lâu.</span>
      <nav aria-label="Pháp lý" className="flex gap-5 font-semibold">
        <Link href="/privacy" className="rounded-sm hover:text-ink">Quyền riêng tư</Link>
        <Link href="/terms" className="rounded-sm hover:text-ink">Điều khoản</Link>
      </nav>
    </footer>
  </main>;
}
