"use client";

import { useActionState, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { initialActionState, type StatefulAction } from "@/lib/action-state";
import { CARD_CSV_SAMPLE, CARD_IMPORT_HEADERS } from "@/lib/card-import";

export function CsvImporter({ action }: { action: StatefulAction }) {
  const [source, setSource] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(async (previous: typeof initialActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.status === "success") {
      setText("");
      if (fileRef.current) fileRef.current.value = "";
    }
    return next;
  }, initialActionState);

  return (
    <form action={formAction} onReset={(event) => event.preventDefault()} className="min-w-0 space-y-5" aria-busy={pending}>
      <input type="hidden" name="import_format" value="csv" />
      <div className="space-y-3 text-sm text-muted">
        <p>Tải tệp CSV UTF-8 hoặc dán nội dung CSV. Mỗi hàng là một thẻ, với đủ 5 cột theo thứ tự:</p>
        <p className="break-words font-mono text-ink">{CARD_IMPORT_HEADERS.join(", ")}</p>
        <a href="/api/card-import-template/csv" download className="quiet-link inline-flex min-h-11 items-center font-semibold">Tải tệp CSV mẫu</a>
      </div>

      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <legend className="label">Cách nhập CSV</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="radio" name="csv_source" value="file" checked={source === "file"} onChange={() => setSource("file")} className="accent-brand" />Tải tệp CSV
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="radio" name="csv_source" value="text" checked={source === "text"} onChange={() => setSource("text")} className="accent-brand" />Dán nội dung CSV
          </label>
        </div>
        <div hidden={source !== "file"}>
          <label className="label" htmlFor="csv-file">Chọn tệp CSV (.csv)</label>
          <input ref={fileRef} id="csv-file" name="csv_file" type="file" accept=".csv,text/csv" required disabled={source !== "file"} aria-describedby="csv-help" className="field min-w-0 cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-ink" />
        </div>
        <div hidden={source !== "text"}>
          <label className="label" htmlFor="csv-text">Nội dung CSV</label>
          <textarea id="csv-text" name="csv_text" rows={9} value={text} onChange={(event) => setText(event.target.value)} required disabled={source !== "text"} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder={CARD_CSV_SAMPLE} aria-describedby="csv-help" className="field min-h-48 resize-y font-mono text-sm" />
        </div>
      </fieldset>

      <p id="csv-help" className="text-sm text-muted">Dùng dấu phẩy để phân cách cột. Đặt nội dung có dấu phẩy hoặc xuống dòng trong dấu ngoặc kép; viết dấu &quot; trong ô thành &quot;&quot;. Bỏ qua hàng trống. Tối đa 500 thẻ và 750 KB mỗi lần nhập. Nếu có lỗi, hệ thống báo số dòng và không nhập thẻ nào.</p>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`break-words text-sm font-semibold ${state.status === "error" ? "text-wrong-ink" : "text-correct-ink"}`}>{state.message}</p> : null}
      <button className="button-secondary w-full justify-center" disabled={pending}>
        {pending ? <CircleNotch size={18} className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Đang kiểm tra và nhập" : "Kiểm tra và nhập CSV"}
      </button>
    </form>
  );
}
