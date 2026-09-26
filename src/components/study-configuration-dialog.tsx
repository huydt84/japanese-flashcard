"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ArrowRight, CaretDown, X } from "@phosphor-icons/react";
import type { StudyActivity, StudyConfiguration } from "@/lib/types";

type Props = {
  activity: StudyActivity;
  config: StudyConfiguration;
  preview: boolean;
  available: number;
  scopeCount: number;
  returnFocusTo: HTMLElement | null;
  fallbackFocus: RefObject<HTMLHeadingElement | null>;
  onChange: (config: StudyConfiguration) => void;
  onClose: () => void;
  onStart: () => void;
};

export function StudyConfigurationDialog({ activity, config, preview, available, scopeCount, returnFocusTo, fallbackFocus, onChange, onClose, onStart }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const quiz = activity === "quiz";
  const valid = available > 0 && (config.count === "all" || (Number.isInteger(config.count) && config.count >= 1 && config.count <= available));

  useEffect(() => {
    const dialog = dialogRef.current!;
    const fallback = fallbackFocus.current;
    const overflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
      else if (fallback?.isConnected) fallback.focus({ preventScroll: true });
    };
  }, [returnFocusTo, fallbackFocus]);

  return (
    <dialog ref={dialogRef} className="study-dialog paper-shadow" aria-labelledby="study-config-title" aria-describedby="study-config-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
        if (!controls.length) return;
        // Safari may otherwise skip buttons depending on system keyboard settings.
        event.preventDefault();
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next].focus();
      }}>
      <form className="flex min-h-0 flex-col" onSubmit={(event) => { event.preventDefault(); if (valid) onStart(); }}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 id="study-config-title" className="text-2xl font-bold">{quiz ? "Trắc nghiệm" : "Thẻ ghi nhớ"}</h2>
            <p id="study-config-description" className="mt-2 text-sm leading-relaxed text-muted">Chọn cách học phù hợp với bạn.</p>
          </div>
          <button type="button" className="icon-button -mr-2 -mt-2 shrink-0" aria-label="Đóng cài đặt" onClick={onClose}><X size={22} aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 space-y-5 overflow-y-auto p-6">
          <div>
            <label className="label" htmlFor="study-config-direction">Chiều học</label>
            <span className="relative block">
              <select id="study-config-direction" className="field study-direction min-h-11" value={config.direction} onChange={(event) => onChange({ ...config, direction: event.target.value as StudyConfiguration["direction"] })}>
                <option value="front-first">{quiz ? "Kanji → Nghĩa tiếng Việt" : "Mặt Kanji trước"}</option>
                <option value="back-first">{quiz ? "Nghĩa tiếng Việt → Kanji" : "Mặt cách đọc và nghĩa trước"}</option>
              </select>
              <CaretDown size={16} weight="bold" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </span>
          </div>
          {!preview && <div>
            <label className="label" htmlFor="study-config-scope">Từ vựng để học</label>
            <span className="relative block">
              <select id="study-config-scope" className="field study-direction min-h-11" value={config.scope} onChange={(event) => onChange({ ...config, scope: event.target.value as StudyConfiguration["scope"] })}>
                <option value="due">Thẻ đến hạn và chưa học</option>
                <option value="all">Tất cả từ vựng</option>
              </select>
              <CaretDown size={16} weight="bold" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </span>
          </div>}
          <fieldset>
            <legend className="label">{quiz ? "Số câu hỏi" : "Số thẻ"}</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input className="size-5 accent-brand" type="checkbox" checked={config.count === "all"} onChange={(event) => onChange({ ...config, count: event.target.checked ? "all" : Math.min(10, available) })} />
              Học tất cả ({available})
            </label>
            {config.count !== "all" && <div className="mt-2">
              <label htmlFor="study-config-count" className="label">{quiz ? "Số câu trong phiên" : "Số thẻ trong phiên"}</label>
              <input id="study-config-count" className="field" type="number" inputMode="numeric" min={1} max={Math.max(1, available)} step={1} required value={config.count || ""} onChange={(event) => onChange({ ...config, count: event.target.value === "" ? 0 : Number(event.target.value) })} aria-describedby="study-config-available" />
            </div>}
            <p id="study-config-available" className="mt-2 text-sm text-muted">{available} {quiz ? "câu hỏi phù hợp" : "thẻ có thể học"}.</p>
          </fieldset>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-line pt-4 font-semibold">
            {quiz ? "Tráo thứ tự câu hỏi" : "Tráo thứ tự thẻ"}
            <input className="size-5 shrink-0 accent-brand" type="checkbox" checked={config.shuffle} onChange={(event) => onChange({ ...config, shuffle: event.target.checked })} />
          </label>
          <p className="rounded-xl bg-surface p-4 text-sm leading-relaxed text-muted">
            {preview ? "Xem thử, không lưu kết quả học tập." : quiz ? "Điểm trắc nghiệm chỉ dùng để luyện tập, không thay đổi lịch ôn." : "Mỗi câu trả lời sẽ cập nhật lịch ôn của thẻ, kể cả khi chọn tất cả từ vựng."}
          </p>
          {quiz && available < scopeCount && <p className="text-sm leading-relaxed text-muted">Đã bỏ qua từ trùng lặp hoặc có nhiều đáp án cho cùng một câu hỏi.</p>}
          {!available && <p role="status" className="text-sm font-semibold leading-relaxed text-muted">
            {config.scope === "due" && !scopeCount ? "Chưa có thẻ đến hạn. Chọn tất cả từ vựng để tiếp tục luyện tập." : quiz ? "Cần ít nhất hai đáp án khác nhau và một câu hỏi không trùng nghĩa. Hãy đổi chiều học hoặc chọn thẻ ghi nhớ." : "Bài học chưa có từ vựng để bắt đầu."}
          </p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-line p-6">
          <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="button-primary whitespace-nowrap" disabled={!valid}>Bắt đầu <ArrowRight size={18} aria-hidden="true" /></button>
        </footer>
      </form>
    </dialog>
  );
}
