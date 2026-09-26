-- Keep the legacy fsrs column and record_review signature while older pages are open.
-- The database owns the new schedule; legacy callers' proposed states are ignored.
alter table public.card_progress alter column due_at drop not null;
alter table public.card_progress add column last_rating public.review_rating;
alter table public.card_progress add column good_streak smallint not null default 0
  check (good_streak between 0 and 4);

create function public.fixed_review_due(reviewed_time timestamptz, selected_rating public.review_rating, streak integer)
returns timestamptz language sql immutable set search_path = public
as $$
  select case
    when selected_rating = 'again' then reviewed_time
    when selected_rating = 'hard' then reviewed_time + interval '1 hour'
    when streak = 1 then reviewed_time + interval '6 hours'
    when streak = 2 then reviewed_time + interval '1 day'
    when streak = 3 then reviewed_time + interval '2 days'
    else null
  end;
$$;
revoke all on function public.fixed_review_due(timestamptz, public.review_rating, integer) from public, anon;

-- Replay active ratings, including their undo snapshots, in a stable order.
do $$
declare pair record;
declare review record;
declare previous_state jsonb;
declare next_state jsonb;
declare streak integer;
declare reviews integer;
declare lapses integer;
declare next_due timestamptz;
declare latest_rating public.review_rating;
declare latest_review timestamptz;
begin
  for pair in select distinct student_id, card_id from public.review_logs where undone_at is null loop
    previous_state := '{}'::jsonb;
    streak := 0;
    reviews := 0;
    lapses := 0;
    for review in
      select id, rating, reviewed_at from public.review_logs
      where student_id = pair.student_id and card_id = pair.card_id and undone_at is null
      order by reviewed_at, id
    loop
      streak := case when review.rating = 'good' then least(streak + 1, 4) else 0 end;
      reviews := reviews + 1;
      lapses := lapses + case when review.rating = 'again' then 1 else 0 end;
      next_due := public.fixed_review_due(review.reviewed_at, review.rating, streak);
      next_state := jsonb_build_object(
        'due_at', next_due, 'last_rating', review.rating, 'good_streak', streak,
        'last_review_at', review.reviewed_at, 'review_count', reviews, 'lapse_count', lapses
      );
      update public.review_logs set state_before = previous_state, state_after = next_state where id = review.id;
      previous_state := next_state;
      latest_rating := review.rating;
      latest_review := review.reviewed_at;
    end loop;
    insert into public.card_progress(student_id, card_id, due_at, last_rating, good_streak, last_review_at, review_count, lapse_count)
    values(pair.student_id, pair.card_id, next_due, latest_rating, streak, latest_review, reviews, lapses)
    on conflict(student_id, card_id) do update set
      due_at = excluded.due_at, last_rating = excluded.last_rating, good_streak = excluded.good_streak,
      last_review_at = excluded.last_review_at, review_count = excluded.review_count,
      lapse_count = excluded.lapse_count, updated_at = now();
  end loop;

  -- A legacy progress row without an active review has no rating to infer.
  update public.card_progress p set due_at = now(), last_rating = null, good_streak = 0,
    last_review_at = null, review_count = 0, lapse_count = 0, updated_at = now()
  where not exists (
    select 1 from public.review_logs r
    where r.student_id = p.student_id and r.card_id = p.card_id and r.undone_at is null
  );
end;
$$;

create function public.record_review_v2(target_card uuid, target_session uuid, selected_rating public.review_rating)
returns uuid language plpgsql security definer set search_path = public
as $$
declare current_progress public.card_progress;
declare before_state jsonb := '{}'::jsonb;
declare after_state jsonb;
declare review_time timestamptz := clock_timestamp();
declare next_due timestamptz;
declare next_streak integer;
declare next_reviews integer;
declare next_lapses integer;
declare log_id uuid;
begin
  if not public.can_act_as_student() or not public.is_student_of_class(public.card_class(target_card)) then
    raise exception 'not_enrolled';
  end if;
  -- Serialize even the first review, when there is no progress row to lock yet.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || target_card::text, 0));
  select * into current_progress from public.card_progress
    where student_id = auth.uid() and card_id = target_card for update;
  if found then
    before_state := jsonb_build_object(
      'due_at', current_progress.due_at, 'last_rating', current_progress.last_rating,
      'good_streak', current_progress.good_streak, 'last_review_at', current_progress.last_review_at,
      'review_count', current_progress.review_count, 'lapse_count', current_progress.lapse_count
    );
  end if;
  next_streak := case when selected_rating = 'good' then least(coalesce(current_progress.good_streak, 0) + 1, 4) else 0 end;
  next_reviews := coalesce(current_progress.review_count, 0) + 1;
  next_lapses := coalesce(current_progress.lapse_count, 0) + case when selected_rating = 'again' then 1 else 0 end;
  next_due := public.fixed_review_due(review_time, selected_rating, next_streak);
  after_state := jsonb_build_object(
    'due_at', next_due, 'last_rating', selected_rating, 'good_streak', next_streak,
    'last_review_at', review_time, 'review_count', next_reviews, 'lapse_count', next_lapses
  );
  insert into public.card_progress(student_id, card_id, due_at, last_rating, good_streak, last_review_at, review_count, lapse_count)
  values(auth.uid(), target_card, next_due, selected_rating, next_streak, review_time, next_reviews, next_lapses)
  on conflict(student_id, card_id) do update set
    due_at = excluded.due_at, last_rating = excluded.last_rating, good_streak = excluded.good_streak,
    last_review_at = excluded.last_review_at, review_count = excluded.review_count,
    lapse_count = excluded.lapse_count, updated_at = now();
  insert into public.review_logs(student_id, card_id, session_id, rating, state_before, state_after, reviewed_at)
  values(auth.uid(), target_card, target_session, selected_rating, before_state, after_state, review_time)
  returning id into log_id;
  return log_id;
