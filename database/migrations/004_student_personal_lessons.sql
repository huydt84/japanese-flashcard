-- A non-null student creator permanently limits a lesson to that student and the class teacher.
ALTER TABLE public.lessons ADD COLUMN student_creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX lessons_student_creator ON public.lessons(student_creator_id) WHERE student_creator_id IS NOT NULL;

CREATE FUNCTION public.kotoba_student_owns_lesson(target_lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_student() AND EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.id = target_lesson
      AND l.student_creator_id = public.kotoba_actor_id()
      AND public.kotoba_student_in_class(l.class_id)
  )
$$;

CREATE FUNCTION public.kotoba_can_edit_lesson(target_lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_teacher_owns_lesson(target_lesson) OR public.kotoba_student_owns_lesson(target_lesson)
$$;

CREATE FUNCTION public.kotoba_preserve_lesson_audience()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.student_creator_id IS DISTINCT FROM OLD.student_creator_id THEN
    RAISE EXCEPTION 'lesson_audience_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_lesson_audience BEFORE UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.kotoba_preserve_lesson_audience();

CREATE OR REPLACE FUNCTION public.kotoba_student_can_read_lesson(target_lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_student() AND EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.id = target_lesson
      AND public.kotoba_student_in_class(l.class_id)
      AND ((l.student_creator_id IS NULL AND l.status = 'published')
        OR l.student_creator_id = public.kotoba_actor_id())
  )
$$;

CREATE POLICY kotoba_lesson_student_insert ON public.lessons FOR INSERT
WITH CHECK (student_creator_id = public.kotoba_actor_id() AND public.kotoba_student_in_class(class_id));
CREATE POLICY kotoba_lesson_student_update ON public.lessons FOR UPDATE
USING (public.kotoba_student_owns_lesson(id))
WITH CHECK (student_creator_id = public.kotoba_actor_id() AND public.kotoba_student_in_class(class_id));
CREATE POLICY kotoba_lesson_student_delete ON public.lessons FOR DELETE
USING (public.kotoba_student_owns_lesson(id));
CREATE POLICY kotoba_card_student_write ON public.cards FOR ALL
USING (public.kotoba_student_owns_lesson(lesson_id))
WITH CHECK (public.kotoba_student_owns_lesson(lesson_id));

CREATE OR REPLACE FUNCTION public.kotoba_move_card(target_card uuid, movement text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE current_card public.cards;
DECLARE neighbor_card public.cards;
BEGIN
  IF movement NOT IN ('up', 'down') THEN RAISE EXCEPTION 'invalid_movement'; END IF;
  SELECT c.* INTO current_card FROM public.cards c WHERE c.id = target_card FOR UPDATE;
  IF current_card.id IS NULL OR NOT public.kotoba_can_edit_lesson(current_card.lesson_id) THEN RAISE EXCEPTION 'lesson_editor_required'; END IF;
  PERFORM 1 FROM public.lessons l WHERE l.id = current_card.lesson_id FOR UPDATE;
  IF movement = 'up' THEN
    SELECT c.* INTO neighbor_card FROM public.cards c
    WHERE c.lesson_id = current_card.lesson_id AND c.position < current_card.position
    ORDER BY c.position DESC, c.created_at DESC LIMIT 1 FOR UPDATE;
  ELSE
    SELECT c.* INTO neighbor_card FROM public.cards c
    WHERE c.lesson_id = current_card.lesson_id AND c.position > current_card.position
    ORDER BY c.position ASC, c.created_at ASC LIMIT 1 FOR UPDATE;
  END IF;
  IF neighbor_card.id IS NULL THEN RETURN; END IF;
  UPDATE public.cards SET position = CASE WHEN id = current_card.id THEN neighbor_card.position ELSE current_card.position END,
    updated_at = now() WHERE id IN (current_card.id, neighbor_card.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_record_review(target_card uuid, target_session uuid, selected_rating public.review_rating)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE current_progress public.card_progress;
DECLARE before_state jsonb := '{}'::jsonb;
DECLARE after_state jsonb;
DECLARE review_time timestamptz := clock_timestamp();
DECLARE next_due timestamptz;
DECLARE next_streak integer;
DECLARE next_reviews integer;
DECLARE next_lapses integer;
DECLARE target_lesson uuid;
DECLARE target_class uuid;
DECLARE log_id uuid;
BEGIN
  IF NOT public.kotoba_actor_is_student() THEN RAISE EXCEPTION 'student_mode_required'; END IF;
  SELECT c.lesson_id, l.class_id INTO target_lesson, target_class
  FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
  WHERE c.id = target_card AND l.status = 'published';
  IF target_class IS NULL OR NOT public.kotoba_student_in_class(target_class) OR NOT public.kotoba_student_can_read_lesson(target_lesson) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(public.kotoba_actor_id()::text || ':' || target_card::text, 0));
  SELECT * INTO current_progress FROM public.card_progress
  WHERE student_id = public.kotoba_actor_id() AND card_id = target_card FOR UPDATE;
  IF FOUND THEN
    before_state := jsonb_build_object(
      'due_at', current_progress.due_at, 'last_rating', current_progress.last_rating,
      'good_streak', current_progress.good_streak, 'last_review_at', current_progress.last_review_at,
      'review_count', current_progress.review_count, 'lapse_count', current_progress.lapse_count
    );
  END IF;
  next_streak := CASE WHEN selected_rating = 'good' THEN least(coalesce(current_progress.good_streak, 0) + 1, 4) ELSE 0 END;
  next_reviews := coalesce(current_progress.review_count, 0) + 1;
  next_lapses := coalesce(current_progress.lapse_count, 0) + CASE WHEN selected_rating = 'again' THEN 1 ELSE 0 END;
  next_due := CASE
    WHEN selected_rating = 'again' THEN review_time
    WHEN selected_rating = 'hard' THEN review_time + interval '1 hour'
    WHEN next_streak = 1 THEN review_time + interval '6 hours'
    WHEN next_streak = 2 THEN review_time + interval '1 day'
    WHEN next_streak = 3 THEN review_time + interval '2 days'
    ELSE NULL
  END;
  after_state := jsonb_build_object(
    'due_at', next_due, 'last_rating', selected_rating, 'good_streak', next_streak,
    'last_review_at', review_time, 'review_count', next_reviews, 'lapse_count', next_lapses
  );
  INSERT INTO public.card_progress(student_id, card_id, due_at, last_rating, good_streak, last_review_at, review_count, lapse_count)
  VALUES(public.kotoba_actor_id(), target_card, next_due, selected_rating, next_streak, review_time, next_reviews, next_lapses)
  ON CONFLICT(student_id, card_id) DO UPDATE SET
    due_at = EXCLUDED.due_at, last_rating = EXCLUDED.last_rating, good_streak = EXCLUDED.good_streak,
    last_review_at = EXCLUDED.last_review_at, review_count = EXCLUDED.review_count,
    lapse_count = EXCLUDED.lapse_count, updated_at = now();
  INSERT INTO public.review_logs(student_id, card_id, session_id, rating, state_before, state_after, reviewed_at)
  VALUES(public.kotoba_actor_id(), target_card, target_session, selected_rating, before_state, after_state, review_time)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_student_can_change_progress(target_student uuid, target_card uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT target_student = public.kotoba_actor_id() AND public.kotoba_actor_is_student()
    AND EXISTS (
      SELECT 1 FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
      JOIN public.class_memberships m ON m.class_id = l.class_id
      WHERE c.id = target_card AND l.status = 'published' AND m.student_id = target_student
        AND public.kotoba_student_can_read_lesson(l.id)
    )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_can_access_progress(target_student uuid, target_card uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (target_student = public.kotoba_actor_id() AND public.kotoba_actor_is_student()
      AND EXISTS (
        SELECT 1 FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
        JOIN public.class_memberships m ON m.class_id = l.class_id
        WHERE c.id = target_card AND m.student_id = target_student
          AND public.kotoba_student_can_read_lesson(l.id)
      ))
    OR (public.kotoba_actor_is_teacher() AND EXISTS (
      SELECT 1 FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
      JOIN public.classes cl ON cl.id = l.class_id
      WHERE c.id = target_card AND cl.teacher_id = public.kotoba_actor_id()
    ))
$$;

CREATE OR REPLACE FUNCTION public.kotoba_class_student_progress(target_class uuid)
RETURNS TABLE(student_id uuid, studied bigint, total bigint, due bigint, good_reviews bigint, review_count bigint, last_review timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.kotoba_teacher_owns_class(target_class) THEN RAISE EXCEPTION 'teacher_required'; END IF;
  RETURN QUERY
  WITH eligible AS MATERIALIZED (
    SELECT m.student_id, c.id AS card_id
    FROM public.class_memberships m JOIN public.lessons l ON l.class_id = m.class_id
    JOIN public.cards c ON c.lesson_id = l.id
    WHERE m.class_id = target_class AND l.status = 'published'
      AND (l.student_creator_id IS NULL OR l.student_creator_id = m.student_id)
  ), progress AS (
    SELECT e.student_id, count(*) AS studied,
      count(*) FILTER (WHERE p.due_at > now() OR p.due_at IS NULL) AS not_due
    FROM eligible e JOIN public.card_progress p ON p.card_id = e.card_id AND p.student_id = e.student_id
    GROUP BY e.student_id
  ), reviews AS (
    SELECT e.student_id, count(*) FILTER (WHERE r.rating = 'good') AS good_reviews,
      count(*) AS review_count, max(r.reviewed_at) AS last_review
    FROM eligible e JOIN public.review_logs r ON r.card_id = e.card_id AND r.student_id = e.student_id
    WHERE r.undone_at IS NULL GROUP BY e.student_id
  ), totals AS (SELECT e.student_id, count(*) AS total FROM eligible e GROUP BY e.student_id)
  SELECT m.student_id, coalesce(p.studied, 0), coalesce(t.total, 0), coalesce(t.total, 0) - coalesce(p.not_due, 0),
    coalesce(r.good_reviews, 0), coalesce(r.review_count, 0), r.last_review
  FROM public.class_memberships m
  LEFT JOIN totals t ON t.student_id = m.student_id
  LEFT JOIN progress p ON p.student_id = m.student_id
  LEFT JOIN reviews r ON r.student_id = m.student_id
  WHERE m.class_id = target_class;
END;
$$;

REVOKE ALL ON FUNCTION public.kotoba_student_owns_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_can_edit_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_preserve_lesson_audience() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kotoba_student_owns_lesson(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_can_edit_lesson(uuid) TO kotoba_runtime;
