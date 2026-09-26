import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { StudySession } from "@/components/study-session";
import { requireProfile } from "@/lib/auth";
import type { StudyCard } from "@/lib/types";

export default async function LessonPreview({ params }: PageProps<"/preview/[lessonId]">) {
  const { lessonId } = await params;
  const { supabase } = await requireProfile("teacher");
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id,title,class_id")
    .eq("id", lessonId)
    .single();

  if (lessonError && lessonError.code !== "PGRST116") throw new Error("Không thể tải bài học để xem thử.");
  if (!lesson) notFound();

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id,kanji,hiragana,meaning_vi,example_ja,example_vi,position")
    .eq("lesson_id", lessonId)
    .order("position")
    .order("created_at");
  if (cardsError) throw new Error("Không thể tải thẻ để xem thử.");
  const backHref = `/teacher/classes/${lesson.class_id}/lessons/${lessonId}`;

  if (!cards?.length) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-[-.035em]">Chưa có thẻ để xem thử</h1>
        <p className="mt-3 text-lg text-muted">Thêm ít nhất một thẻ vào bài học rồi quay lại đây.</p>
        <Link href={backHref} className="button-primary mt-8 gap-2"><ArrowLeft aria-hidden="true" />Quay lại bài học</Link>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-4 py-5 sm:px-7">
      <StudySession mode="preview" lessonTitle={lesson.title} cards={cards as StudyCard[]} backHref={backHref} />
    </main>
  );
}
