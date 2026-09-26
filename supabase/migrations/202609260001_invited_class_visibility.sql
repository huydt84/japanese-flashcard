create policy "students read invited classes" on public.classes for select
  using (
    public.can_act_as_student()
    and exists (
      select 1
      from public.class_invitations i
      where i.class_id = classes.id
        and i.recipient_id = auth.uid()
        and i.status = 'pending'
    )
  );
