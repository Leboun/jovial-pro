alter table if exists public.establishment_subscriptions enable row level security;

drop policy if exists "subs_owner_insert" on public.establishment_subscriptions;
create policy "subs_owner_insert"
  on public.establishment_subscriptions for insert
  with check (
    exists (
      select 1
      from public.venues v
      where v.id = establishment_subscriptions.venue_id
        and v.owner_user_id = auth.uid()
    )
  );
