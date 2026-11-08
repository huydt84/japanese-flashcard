import { LessonEditor } from "@/components/lesson-editor";

export default async function StudentLessonPage({ params }: PageProps<"/student/classes/[classId]/lessons/[lessonId]">) {
  const { classId, lessonId } = await params;
  return <LessonEditor classId={classId} lessonId={lessonId} workspace="student" />;
}
