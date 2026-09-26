"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { initialActionState, type StatefulAction } from "@/lib/action-state";

const columns = [
  ["A", "kanji", "Từ hoặc chữ Hán", "学ぶ"],
  ["B", "hiragana", "Cách đọc bằng hiragana", "まなぶ"],
  ["C", "meaning_vi", "Nghĩa tiếng Việt", "học, học hỏi"],
  ["D", "example_ja", "Câu ví dụ tiếng Nhật", "毎日、日本語を学びます。"],
  ["E", "example_vi", "Bản dịch câu ví dụ", "Tôi học tiếng Nhật mỗi ngày."],
] as const;

export function XlsxImporter({ action }: { action: StatefulAction }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status, state.revision]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" aria-busy={pending}>
      <div className="space-y-3 text-sm text-muted">
        <p>Tải tệp mẫu, thay dòng ví dụ bằng thẻ của bạn, rồi lưu dưới dạng <strong className="text-ink">Excel (.xlsx)</strong>.</p>
        <a href="/api/card-import-template" download className="quiet-link inline-flex min-h-11 items-center font-semibold">Tải tệp Excel mẫu</a>
      </div>

      <div>
        <h3 className="text-sm font-bold">Cách sắp xếp bảng Excel</h3>
        <p className="mt-2 text-sm text-muted">Dùng trang tính đầu tiên. Hàng 1 phải có đúng 5 tiêu đề dưới đây, theo thứ tự A–E; bắt đầu nhập thẻ từ hàng 2. Mỗi hàng là một thẻ.</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line" tabIndex={0} aria-label="Quy cách 5 cột của tệp Excel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-strong text-muted"><tr><th className="p-2">Cột</th><th className="p-2">Tiêu đề hàng 1</th><th className="p-2">Nội dung</th><th className="p-2">Ví dụ hàng 2</th></tr></thead>
            <tbody className="divide-y divide-line">{columns.map(([letter, key, description, example]) => <tr key={key}><td className="p-2 font-bold">{letter}</td><td className="break-all p-2 font-mono">{key}</td><td className="p-2">{description}</td><td className="p-2 font-jp">{example}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">Điền đủ cả 5 ô bằng văn bản; không dùng công thức, số hoặc ngày. Có thể để trống cả hàng, nhưng không thêm cột khác. Tối đa 500 thẻ và 750 KB mỗi tệp. Nếu có lỗi, hệ thống sẽ báo số hàng và không nhập thẻ nào.</p>
      </div>

      <div>
        <label className="label" htmlFor="xlsx-file">Chọn tệp Excel (.xlsx)</label>
        <input id="xlsx-file" name="xlsx" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="field w-full cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-ink" />
      </div>

      {state.message ? <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm font-semibold ${state.status === "error" ? "text-wrong" : "text-correct"}`}>{state.message}</p> : null}
      <button className="button-secondary w-full justify-center" disabled={pending}>
        {pending ? <CircleNotch size={18} className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Đang kiểm tra và nhập" : "Kiểm tra và nhập thẻ"}
      </button>
    </form>
  );
}