end;
$$;
revoke all on function public.record_review_v2(uuid, uuid, public.review_rating) from public, anon;
grant execute on function public.record_review_v2(uuid, uuid, public.review_rating) to authenticated;

create or replace function public.record_review(
  target_card uuid, target_session uuid, selected_rating public.review_rating,
  previous_state jsonb, next_state jsonb, reviewed_time timestamptz
) returns uuid language plpgsql security definer set search_path = public
as $$
begin
  return public.record_review_v2(target_card, target_session, selected_rating);
end;
$$;

create or replace function public.undo_latest_review(target_session uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare latest public.review_logs;
begin
  if not public.can_act_as_student() then raise exception 'student_mode_required'; end if;
  select * into latest from public.review_logs
    where student_id = auth.uid() and session_id = target_session and undone_at is null
    order by reviewed_at desc, id desc limit 1 for update;
  if latest.id is null then raise exception 'nothing_to_undo'; end if;
  if not exists (
    select 1 from public.card_progress p where p.student_id = auth.uid() and p.card_id = latest.card_id
      and p.due_at is not distinct from (latest.state_after ->> 'due_at')::timestamptz
      and p.good_streak = (latest.state_after ->> 'good_streak')::integer
      and p.last_review_at is not distinct from (latest.state_after ->> 'last_review_at')::timestamptz
  ) then raise exception 'review_conflict'; end if;
  if latest.state_before = '{}'::jsonb then
    delete from public.card_progress where student_id = auth.uid() and card_id = latest.card_id;
  else
    update public.card_progress set
      due_at = (latest.state_before ->> 'due_at')::timestamptz,
      last_rating = (latest.state_before ->> 'last_rating')::public.review_rating,
      good_streak = (latest.state_before ->> 'good_streak')::smallint,
      last_review_at = (latest.state_before ->> 'last_review_at')::timestamptz,
      review_count = (latest.state_before ->> 'review_count')::integer,
      lapse_count = (latest.state_before ->> 'lapse_count')::integer,
      updated_at = now()
    where student_id = auth.uid() and card_id = latest.card_id;
  end if;
  update public.review_logs set undone_at = now() where id = latest.id;
  return latest.card_id;
end;
$$;

create or replace function public.class_student_progress(target_class uuid)
returns table(student_id uuid, studied bigint, total bigint, due bigint, good_reviews bigint, review_count bigint, last_review timestamptz)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if not public.is_teacher_of_class(target_class) then raise exception 'teacher_required'; end if;
  return query
    with published_cards as materialized (
      select c.id from public.cards c join public.lessons l on l.id = c.lesson_id
      where l.class_id = target_class and l.status = 'published'
    ), progress as (
      select p.student_id, count(*) as studied,
        count(*) filter (where p.due_at > now() or p.due_at is null) as not_due
      from public.card_progress p join published_cards c on c.id = p.card_id group by p.student_id
    ), reviews as (
      select r.student_id, count(*) filter (where r.rating = 'good') as good_reviews,
        count(*) as review_count, max(r.reviewed_at) as last_review
      from public.review_logs r join published_cards c on c.id = r.card_id
      where r.undone_at is null group by r.student_id
    ), totals as (select count(*) as total from published_cards)
    select m.student_id, coalesce(p.studied, 0), t.total, t.total - coalesce(p.not_due, 0),
      coalesce(r.good_reviews, 0), coalesce(r.review_count, 0), r.last_review
    from public.class_memberships m cross join totals t
    left join progress p on p.student_id = m.student_id
    left join reviews r on r.student_id = m.student_id
    where m.class_id = target_class;
end;
$$;
revoke all on function public.class_student_progress(uuid) from public, anon;
grant execute on function public.class_student_progress(uuid) to authenticated;
