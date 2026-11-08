import { LessonEditor } from "@/components/lesson-editor";

export default async function TeacherLessonPage({ params }: PageProps<"/teacher/classes/[classId]/lessons/[lessonId]">) {
  const { classId, lessonId } = await params;
  return <LessonEditor classId={classId} lessonId={lessonId} workspace="teacher" />;
}
