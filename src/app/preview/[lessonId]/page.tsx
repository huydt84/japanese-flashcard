import { notFound } from "next/navigation";
import { LessonStudy } from "@/components/lesson-study";
import { requireProfile } from "@/lib/auth";

export default async function LessonPreview({ params }: PageProps<"/preview/[lessonId]">) {
  const { lessonId } = await params;
  const { supabase } = await requireProfile("teacher");
  const { data: lesson, error: lessonError } = await supabase.from("lessons")
    .select("id,title,description,class_id").eq("id", lessonId).single();
  if (lessonError && lessonError.code !== "PGRST116") throw new Error("Không thể tải bài học để xem thử.");
  if (!lesson) notFound();

  const { data: cards, error: cardsError } = await supabase.from("cards")
    .select("id,kanji,hiragana,meaning_vi,example_ja,example_vi,position")
    .eq("lesson_id", lessonId).order("position").order("created_at");
  if (cardsError) throw new Error("Không thể tải thẻ để xem thử.");

  return <main className="min-h-[100dvh] px-4 py-5 sm:px-7">
    <LessonStudy key={lessonId} mode="preview" lessonTitle={lesson.title} description={lesson.description} cards={cards ?? []} backHref={`/teacher/classes/${lesson.class_id}/lessons/${lessonId}`} />
  </main>;
}
