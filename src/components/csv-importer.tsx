"use client";

import { useActionState, useMemo, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { parseCardCsv } from "@/lib/csv";
import { initialActionState, type StatefulAction } from "@/lib/action-state";

const csvHeader = "kanji,hiragana,meaning_vi,example_ja,example_vi\n";

export function CsvImporter({ action }: { action: StatefulAction }) {
  const [csv, setCsv] = useState(csvHeader);
  const parsed = useMemo(() => parseCardCsv(csv), [csv]);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      <div>
        <label className="label" htmlFor="csv">Dữ liệu CSV</label>
        <textarea id="csv" name="csv" value={csv} onChange={(event) => setCsv(event.target.value)} rows={7} className="field font-mono text-sm" spellCheck={false} />
      </div>

      {parsed.errors.length ? (
        <div role="alert" className="rounded-xl bg-wrong/10 p-4 text-sm font-semibold text-wrong">
          {parsed.errors.slice(0, 4).map((error) => <p key={`${error.line}-${error.message}`}>Dòng {error.line}: {error.message}</p>)}
          {parsed.errors.length > 4 ? <p>Và {parsed.errors.length - 4} lỗi khác.</p> : null}
        </div>
      ) : parsed.rows.length ? (
        <div>
          <p className="text-sm font-semibold text-correct">Xem trước {parsed.rows.length} thẻ hợp lệ</p>
          <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-line" tabIndex={0} aria-label="Bảng xem trước CSV">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted"><tr><th className="p-3">Kanji</th><th className="p-3">Hiragana</th><th className="p-3">Nghĩa</th></tr></thead>
              <tbody className="divide-y divide-line">{parsed.rows.slice(0, 20).map((row, index) => <tr key={`${row.kanji}-${index}`}><td className="p-3 font-jp font-bold">{row.kanji}</td><td className="p-3 font-jp">{row.hiragana}</td><td className="p-3">{row.meaning_vi}</td></tr>)}</tbody>
            </table>
          </div>
          {parsed.rows.length > 20 ? <p className="mt-2 text-xs text-muted">Hiển thị 20 thẻ đầu tiên.</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Dán dữ liệu bên dưới dòng tiêu đề để xem trước.</p>
      )}

      {state.message ? <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm font-semibold ${state.status === "error" ? "text-wrong" : "text-correct"}`}>{state.message}</p> : null}
      <button className="button-secondary" disabled={pending || parsed.errors.length > 0 || parsed.rows.length === 0}>
        {pending ? <CircleNotch size={18} className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Đang nhập" : "Nhập danh sách"}
      </button>
    </form>
  );
}
