import { notFound } from "next/navigation";
import { LessonStudy } from "@/components/lesson-study";
import { requireProfile } from "@/lib/auth";

export default async function StudyPage({ params }: PageProps<"/study/[lessonId]">) {
  const { lessonId } = await params;
  const { profile, supabase } = await requireProfile("student");
  const { data: lesson, error: lessonError } = await supabase.from("lessons")
    .select("id,title,description,class_id,status").eq("id", lessonId).eq("status", "published").single();
  if (lessonError && lessonError.code !== "PGRST116") throw new Error("Không thể tải bài học.");
  if (!lesson) notFound();

  const { data: cards, error: cardsError } = await supabase.from("cards")
    .select("id,kanji,hiragana,meaning_vi,example_ja,example_vi,position")
    .eq("lesson_id", lessonId).order("position").order("created_at");
  if (cardsError) throw new Error("Không thể tải từ vựng.");
  const ids = (cards ?? []).map((card) => card.id);
  const { data: progress, error: progressError } = ids.length
    ? await supabase.from("card_progress").select("card_id,due_at,last_rating").eq("student_id", profile.id).in("card_id", ids)
    : { data: [], error: null };
  if (progressError) throw new Error("Không thể tải lịch ôn.");
  const progressById = new Map((progress ?? []).map((item) => [item.card_id, item]));
  const now = new Date().getTime();
  const dueCardIds = ids.filter((id) => {
    const item = progressById.get(id);
    return !item || (item.due_at !== null && new Date(item.due_at).getTime() <= now);
  });
  const nextDueAt = (progress ?? []).map((item) => item.due_at)
    .filter((due): due is string => due !== null && new Date(due).getTime() > now)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;

  return <main className="min-h-[100dvh] px-4 py-5 sm:px-7">
    <LessonStudy key={lessonId} mode="study" lessonTitle={lesson.title} description={lesson.description} cards={cards ?? []} dueCardIds={dueCardIds} reviewProgress={progress ?? []} nextDueAt={nextDueAt} backHref="/student" />
  </main>;
}
