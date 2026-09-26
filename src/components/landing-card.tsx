"use client";
import { useState } from "react";

export function LandingCard() {
  const [flipped, setFlipped] = useState(false);
  return <button type="button" onClick={() => setFlipped((value) => !value)} className="flip-stage paper-shadow card-enter aspect-[4/3] w-full max-w-[560px] rounded-2xl bg-surface-strong text-left transition-transform hover:-translate-y-1" aria-label={flipped ? "Chạm để xem lại kanji 学ぶ, thẻ 01 / 18" : "Chạm để lật thẻ 学ぶ, thẻ 01 / 18"}>
    <span className={`flip-plane block ${flipped ? "is-flipped" : ""}`}>
      <span className="flip-face flip-front p-7 sm:p-10"><span className="text-sm font-semibold text-muted">Chạm để lật thẻ</span><span className="font-jp text-center text-[clamp(4.5rem,12vw,8rem)] font-semibold leading-none tracking-[-0.03em]">学ぶ</span><span className="text-right text-xs font-semibold tabular-nums text-muted">01 / 18</span></span>
      <span className="flip-face flip-back p-7 sm:p-10"><span className="text-sm font-semibold text-muted">Chạm để xem lại</span><span className="space-y-6"><span className="block"><span className="font-jp block text-3xl font-semibold">まなぶ</span><span className="mt-2 block text-xl font-bold">học, học hỏi</span></span><span className="block border-t border-line pt-5"><span className="font-jp block text-lg">毎日、日本語を学びます。</span><span className="mt-2 block text-muted">Tôi học tiếng Nhật mỗi ngày.</span></span></span><span className="text-right text-xs font-semibold tabular-nums text-muted">01 / 18</span></span>
    </span>
  </button>;
}
