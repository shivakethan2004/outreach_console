create table public.campaign_outreach_rates (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  call_to_answer_rate numeric not null default 0.55
    check (call_to_answer_rate between 0 and 1),
  call_to_follow_up_rate numeric not null default 0
    check (call_to_follow_up_rate between 0 and 1),
  call_to_in_progress_rate numeric not null default 0
    check (call_to_in_progress_rate between 0 and 1),
  call_to_deal_closed_rate numeric not null default 0.01
    check (call_to_deal_closed_rate between 0 and 1),
  conversation_to_deal_closed_rate numeric not null default 0.02
    check (conversation_to_deal_closed_rate between 0 and 1),
  expected_deal_amount integer not null default 24000
    check (expected_deal_amount > 0),
  updated_at timestamptz not null default now()
);

alter table public.campaign_outreach_rates enable row level security;

grant select, insert, update on public.campaign_outreach_rates to authenticated;

create policy "Owner manages campaign outreach rates"
  on public.campaign_outreach_rates
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger campaign_outreach_rates_set_updated_at
  before update on public.campaign_outreach_rates
  for each row execute function public.set_updated_at();

insert into public.campaign_outreach_rates (owner_id)
select owner_id from public.crm_settings
union
select owner_id from public.campaigns
on conflict (owner_id) do nothing;
