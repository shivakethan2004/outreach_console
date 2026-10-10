create table public.advisor_memory (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  content text not null default '' check (length(content) <= 20000),
  updated_at timestamptz not null default now()
);

create trigger advisor_memory_set_updated_at
  before update on public.advisor_memory
  for each row execute function public.set_updated_at();

alter table public.advisor_memory enable row level security;

grant select, insert, update on public.advisor_memory to authenticated;

create policy "Owner manages advisor memory"
  on public.advisor_memory for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
