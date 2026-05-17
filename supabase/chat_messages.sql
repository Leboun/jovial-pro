-- Public chat room messages.
-- Safe to run multiple times.

create table if not exists public.chat_messages (
  id bigserial primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

alter table public.chat_messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at asc);

create index if not exists chat_messages_sender_idx
  on public.chat_messages (sender_id, created_at desc);

create index if not exists chat_messages_recipient_idx
  on public.chat_messages (recipient_id, created_at desc);

do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
  end;
end $$;

alter table public.chat_messages enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table public.chat_messages to authenticated;

drop policy if exists "chat_messages_read_authenticated" on public.chat_messages;
drop policy if exists "chat_messages_read_related" on public.chat_messages;
create policy "chat_messages_read_related"
  on public.chat_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages for insert
  with check (auth.uid() = sender_id and recipient_id is not null and recipient_id <> sender_id);
