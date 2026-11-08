import { notFound } from "next/navigation";
import { LessonStudy } from "@/components/lesson-study";
import { requireProfile } from "@/lib/auth";
import { getStudyLesson } from "@/lib/queries";

export default async function StudyPage({ params }: PageProps<"/study/[lessonId]">) {
  const { lessonId } = await params;
  const { actorId } = await requireProfile("student");
  const data = await getStudyLesson(actorId, lessonId);
  if (!data) notFound();
  const { lesson, cards, progress } = data;
  const ids = cards.map((card) => card.id);
  const progressById = new Map(progress.map((item) => [item.card_id, item]));
  const now = new Date().getTime();
  const dueCardIds = ids.filter((id) => {
    const item = progressById.get(id);
    return !item || (item.due_at !== null && new Date(item.due_at).getTime() <= now);
  });
  const nextDueAt = progress.map((item) => item.due_at)
    .filter((due): due is string => due !== null && new Date(due).getTime() > now)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;

  return <main className="min-h-[100dvh] px-4 py-5 sm:px-7">
    <LessonStudy key={lessonId} mode="study" lessonTitle={lesson.title} description={lesson.description} cards={cards} dueCardIds={dueCardIds} reviewProgress={progress} nextDueAt={nextDueAt} backHref="/student" />
  </main>;
}
