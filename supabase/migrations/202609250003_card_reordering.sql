create or replace function public.move_card(target_card uuid, movement text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_card public.cards;
  neighbor_card public.cards;
  target_class uuid;
begin
  if movement not in ('up', 'down') then
    raise exception 'Hướng di chuyển không hợp lệ';
  end if;

  select c.* into current_card
  from public.cards c
  where c.id = target_card
  for update;

  select class_id into target_class
  from public.lessons
  where id = current_card.lesson_id;

  if current_card.id is null or not public.is_teacher_of_class(target_class) then
    raise exception 'Không có quyền sắp xếp thẻ';
  end if;

  if movement = 'up' then
    select * into neighbor_card
    from public.cards
    where lesson_id = current_card.lesson_id
      and position < current_card.position
    order by position desc, created_at desc
    limit 1
    for update;
  else
    select * into neighbor_card
    from public.cards
    where lesson_id = current_card.lesson_id
      and position > current_card.position
    order by position asc, created_at asc
    limit 1
    for update;
  end if;

  if neighbor_card.id is null then
    return;
  end if;

  update public.cards
  set position = case
    when id = current_card.id then neighbor_card.position
    else current_card.position
  end,
  updated_at = now()
  where id in (current_card.id, neighbor_card.id);
end;
$$;

grant execute on function public.move_card(uuid, text) to authenticated;
