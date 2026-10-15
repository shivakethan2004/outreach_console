create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'active' and started_at is not null and completed_at is null)
    or (status = 'draft' and completed_at is null)
    or (status = 'completed' and completed_at is not null))
);

create table public.campaign_leads (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_phone text not null references public.leads(phone) on update cascade on delete cascade,
  added_at timestamptz not null default now(),
  primary key (campaign_id, lead_phone)
);

create table public.campaign_scripts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  content text not null default '',
  file_path text,
  file_name text,
  created_at timestamptz not null default now(),
  check ((file_path is null and file_name is null) or (file_path is not null and file_name is not null))
);

create table public.campaign_calls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_phone text not null references public.leads(phone) on update cascade on delete cascade,
  outcome text not null check (outcome in ('no_answer', 'not_interested', 'follow_up', 'meeting')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  answered boolean not null,
  is_conversation boolean generated always as (duration_seconds > 60) stored,
  called_at timestamptz not null default now()
);

create index campaign_leads_phone_idx on public.campaign_leads(lead_phone);
create index campaign_calls_campaign_called_at_idx on public.campaign_calls(campaign_id, called_at desc);
create index campaign_scripts_campaign_idx on public.campaign_scripts(campaign_id, created_at);

alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.campaign_scripts enable row level security;
alter table public.campaign_calls enable row level security;

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, delete on public.campaign_leads to authenticated;
grant select, insert, update, delete on public.campaign_scripts to authenticated;
grant select, insert on public.campaign_calls to authenticated;

create policy "Owner manages campaigns" on public.campaigns
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owner manages campaign leads" on public.campaign_leads
  for all to authenticated using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy "Owner manages campaign scripts" on public.campaign_scripts
  for all to authenticated using (
    owner_id = auth.uid() and exists (
      select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid()
    )
  ) with check (
    owner_id = auth.uid() and exists (
      select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );
create policy "Owner manages campaign calls" on public.campaign_calls
  for all to authenticated using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-pdfs', 'campaign-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "Owner manages campaign PDF objects" on storage.objects
  for all to authenticated using (
    bucket_id = 'campaign-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'campaign-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create function public.create_campaign(
  p_name text,
  p_selection_mode text,
  p_lead_phones text[] default '{}',
  p_random_count integer default null
)
returns public.campaigns
language plpgsql
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_requested text[];
  v_available integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Campaign name is required.'; end if;
  if p_selection_mode not in ('manual', 'random') then raise exception 'Choose manual or random lead selection.'; end if;

  if p_selection_mode = 'manual' then
    select coalesce(array_agg(distinct phone), '{}') into v_requested
    from unnest(coalesce(p_lead_phones, '{}')) as phones(phone);
    if cardinality(v_requested) = 0 then raise exception 'Select at least one lead.'; end if;
    if exists (
      select 1 from unnest(v_requested) requested(phone)
      where not exists (
        select 1 from public.leads l
        where l.phone = requested.phone and l.owner_id = auth.uid()
          and not l.is_archived and l.status <> 'deal_closed' and l.call_priority <> 'not_calling'
      )
    ) then raise exception 'One or more selected leads are no longer eligible.'; end if;
  else
    if p_random_count is null or p_random_count < 1 or p_random_count > 500 then
      raise exception 'Choose a random lead count from 1 to 500.';
    end if;
    select count(*) into v_available from public.leads l
    where l.owner_id = auth.uid() and not l.is_archived
      and l.status <> 'deal_closed' and l.call_priority <> 'not_calling'
      and not exists (
        select 1 from public.campaign_leads cl
        join public.campaigns c on c.id = cl.campaign_id
        where cl.lead_phone = l.phone and c.owner_id = auth.uid() and c.status = 'active'
      );
    if v_available < p_random_count then
      raise exception 'Only % eligible leads are available for random selection.', v_available;
    end if;
  end if;

  insert into public.campaigns (owner_id, name)
  values (auth.uid(), btrim(p_name))
  returning * into v_campaign;

  if p_selection_mode = 'manual' then
    insert into public.campaign_leads (campaign_id, lead_phone)
    select v_campaign.id, unnest(v_requested);
  else
    insert into public.campaign_leads (campaign_id, lead_phone)
    select v_campaign.id, l.phone
    from public.leads l
    where l.owner_id = auth.uid() and not l.is_archived
      and l.status <> 'deal_closed' and l.call_priority <> 'not_calling'
      and not exists (
        select 1 from public.campaign_leads cl
        join public.campaigns c on c.id = cl.campaign_id
        where cl.lead_phone = l.phone and c.owner_id = auth.uid() and c.status = 'active'
      )
    order by random()
    limit p_random_count;
  end if;
  return v_campaign;
end;
$$;

revoke all on function public.create_campaign(text, text, text[], integer) from public;
grant execute on function public.create_campaign(text, text, text[], integer) to authenticated;

create function public.log_campaign_call(
  p_campaign_id uuid,
  p_phone text,
  p_outcome text,
  p_note text,
  p_follow_up_type text,
  p_scheduled_at timestamp without time zone,
  p_meeting_mode text,
  p_product_id uuid,
  p_duration_seconds integer
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_call_id uuid;
begin
  if p_duration_seconds is null or p_duration_seconds < 0 or p_duration_seconds > 86400 then
    raise exception 'Call duration must be between 0 and 24 hours.';
  end if;
  if not exists (
    select 1 from public.campaigns c
    join public.campaign_leads cl on cl.campaign_id = c.id
    where c.id = p_campaign_id and c.owner_id = auth.uid() and c.status = 'active'
      and cl.lead_phone = p_phone
  ) then raise exception 'The lead is not part of an active campaign.'; end if;

  perform public.log_call(
    p_phone, p_outcome, p_note, p_follow_up_type, p_scheduled_at, p_meeting_mode, p_product_id
  );

  insert into public.campaign_calls (campaign_id, lead_phone, outcome, duration_seconds, answered)
  values (p_campaign_id, p_phone, p_outcome, p_duration_seconds, p_outcome <> 'no_answer')
  returning id into v_call_id;
  return v_call_id;
end;
$$;

revoke all on function public.log_campaign_call(
  uuid, text, text, text, text, timestamp without time zone, text, uuid, integer
) from public;
grant execute on function public.log_campaign_call(
  uuid, text, text, text, text, timestamp without time zone, text, uuid, integer
) to authenticated;
