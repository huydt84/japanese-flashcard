alter table public.profiles
  add column if not exists active_mode text
  constraint profiles_active_mode_check check (active_mode in ('teacher', 'student'));

create or replace function public.can_act_as_teacher()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'teacher' or (role = 'admin' and active_mode = 'teacher'))
  )
$$;

create or replace function public.can_act_as_student()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'student' or (role = 'admin' and coalesce(active_mode, 'student') = 'student'))
  )
$$;

create or replace function public.is_teacher_of_class(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_act_as_teacher() and exists(
    select 1 from public.classes where id = target_class and teacher_id = auth.uid()
  )
$$;

create or replace function public.is_student_of_class(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_act_as_student() and exists(
    select 1 from public.class_memberships where class_id = target_class and student_id = auth.uid()
  )
$$;

create or replace function public.set_my_role(chosen_role public.user_role)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare result public.profiles;
begin
  if chosen_role = 'admin' then raise exception 'admin_role_is_privileged'; end if;
  update public.profiles
     set role = chosen_role, active_mode = null, onboarding_completed_at = now(), updated_at = now()
   where id = auth.uid() and role is null
   returning * into result;
  if result.id is null then raise exception 'role_already_selected'; end if;
  if chosen_role = 'student' then perform public.claim_pending_invitations(); end if;
  return result;
end;
$$;

create or replace function public.set_admin_mode(selected_mode text)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare result public.profiles;
begin
  if selected_mode not in ('teacher', 'student') then raise exception 'invalid_admin_mode'; end if;
  update public.profiles
     set active_mode = selected_mode, updated_at = now()
   where id = auth.uid() and role = 'admin'
   returning * into result;
  if result.id is null then raise exception 'admin_required'; end if;
  return result;
end;
$$;

create or replace function public.claim_pending_invitations()
returns integer language plpgsql security definer set search_path = public
as $$
declare claimed integer;
begin
  if not public.can_act_as_student() then return 0; end if;
  update public.class_invitations i
     set recipient_id = auth.uid()
   where i.status = 'pending'
     and i.recipient_id is null
     and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  get diagnostics claimed = row_count;
  insert into public.notifications(user_id, kind, invitation_id)
  select auth.uid(), 'class_invitation', i.id
    from public.class_invitations i
   where i.status = 'pending' and i.recipient_id = auth.uid()
  on conflict (invitation_id) where invitation_id is not null do nothing;
  return claimed;
end;
$$;

create or replace function public.accept_class_invitation(target_invitation uuid, accept_invitation boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare invitation public.class_invitations;
begin
  if not public.can_act_as_student() then raise exception 'student_mode_required'; end if;
  select * into invitation from public.class_invitations
   where id = target_invitation and status = 'pending' for update;
  if invitation.id is null or invitation.recipient_id <> auth.uid() then raise exception 'invitation_not_available'; end if;
  if accept_invitation then
    insert into public.class_memberships(class_id, student_id) values(invitation.class_id, auth.uid()) on conflict do nothing;
    update public.class_invitations set status = 'accepted', responded_at = now() where id = target_invitation;
  else
    update public.class_invitations set status = 'declined', responded_at = now() where id = target_invitation;
  end if;
  update public.notifications set read_at = coalesce(read_at, now()) where invitation_id = target_invitation and user_id = auth.uid();
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
   order by reviewed_at desc limit 1 for update;
  if latest.id is null then raise exception 'nothing_to_undo'; end if;
  if latest.state_before = '{}'::jsonb then
    delete from public.card_progress where student_id = auth.uid() and card_id = latest.card_id;
  else
    update public.card_progress set
      fsrs = latest.state_before,
      due_at = coalesce((latest.state_before ->> 'due')::timestamptz, latest.reviewed_at),
      last_review_at = (latest.state_before ->> 'last_review')::timestamptz,
      review_count = coalesce((latest.state_before ->> 'reps')::integer, 0),
      lapse_count = coalesce((latest.state_before ->> 'lapses')::integer, 0),
      updated_at = now()
    where student_id = auth.uid() and card_id = latest.card_id;
  end if;
  update public.review_logs set undone_at = now() where id = latest.id;
  return latest.card_id;
end;
$$;

drop policy if exists "teachers own classes" on public.classes;
create policy "teachers own classes" on public.classes for all
  using (public.can_act_as_teacher() and teacher_id = auth.uid())
  with check (public.can_act_as_teacher() and teacher_id = auth.uid());

drop policy if exists "students read own memberships" on public.class_memberships;
create policy "students read own memberships" on public.class_memberships for select
  using (public.can_act_as_student() and student_id = auth.uid());

drop policy if exists "students read own invitations" on public.class_invitations;
create policy "students read own invitations" on public.class_invitations for select
  using (public.can_act_as_student() and recipient_id = auth.uid());

drop policy if exists "students manage own progress" on public.card_progress;
create policy "students manage own progress" on public.card_progress for all
  using (public.can_act_as_student() and student_id = auth.uid())
  with check (public.can_act_as_student() and student_id = auth.uid());

drop policy if exists "students read own logs" on public.review_logs;
create policy "students read own logs" on public.review_logs for select
  using (public.can_act_as_student() and student_id = auth.uid());

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select
  using (public.can_act_as_student() and user_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update
  using (public.can_act_as_student() and user_id = auth.uid())
  with check (public.can_act_as_student() and user_id = auth.uid());

revoke execute on function public.set_admin_mode(text) from public;
grant execute on function public.set_admin_mode(text) to authenticated;

update public.profiles
   set role = 'admin', active_mode = 'student', onboarding_completed_at = coalesce(onboarding_completed_at, now()), updated_at = now()
 where email = 'viethuy061002@gmail.com';
