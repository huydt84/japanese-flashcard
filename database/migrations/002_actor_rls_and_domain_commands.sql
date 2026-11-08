CREATE OR REPLACE FUNCTION public.kotoba_actor_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.kotoba_actor_is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.kotoba_actor_id()
      AND (p.role = 'teacher' OR (p.role = 'admin' AND p.active_mode = 'teacher'))
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_actor_is_student()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.kotoba_actor_id()
      AND (p.role = 'student' OR (p.role = 'admin' AND coalesce(p.active_mode, 'student') = 'student'))
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_teacher_owns_class(target_class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_teacher() AND EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = target_class AND c.teacher_id = public.kotoba_actor_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_student_in_class(target_class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_student() AND EXISTS (
    SELECT 1 FROM public.class_memberships m
    WHERE m.class_id = target_class AND m.student_id = public.kotoba_actor_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_can_read_class(target_class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_teacher_owns_class(target_class)
    OR public.kotoba_student_in_class(target_class)
    OR (public.kotoba_actor_is_student() AND EXISTS (
      SELECT 1 FROM public.class_invitations i
      WHERE i.class_id = target_class AND i.recipient_id = public.kotoba_actor_id() AND i.status = 'pending'
    ))
$$;

CREATE OR REPLACE FUNCTION public.kotoba_teacher_can_read_profile(target_profile uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_teacher() AND EXISTS (
    SELECT 1 FROM public.class_memberships m
    JOIN public.classes c ON c.id = m.class_id
    WHERE m.student_id = target_profile AND c.teacher_id = public.kotoba_actor_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_claim_pending_invitations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed integer;
DECLARE actor_email text;
BEGIN
  IF NOT public.kotoba_actor_is_student() THEN RETURN 0; END IF;
  SELECT p.email INTO actor_email FROM public.profiles p WHERE p.id = public.kotoba_actor_id();
  UPDATE public.class_invitations i SET recipient_id = public.kotoba_actor_id()
  WHERE i.status = 'pending' AND i.recipient_id IS NULL AND i.email = actor_email;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  INSERT INTO public.notifications (user_id, kind, invitation_id)
  SELECT public.kotoba_actor_id(), 'class_invitation', i.id
  FROM public.class_invitations i
  WHERE i.status = 'pending' AND i.recipient_id = public.kotoba_actor_id()
  ON CONFLICT (invitation_id) WHERE invitation_id IS NOT NULL DO NOTHING;
  RETURN claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_choose_role(chosen_role public.user_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE changed integer;
BEGIN
  IF chosen_role NOT IN ('teacher', 'student') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  UPDATE public.profiles SET role = chosen_role, active_mode = NULL,
    onboarding_completed_at = now(), updated_at = now()
  WHERE id = public.kotoba_actor_id() AND role IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'role_already_selected'; END IF;
  IF chosen_role = 'student' THEN PERFORM public.kotoba_claim_pending_invitations(); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_switch_admin_mode(selected_mode text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE changed integer;
BEGIN
  IF selected_mode NOT IN ('teacher', 'student') THEN RAISE EXCEPTION 'invalid_admin_mode'; END IF;
  UPDATE public.profiles SET active_mode = selected_mode, updated_at = now()
  WHERE id = public.kotoba_actor_id() AND role = 'admin';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'admin_required'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_send_class_invitation(target_class uuid, recipient_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient public.profiles;
DECLARE invitation_id uuid;
DECLARE normalized_email text := lower(trim(recipient_email));
BEGIN
  IF NOT public.kotoba_teacher_owns_class(target_class) THEN RAISE EXCEPTION 'teacher_required'; END IF;
  IF normalized_email IS NULL OR char_length(normalized_email) > 254
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  THEN RAISE EXCEPTION 'invalid_email'; END IF;
  SELECT * INTO recipient FROM public.profiles p WHERE p.email = normalized_email;
  IF recipient.role = 'teacher' THEN RAISE EXCEPTION 'teacher_recipient'; END IF;
  INSERT INTO public.class_invitations (class_id, invited_by, email, recipient_id)
  VALUES (target_class, public.kotoba_actor_id(), normalized_email, recipient.id)
  RETURNING id INTO invitation_id;
  IF recipient.id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, invitation_id)
    VALUES (recipient.id, 'class_invitation', invitation_id);
  END IF;
  RETURN invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_revoke_class_invitation(target_invitation uuid, target_class uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE changed integer;
BEGIN
  IF NOT public.kotoba_teacher_owns_class(target_class) THEN RAISE EXCEPTION 'teacher_required'; END IF;
  UPDATE public.class_invitations SET status = 'revoked', responded_at = now()
  WHERE id = target_invitation AND class_id = target_class AND status = 'pending';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RAISE EXCEPTION 'invitation_not_available'; END IF;
  UPDATE public.notifications SET read_at = coalesce(read_at, now()) WHERE invitation_id = target_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.kotoba_respond_to_invitation(target_invitation uuid, accept_invitation boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE invitation public.class_invitations;
BEGIN
  PERFORM public.kotoba_claim_pending_invitations();
  IF NOT public.kotoba_actor_is_student() THEN RAISE EXCEPTION 'student_mode_required'; END IF;
  SELECT * INTO invitation FROM public.class_invitations i
  WHERE i.id = target_invitation AND i.status = 'pending' FOR UPDATE;
  IF invitation.id IS NULL OR invitation.recipient_id IS DISTINCT FROM public.kotoba_actor_id()
  THEN RAISE EXCEPTION 'invitation_not_available'; END IF;
  IF accept_invitation THEN
    INSERT INTO public.class_memberships (class_id, student_id)
    VALUES (invitation.class_id, public.kotoba_actor_id()) ON CONFLICT DO NOTHING;
    UPDATE public.class_invitations SET status = 'accepted', responded_at = now() WHERE id = target_invitation;
  ELSE
    UPDATE public.class_invitations SET status = 'declined', responded_at = now() WHERE id = target_invitation;
  END IF;
  UPDATE public.notifications SET read_at = coalesce(read_at, now())
  WHERE invitation_id = target_invitation AND user_id = public.kotoba_actor_id();
END;
$$;

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
  IF current_card.id IS NULL OR NOT public.kotoba_teacher_owns_class(
    (SELECT l.class_id FROM public.lessons l WHERE l.id = current_card.lesson_id)
  ) THEN RAISE EXCEPTION 'teacher_required'; END IF;
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

CREATE OR REPLACE FUNCTION public.kotoba_class_student_progress(target_class uuid)
RETURNS TABLE(student_id uuid, studied bigint, total bigint, due bigint, good_reviews bigint, review_count bigint, last_review timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.kotoba_teacher_owns_class(target_class) THEN RAISE EXCEPTION 'teacher_required'; END IF;
  RETURN QUERY
  WITH published_cards AS MATERIALIZED (
    SELECT c.id FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
    WHERE l.class_id = target_class AND l.status = 'published'
  ), progress AS (
    SELECT p.student_id, count(*) AS studied,
      count(*) FILTER (WHERE p.due_at > now() OR p.due_at IS NULL) AS not_due
    FROM public.card_progress p JOIN published_cards c ON c.id = p.card_id GROUP BY p.student_id
  ), reviews AS (
    SELECT r.student_id, count(*) FILTER (WHERE r.rating = 'good') AS good_reviews,
      count(*) AS review_count, max(r.reviewed_at) AS last_review
    FROM public.review_logs r JOIN published_cards c ON c.id = r.card_id
    WHERE r.undone_at IS NULL GROUP BY r.student_id
  ), totals AS (SELECT count(*) AS total FROM published_cards)
  SELECT m.student_id, coalesce(p.studied, 0), t.total, t.total - coalesce(p.not_due, 0),
    coalesce(r.good_reviews, 0), coalesce(r.review_count, 0), r.last_review
  FROM public.class_memberships m CROSS JOIN totals t
  LEFT JOIN progress p ON p.student_id = m.student_id
  LEFT JOIN reviews r ON r.student_id = m.student_id
  WHERE m.class_id = target_class;
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
  IF target_class IS NULL OR NOT public.kotoba_student_in_class(target_class) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
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

CREATE OR REPLACE FUNCTION public.kotoba_undo_latest_review(target_session uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE latest public.review_logs;
DECLARE restored jsonb;
BEGIN
  IF NOT public.kotoba_actor_is_student() THEN RAISE EXCEPTION 'student_mode_required'; END IF;
  SELECT * INTO latest FROM public.review_logs r
  WHERE r.student_id = public.kotoba_actor_id() AND r.session_id = target_session AND r.undone_at IS NULL
  ORDER BY r.reviewed_at DESC, r.id DESC LIMIT 1 FOR UPDATE;
  IF latest.id IS NULL THEN RAISE EXCEPTION 'nothing_to_undo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.card_progress p
    WHERE p.student_id = public.kotoba_actor_id() AND p.card_id = latest.card_id
      AND p.due_at IS NOT DISTINCT FROM (latest.state_after ->> 'due_at')::timestamptz
      AND p.good_streak = (latest.state_after ->> 'good_streak')::integer
      AND p.last_review_at IS NOT DISTINCT FROM (latest.state_after ->> 'last_review_at')::timestamptz
  ) THEN RAISE EXCEPTION 'review_conflict'; END IF;
  restored := latest.state_before;
  IF restored = '{}'::jsonb THEN
    DELETE FROM public.card_progress WHERE student_id = public.kotoba_actor_id() AND card_id = latest.card_id;
  ELSE
    UPDATE public.card_progress SET
      due_at = (restored ->> 'due_at')::timestamptz,
      last_rating = (restored ->> 'last_rating')::public.review_rating,
      good_streak = (restored ->> 'good_streak')::smallint,
      last_review_at = (restored ->> 'last_review_at')::timestamptz,
      review_count = (restored ->> 'review_count')::integer,
      lapse_count = (restored ->> 'lapse_count')::integer,
      updated_at = now()
    WHERE student_id = public.kotoba_actor_id() AND card_id = latest.card_id;
  END IF;
  UPDATE public.review_logs SET undone_at = now() WHERE id = latest.id;
  RETURN latest.card_id;
END;
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
      ))
    OR (public.kotoba_actor_is_teacher() AND EXISTS (
      SELECT 1 FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
      JOIN public.classes cl ON cl.id = l.class_id
      WHERE c.id = target_card AND cl.teacher_id = public.kotoba_actor_id()
    ))
$$;

CREATE OR REPLACE FUNCTION public.kotoba_can_access_review(target_student uuid, target_card uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT public.kotoba_can_access_progress(target_student, target_card) $$;

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
    )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_teacher_owns_lesson(target_lesson uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = target_lesson AND public.kotoba_teacher_owns_class(l.class_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_teacher_owns_card(target_card uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cards c JOIN public.lessons l ON l.id = c.lesson_id
    WHERE c.id = target_card AND public.kotoba_teacher_owns_class(l.class_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_student_can_read_lesson(target_lesson uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.kotoba_actor_is_student() AND EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.class_memberships m ON m.class_id = l.class_id
    WHERE l.id = target_lesson AND l.status = 'published' AND m.student_id = public.kotoba_actor_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.kotoba_teacher_can_read_review_student(target_student uuid, target_card uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT public.kotoba_can_access_progress(target_student, target_card) AND target_student <> public.kotoba_actor_id() $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'classes', 'class_memberships', 'class_invitations',
    'lessons', 'cards', 'card_progress', 'review_logs', 'notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS kotoba_profile_read ON public.profiles;
CREATE POLICY kotoba_profile_read ON public.profiles FOR SELECT
USING (id = public.kotoba_actor_id() OR public.kotoba_teacher_can_read_profile(id));
DROP POLICY IF EXISTS kotoba_profile_update ON public.profiles;
CREATE POLICY kotoba_profile_update ON public.profiles FOR UPDATE
USING (id = public.kotoba_actor_id()) WITH CHECK (id = public.kotoba_actor_id());

DROP POLICY IF EXISTS kotoba_class_read ON public.classes;
CREATE POLICY kotoba_class_read ON public.classes FOR SELECT
USING (public.kotoba_can_read_class(id));
DROP POLICY IF EXISTS kotoba_class_teacher_write ON public.classes;
CREATE POLICY kotoba_class_teacher_write ON public.classes FOR ALL
USING (public.kotoba_teacher_owns_class(id)) WITH CHECK (teacher_id = public.kotoba_actor_id() AND public.kotoba_actor_is_teacher());

DROP POLICY IF EXISTS kotoba_membership_read ON public.class_memberships;
CREATE POLICY kotoba_membership_read ON public.class_memberships FOR SELECT
USING (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student()
  OR public.kotoba_teacher_owns_class(class_id));

DROP POLICY IF EXISTS kotoba_invitation_read ON public.class_invitations;
CREATE POLICY kotoba_invitation_read ON public.class_invitations FOR SELECT
USING (public.kotoba_teacher_owns_class(class_id)
  OR (recipient_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student()));

DROP POLICY IF EXISTS kotoba_lesson_read ON public.lessons;
CREATE POLICY kotoba_lesson_read ON public.lessons FOR SELECT
USING (public.kotoba_teacher_owns_class(class_id) OR public.kotoba_student_can_read_lesson(id));
DROP POLICY IF EXISTS kotoba_lesson_teacher_write ON public.lessons;
CREATE POLICY kotoba_lesson_teacher_write ON public.lessons FOR ALL
USING (public.kotoba_teacher_owns_class(class_id)) WITH CHECK (public.kotoba_teacher_owns_class(class_id));

DROP POLICY IF EXISTS kotoba_card_read ON public.cards;
CREATE POLICY kotoba_card_read ON public.cards FOR SELECT
USING (public.kotoba_teacher_owns_lesson(lesson_id) OR public.kotoba_student_can_read_lesson(lesson_id));
DROP POLICY IF EXISTS kotoba_card_teacher_write ON public.cards;
CREATE POLICY kotoba_card_teacher_write ON public.cards FOR ALL
USING (public.kotoba_teacher_owns_lesson(lesson_id)) WITH CHECK (public.kotoba_teacher_owns_lesson(lesson_id));

DROP POLICY IF EXISTS kotoba_progress_read ON public.card_progress;
CREATE POLICY kotoba_progress_read ON public.card_progress FOR SELECT
USING (public.kotoba_can_access_progress(student_id, card_id));
DROP POLICY IF EXISTS kotoba_progress_student_write ON public.card_progress;
CREATE POLICY kotoba_progress_student_write ON public.card_progress FOR ALL
USING (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student())
WITH CHECK (public.kotoba_student_can_change_progress(student_id, card_id));

DROP POLICY IF EXISTS kotoba_review_read ON public.review_logs;
CREATE POLICY kotoba_review_read ON public.review_logs FOR SELECT
USING (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student()
  OR public.kotoba_teacher_can_read_review_student(student_id, card_id));
DROP POLICY IF EXISTS kotoba_review_student_insert ON public.review_logs;
CREATE POLICY kotoba_review_student_insert ON public.review_logs FOR INSERT
WITH CHECK (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student()
  AND public.kotoba_student_can_change_progress(student_id, card_id));
DROP POLICY IF EXISTS kotoba_review_student_update ON public.review_logs;
CREATE POLICY kotoba_review_student_update ON public.review_logs FOR UPDATE
USING (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student())
WITH CHECK (student_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student());

DROP POLICY IF EXISTS kotoba_notification_read ON public.notifications;
CREATE POLICY kotoba_notification_read ON public.notifications FOR SELECT
USING (user_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student());
DROP POLICY IF EXISTS kotoba_notification_update ON public.notifications;
CREATE POLICY kotoba_notification_update ON public.notifications FOR UPDATE
USING (user_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student())
WITH CHECK (user_id = public.kotoba_actor_id() AND public.kotoba_actor_is_student());

GRANT USAGE ON SCHEMA auth, public TO kotoba_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users, auth.accounts, auth.sessions, auth.verification_token TO kotoba_runtime;
GRANT USAGE, SELECT ON SEQUENCE auth.accounts_id_seq, auth.sessions_id_seq TO kotoba_runtime;
GRANT SELECT ON public.profiles, public.classes, public.class_memberships, public.class_invitations,
  public.lessons, public.cards, public.card_progress, public.review_logs, public.notifications TO kotoba_runtime;
GRANT UPDATE (email, display_name, avatar_url, updated_at) ON public.profiles TO kotoba_runtime;
GRANT INSERT, UPDATE, DELETE ON public.classes, public.lessons, public.cards TO kotoba_runtime;
GRANT INSERT, UPDATE, DELETE ON public.card_progress TO kotoba_runtime;
GRANT INSERT ON public.review_logs TO kotoba_runtime;
GRANT UPDATE (undone_at) ON public.review_logs TO kotoba_runtime;
GRANT UPDATE (read_at) ON public.notifications TO kotoba_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO kotoba_runtime;

REVOKE ALL ON FUNCTION public.kotoba_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_actor_is_teacher() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_actor_is_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_teacher_owns_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_student_in_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_can_read_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_teacher_can_read_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_claim_pending_invitations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_choose_role(public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_switch_admin_mode(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_send_class_invitation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_revoke_class_invitation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_respond_to_invitation(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_move_card(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_class_student_progress(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_record_review(uuid, uuid, public.review_rating) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_undo_latest_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_can_access_progress(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_can_access_review(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_student_can_change_progress(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_teacher_owns_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_teacher_owns_card(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_student_can_read_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kotoba_teacher_can_read_review_student(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.kotoba_actor_id() TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_actor_is_teacher() TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_actor_is_student() TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_teacher_owns_class(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_student_in_class(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_can_read_class(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_teacher_can_read_profile(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_claim_pending_invitations() TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_choose_role(public.user_role) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_switch_admin_mode(text) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_send_class_invitation(uuid, text) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_revoke_class_invitation(uuid, uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_respond_to_invitation(uuid, boolean) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_move_card(uuid, text) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_class_student_progress(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_can_access_progress(uuid, uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_student_can_change_progress(uuid, uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_teacher_owns_lesson(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_teacher_owns_card(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_student_can_read_lesson(uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_teacher_can_read_review_student(uuid, uuid) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_record_review(uuid, uuid, public.review_rating) TO kotoba_runtime;
GRANT EXECUTE ON FUNCTION public.kotoba_undo_latest_review(uuid) TO kotoba_runtime;
