import { notFound } from "next/navigation";
import { LessonStudy } from "@/components/lesson-study";
import { requireProfile } from "@/lib/auth";
import { getTeacherPreview } from "@/lib/queries";

export default async function LessonPreview({ params }: PageProps<"/preview/[lessonId]">) {
  const { lessonId } = await params;
  const { actorId } = await requireProfile("teacher");
  const data = await getTeacherPreview(actorId, lessonId);
  if (!data) notFound();
  const { lesson, cards } = data;

  return <main className="min-h-[100dvh] px-4 py-5 sm:px-7">
    <LessonStudy key={lessonId} mode="preview" lessonTitle={lesson.title} description={lesson.description} cards={cards} backHref={`/teacher/classes/${lesson.class_id}/lessons/${lessonId}`} />
  </main>;
}
