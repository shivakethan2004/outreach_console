create table public.leads (
  phone text primary key
    check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_contact_id text unique,
  name text not null,
  category text not null default '',
  address text not null default '',
  rating text not null default '',
  reviews text not null default '',
  status text not null default 'not_contacted'
    check (status in ('not_contacted', 'in_progress', 'no_answer', 'deal_closed')),
  closed_outcome text
    check (closed_outcome in ('won', 'lost')),
  interest_level text
    check (interest_level in ('cold', 'warm', 'hot')),
  notes text not null default '',
  legacy_payload jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_closed_outcome_matches_status
    check (
      (status = 'deal_closed' and closed_outcome is not null)
      or (status <> 'deal_closed' and closed_outcome is null)
    )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_product_id text,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (legacy_product_id)
);

create table public.lead_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_phone text not null references public.leads(phone) on update cascade on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  interest_status text,
  email text not null default '',
  notes text not null default '',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_phone, product_id),
  check (
    interest_status is null or interest_status in (
      'interested',
      'not_interested',
      'follow_up_needed',
      'meeting_scheduled',
      'demo_completed',
      'converted'
    )
  )
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_phone text not null references public.leads(phone) on update cascade on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  legacy_meeting_key text unique,
  mode text check (mode in ('online', 'offline')),
  scheduled_at timestamp without time zone,
  legacy_date text,
  legacy_time text,
  note text not null default '',
  legacy_payload jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_phone text not null references public.leads(phone) on update cascade on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  type text not null check (type in ('call', 'whatsapp', 'meeting')),
  scheduled_at timestamp without time zone,
  note text not null check (length(btrim(note)) > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'meeting') or meeting_id is null)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_phone text references public.leads(phone) on update cascade on delete set null,
  legacy_contact_id text,
  source_changelog_id text unique,
  type text not null
    check (type in ('call', 'whatsapp', 'meeting', 'deal', 'note', 'task', 'legacy')),
  outcome text,
  occurred_at timestamp without time zone not null default (now() at time zone 'UTC'),
  note text not null default '',
  is_call_attempt boolean not null default false,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_phone text references public.leads(phone) on update cascade on delete set null,
  title text not null check (length(btrim(title)) > 0),
  note text not null default '',
  due_at timestamp without time zone,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_call_target integer not null default 30 check (daily_call_target > 0),
  reengagement_days integer not null default 4 check (reengagement_days between 1 and 30),
  time_zone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);

create table public.legacy_migration_review (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_file text not null,
  legacy_record_key text not null,
  issue_code text not null,
  source_payload jsonb not null,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'resolved', 'dismissed')),
  resolution_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (source_file, legacy_record_key)
);

create index lead_products_product_id_idx on public.lead_products(product_id);
create index meetings_owner_scheduled_at_idx on public.meetings(owner_id, scheduled_at);
create index follow_ups_owner_schedule_idx on public.follow_ups(owner_id, status, scheduled_at);
create index activities_owner_occurred_at_idx on public.activities(owner_id, occurred_at desc);
create index activities_owner_call_attempt_idx
  on public.activities(owner_id, occurred_at desc)
  where is_call_attempt;
create index activities_lead_phone_idx on public.activities(lead_phone, occurred_at desc);
create index tasks_owner_due_at_idx on public.tasks(owner_id, status, due_at);
create index legacy_migration_review_owner_status_idx
  on public.legacy_migration_review(owner_id, review_status);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();
create trigger lead_products_set_updated_at
  before update on public.lead_products
  for each row execute function public.set_updated_at();
create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();
create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger crm_settings_set_updated_at
  before update on public.crm_settings
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.products enable row level security;
alter table public.lead_products enable row level security;
alter table public.meetings enable row level security;
alter table public.follow_ups enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.crm_settings enable row level security;
alter table public.legacy_migration_review enable row level security;

grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.lead_products to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.follow_ups to authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.crm_settings to authenticated;
grant select, insert, update, delete on public.legacy_migration_review to authenticated;

create policy "Owner manages leads"
  on public.leads for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages products"
  on public.products for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages lead products"
  on public.lead_products for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages meetings"
  on public.meetings for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages follow ups"
  on public.follow_ups for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner reads activities"
  on public.activities for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owner appends activities"
  on public.activities for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages tasks"
  on public.tasks for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages CRM settings"
  on public.crm_settings for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owner manages migration review"
  on public.legacy_migration_review for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
