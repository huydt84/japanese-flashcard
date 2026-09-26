create extension if not exists pgcrypto;

create type public.user_role as enum ('teacher', 'student');
create type public.lesson_status as enum ('draft', 'published');
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'revoked');
create type public.review_rating as enum ('again', 'hard', 'good');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role public.user_role,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint normalized_profile_email check (email = lower(trim(email)))
);
create unique index profiles_email_unique on public.profiles (lower(email));

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 240),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  recipient_id uuid references public.profiles(id) on delete set null,
  status public.invitation_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint normalized_invitation_email check (email = lower(trim(email)))
);
create unique index one_pending_invitation_per_class_email
  on public.class_invitations (class_id, lower(email)) where status = 'pending';

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '' check (char_length(description) <= 300),
  status public.lesson_status not null default 'draft',
  position integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  kanji text not null check (char_length(kanji) between 1 and 80),
  hiragana text not null check (char_length(hiragana) between 1 and 120),
  meaning_vi text not null check (char_length(meaning_vi) between 1 and 240),
  example_ja text not null check (char_length(example_ja) between 1 and 500),
  example_vi text not null check (char_length(example_vi) between 1 and 500),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  fsrs jsonb not null default '{}'::jsonb,
  due_at timestamptz not null default now(),
  last_review_at timestamptz,
  review_count integer not null default 0,
  lapse_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, card_id)
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  session_id uuid not null,
  rating public.review_rating not null,
  state_before jsonb not null,
  state_after jsonb not null,
  reviewed_at timestamptz not null default now(),
  undone_at timestamptz
);
create index review_logs_student_card_time on public.review_logs(student_id, card_id, reviewed_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('class_invitation')),
  invitation_id uuid references public.class_invitations(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_notification_per_invitation on public.notifications(invitation_id) where invitation_id is not null;

create or replace function public.is_teacher_of_class(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.classes where id = target_class and teacher_id = auth.uid()) $$;

create or replace function public.is_student_of_class(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.class_memberships where class_id = target_class and student_id = auth.uid()) $$;

create or replace function public.lesson_class(target_lesson uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select class_id from public.lessons where id = target_lesson $$;

create or replace function public.card_class(target_card uuid)
returns uuid language sql stable security definer set search_path = public
as $$
  select l.class_id from public.cards c join public.lessons l on l.id = c.lesson_id where c.id = target_card
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    lower(trim(coalesce(new.email, ''))),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;
create trigger on_auth_user_created after insert or update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.claim_pending_invitations()
returns integer language plpgsql security definer set search_path = public
as $$
declare claimed integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'student') then
    return 0;
  end if;
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

create or replace function public.set_my_role(chosen_role public.user_role)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare result public.profiles;
begin
  update public.profiles
     set role = chosen_role, onboarding_completed_at = now(), updated_at = now()
   where id = auth.uid() and role is null
   returning * into result;
  if result.id is null then raise exception 'role_already_selected'; end if;
  if chosen_role = 'student' then perform public.claim_pending_invitations(); end if;
  return result;
end;
$$;

create or replace function public.accept_class_invitation(target_invitation uuid, accept_invitation boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare invitation public.class_invitations;
begin
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

create or replace function public.record_review(
  target_card uuid,
  target_session uuid,
  selected_rating public.review_rating,
  previous_state jsonb,
  next_state jsonb,
  reviewed_time timestamptz
) returns uuid language plpgsql security definer set search_path = public
as $$
declare log_id uuid;
declare current_progress public.card_progress;
begin
  if not public.is_student_of_class(public.card_class(target_card)) then raise exception 'not_enrolled'; end if;
  select * into current_progress from public.card_progress where student_id = auth.uid() and card_id = target_card for update;
  if current_progress.student_id is not null and current_progress.fsrs <> previous_state then raise exception 'review_conflict'; end if;
  insert into public.card_progress(student_id, card_id, fsrs, due_at, last_review_at, review_count, lapse_count)
  values(
    auth.uid(), target_card, next_state,
    coalesce((next_state ->> 'due')::timestamptz, reviewed_time), reviewed_time,
    coalesce((next_state ->> 'reps')::integer, 0), coalesce((next_state ->> 'lapses')::integer, 0)
  ) on conflict(student_id, card_id) do update set
    fsrs = excluded.fsrs, due_at = excluded.due_at, last_review_at = excluded.last_review_at,
    review_count = excluded.review_count, lapse_count = excluded.lapse_count, updated_at = now();
  insert into public.review_logs(student_id, card_id, session_id, rating, state_before, state_after, reviewed_at)
  values(auth.uid(), target_card, target_session, selected_rating, previous_state, next_state, reviewed_time)
  returning id into log_id;
  return log_id;
end;
$$;

create or replace function public.undo_latest_review(target_session uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare latest public.review_logs;
begin
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

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.class_invitations enable row level security;
alter table public.lessons enable row level security;
alter table public.cards enable row level security;
alter table public.card_progress enable row level security;
alter table public.review_logs enable row level security;
alter table public.notifications enable row level security;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "teachers read class students" on public.profiles for select using (
  exists(select 1 from public.class_memberships m join public.classes c on c.id = m.class_id where m.student_id = profiles.id and c.teacher_id = auth.uid())
);

create policy "teachers own classes" on public.classes for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "students read joined classes" on public.classes for select using (public.is_student_of_class(id));

create policy "teachers read memberships" on public.class_memberships for select using (public.is_teacher_of_class(class_id));
create policy "students read own memberships" on public.class_memberships for select using (student_id = auth.uid());

create policy "teachers manage invitations" on public.class_invitations for all using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
create policy "students read own invitations" on public.class_invitations for select using (recipient_id = auth.uid());

create policy "teachers manage lessons" on public.lessons for all using (public.is_teacher_of_class(class_id)) with check (public.is_teacher_of_class(class_id));
create policy "students read published lessons" on public.lessons for select using (status = 'published' and public.is_student_of_class(class_id));

create policy "teachers manage cards" on public.cards for all using (public.is_teacher_of_class(public.lesson_class(lesson_id))) with check (public.is_teacher_of_class(public.lesson_class(lesson_id)));
create policy "students read published cards" on public.cards for select using (
  exists(select 1 from public.lessons l where l.id = cards.lesson_id and l.status = 'published' and public.is_student_of_class(l.class_id))
);

create policy "students manage own progress" on public.card_progress for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "teachers read class progress" on public.card_progress for select using (public.is_teacher_of_class(public.card_class(card_id)));
create policy "students read own logs" on public.review_logs for select using (student_id = auth.uid());
create policy "teachers read class logs" on public.review_logs for select using (public.is_teacher_of_class(public.card_class(card_id)));
create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant execute on function public.set_my_role(public.user_role) to authenticated;
grant execute on function public.claim_pending_invitations() to authenticated;
grant execute on function public.accept_class_invitation(uuid, boolean) to authenticated;
grant execute on function public.record_review(uuid, uuid, public.review_rating, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.undo_latest_review(uuid) to authenticated;
