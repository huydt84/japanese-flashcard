DROP POLICY IF EXISTS kotoba_class_read ON public.classes;
CREATE POLICY kotoba_class_read ON public.classes FOR SELECT
USING (
  (teacher_id = public.kotoba_actor_id() AND public.kotoba_actor_is_teacher())
  OR public.kotoba_student_in_class(id)
  OR (public.kotoba_actor_is_student() AND EXISTS (
    SELECT 1 FROM public.class_invitations i
    WHERE i.class_id = classes.id AND i.recipient_id = public.kotoba_actor_id() AND i.status = 'pending'
  ))
);
