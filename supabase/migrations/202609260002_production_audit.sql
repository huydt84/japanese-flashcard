-- Deliver invitations atomically without granting teachers access to arbitrary profiles/notifications.
create or replace function public.send_class_invitation(target_class uuid, recipient_email text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare recipient public.profiles; invitation_id uuid; normalized_email text := lower(trim(recipient_email));
begin
  if not public.is_teacher_of_class(target_class) then raise exception 'teacher_required'; end if;
  if normalized_email is null or char_length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;
  select * into recipient from public.profiles where email = normalized_email;
  if recipient.role = 'teacher' then raise exception 'teacher_recipient'; end if;
  insert into public.class_invitations(class_id, invited_by, email, recipient_id)
    values(target_class, auth.uid(), normalized_email, recipient.id) returning id into invitation_id;
  if recipient.id is not null then
    insert into public.notifications(user_id, kind, invitation_id) values(recipient.id, 'class_invitation', invitation_id);
  end if;
  return invitation_id;
end;
$$;
revoke all on function public.send_class_invitation(uuid, text) from public, anon;
grant execute on function public.send_class_invitation(uuid, text) to authenticated;

-- Keep the badge consistent even when an invitation is revoked via the database API.
create or replace function public.dismiss_resolved_invitation_notification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status <> 'pending' then
    update public.notifications set read_at = coalesce(read_at, now()) where invitation_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.dismiss_resolved_invitation_notification() from public, anon, authenticated;
create trigger dismiss_resolved_invitation_notification
  after update of status on public.class_invitations
  for each row execute function public.dismiss_resolved_invitation_notification();

-- NULL is not a valid recipient. SQL <> previously allowed an unclaimed invitation through.
create or replace function public.accept_class_invitation(target_invitation uuid, accept_invitation boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare invitation public.class_invitations;
begin
  if not public.can_act_as_student() then raise exception 'student_mode_required'; end if;
  select * into invitation from public.class_invitations
   where id = target_invitation and status = 'pending' for update;
  if invitation.id is null or invitation.recipient_id is distinct from auth.uid() then raise exception 'invitation_not_available'; end if;
  if accept_invitation then
    insert into public.class_memberships(class_id, student_id) values(invitation.class_id, auth.uid()) on conflict do nothing;
    update public.class_invitations set status = 'accepted', responded_at = now() where id = target_invitation;
  else
    update public.class_invitations set status = 'declined', responded_at = now() where id = target_invitation;
  end if;
  update public.notifications set read_at = coalesce(read_at, now()) where invitation_id = target_invitation and user_id = auth.uid();
end;
$$;

-- Aggregate inside PostgreSQL: no raw review history transfer or REST row-limit truncation.
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
      select p.student_id, count(*) as studied, count(*) filter (where p.due_at > now()) as not_due
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

create index if not exists lessons_class_id on public.lessons(class_id);
create index if not exists cards_lesson_id on public.cards(lesson_id);
create index if not exists card_progress_card_id on public.card_progress(card_id);
create index if not exists review_logs_card_id_active on public.review_logs(card_id) where undone_at is null;
