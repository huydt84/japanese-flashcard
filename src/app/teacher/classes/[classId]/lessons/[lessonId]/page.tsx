import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle, Eye, FileCsv, FileXls, PencilSimple, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { addCard, deleteCard, importCards, moveCard, publishLesson, updateCard, updateLessonTitle } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { XlsxImporter } from "@/components/xlsx-importer";
import { CsvImporter } from "@/components/csv-importer";
import { LessonTitleEditor } from "@/components/lesson-title-editor";
import { requireProfile } from "@/lib/auth";
import { getTeacherLesson } from "@/lib/queries";

const fields = [
  ["kanji", "Kanji", "学ぶ"],
  ["hiragana", "Hiragana", "まなぶ"],
  ["meaning_vi", "Nghĩa tiếng Việt", "học, học hỏi"],
  ["example_ja", "Ví dụ tiếng Nhật", "毎日、日本語を学びます。"],
  ["example_vi", "Bản dịch", "Tôi học tiếng Nhật mỗi ngày."],
] as const;

export default async function LessonEditor({ params }: PageProps<"/teacher/classes/[classId]/lessons/[lessonId]">) {
  const { classId, lessonId } = await params;
  const { actorId } = await requireProfile("teacher");
  const { lesson, cards } = await getTeacherLesson(actorId, lessonId, classId);
  if (!lesson) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/teacher/classes/${classId}`} className="quiet-link inline-flex min-h-11 items-center gap-2"><ArrowLeft aria-hidden="true" />Quay lại lớp</Link>
      <header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <LessonTitleEditor title={lesson.title} action={updateLessonTitle.bind(null, lessonId, classId)} />
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${lesson.status === "published" ? "bg-correct/10 text-correct" : "bg-line/60 text-muted"}`}>{lesson.status === "published" ? "Đã xuất bản" : "Bản nháp"}</span>
          </div>
          <p className="mt-3 max-w-3xl break-words text-lg text-muted">{lesson.description || "Thêm từng thẻ, nhập tệp Excel/CSV hoặc dán nội dung CSV."}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start">
          {cards?.length ? (
            <Link href={`/preview/${lessonId}`} className="button-secondary gap-2 whitespace-nowrap">
              <Eye size={20} aria-hidden="true" />Xem demo tiết học
            </Link>
          ) : null}
          {lesson.status !== "published" ? (
            <ActionForm action={publishLesson.bind(null, lessonId, classId)} className="space-y-2 sm:text-right" submitClassName="button-primary w-full whitespace-nowrap sm:w-auto" submitLabel="Xuất bản" pendingLabel="Đang xuất bản" icon={<CheckCircle size={20} aria-hidden="true" />} />
          ) : null}
        </div>
      </header>

      <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_390px]">
        <section className="min-w-0" aria-labelledby="cards-heading">
          <div className="flex items-end justify-between gap-4"><h2 id="cards-heading" className="text-2xl font-bold">Danh sách thẻ</h2><span className="shrink-0 text-sm font-semibold tabular-nums text-muted">{cards?.length ?? 0} thẻ</span></div>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {cards?.map((card, index) => (
              <article key={card.id} className="grid min-w-0 gap-4 py-5 sm:grid-cols-[42px_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                <span className="text-sm font-semibold tabular-nums text-muted">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><p className="break-words font-jp text-2xl font-bold">{card.kanji}</p><p className="mt-1 break-words font-jp text-muted">{card.hiragana}</p></div>
                <div className="min-w-0"><p className="break-words font-bold">{card.meaning_vi}</p><p className="mt-2 break-words font-jp text-sm">{card.example_ja}</p><p className="mt-1 break-words text-sm text-muted">{card.example_vi}</p></div>
                <div className="flex items-start gap-1 sm:flex-col" aria-label={`Sắp xếp thẻ ${card.kanji}`}>
                  <ActionForm action={moveCard.bind(null, card.id, "up", lessonId, classId)} submitClassName="icon-button" submitLabel="Lên" pendingLabel="Đợi" disabled={index === 0} feedbackClassName="sr-only" icon={<ArrowUp aria-hidden="true" />} />
                  <ActionForm action={moveCard.bind(null, card.id, "down", lessonId, classId)} submitClassName="icon-button" submitLabel="Xuống" pendingLabel="Đợi" disabled={index === (cards?.length ?? 0) - 1} feedbackClassName="sr-only" icon={<ArrowDown aria-hidden="true" />} />
                </div>
                <details className="rounded-xl bg-surface p-4 sm:col-span-3 sm:col-start-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold"><PencilSimple aria-hidden="true" />Sửa nội dung thẻ</summary>
                  <div className="mt-4 border-t border-line pt-4">
                    <ActionForm action={updateCard.bind(null, card.id, lessonId, classId)} className="grid gap-4 sm:grid-cols-2" submitClassName="button-primary sm:w-fit" submitLabel="Lưu thay đổi" pendingLabel="Đang lưu">
                      {fields.map(([name, label]) => <div key={name} className={name.startsWith("example") ? "sm:col-span-2" : ""}><label className="label" htmlFor={`${name}-${card.id}`}>{label}</label><input className={`field ${name === "kanji" || name === "hiragana" ? "font-jp" : ""}`} id={`${name}-${card.id}`} name={name} required maxLength={name === "kanji" ? 80 : name === "hiragana" ? 120 : name === "meaning_vi" ? 240 : 500} defaultValue={card[name]} /></div>)}
                    </ActionForm>
                    <div className="mt-5 border-t border-line pt-5">
                      <ActionForm action={deleteCard.bind(null, card.id, lessonId, classId)} submitClassName="button-secondary text-wrong" submitLabel="Xóa thẻ" pendingLabel="Đang xóa" confirmMessage={`Xóa thẻ ${card.kanji}? Tiến độ học liên quan cũng sẽ bị xóa.`} icon={<Trash aria-hidden="true" />} />
                    </div>
                  </div>
                </details>
              </article>
            ))}
            {!cards?.length && <p className="py-12 text-center text-muted">Chưa có thẻ. Thêm thẻ đầu tiên ở bên cạnh.</p>}
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <div className="rounded-2xl bg-surface-strong p-6 paper-shadow">
            <div className="flex items-center gap-3"><Plus size={22} className="text-brand" aria-hidden="true" /><h2 className="text-xl font-bold">Thêm một thẻ</h2></div>
            <ActionForm action={addCard.bind(null, lessonId, classId)} className="mt-5 space-y-4" submitClassName="button-primary w-full" submitLabel="Thêm thẻ" pendingLabel="Đang thêm" resetOnSuccess>
              {fields.map(([name, label, placeholder]) => <div key={name}><label className="label" htmlFor={name}>{label}</label><input className={`field ${name === "kanji" || name === "hiragana" ? "font-jp" : ""}`} id={name} name={name} required maxLength={name === "kanji" ? 80 : name === "hiragana" ? 120 : name === "meaning_vi" ? 240 : 500} placeholder={placeholder} /></div>)}
            </ActionForm>
          </div>
          <details className="rounded-2xl bg-surface p-6">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-bold"><FileXls size={22} aria-hidden="true" />Nhập từ Excel</summary>
            <div className="mt-5"><XlsxImporter action={importCards.bind(null, lessonId, classId)} /></div>
          </details>
          <details className="min-w-0 rounded-2xl bg-surface p-6">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-bold"><FileCsv size={22} aria-hidden="true" />Nhập từ CSV</summary>
            <div className="mt-5"><CsvImporter action={importCards.bind(null, lessonId, classId)} /></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
