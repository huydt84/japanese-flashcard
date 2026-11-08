-- INSERT ... RETURNING must check the new row directly. A STABLE helper that
-- queries lessons cannot see the inserted row within that statement's snapshot.
DROP POLICY kotoba_lesson_read ON public.lessons;
CREATE POLICY kotoba_lesson_read ON public.lessons FOR SELECT
USING (
  public.kotoba_teacher_owns_class(class_id)
  OR (public.kotoba_student_in_class(class_id)
    AND ((student_creator_id IS NULL AND status = 'published')
      OR student_creator_id = public.kotoba_actor_id()))
);
