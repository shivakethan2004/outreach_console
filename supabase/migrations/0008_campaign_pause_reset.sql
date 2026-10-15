alter table public.campaigns
  drop constraint campaigns_status_check,
  drop constraint campaigns_check,
  add column elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  add column active_since timestamptz;

update public.campaigns
set started_at = case
      when status = 'draft' then null
      else coalesce(started_at, completed_at, now())
    end,
    active_since = case when status = 'active' then coalesce(started_at, now()) else null end,
    elapsed_seconds = case
      when status = 'completed' and started_at is not null
        then greatest(0, floor(extract(epoch from (completed_at - started_at)))::integer)
      else 0
    end;

alter table public.campaigns
  add constraint campaigns_status_check
    check (status in ('draft', 'active', 'paused', 'completed')),
  add constraint campaigns_status_timing_check check (
    (status = 'draft' and started_at is null and active_since is null and completed_at is null)
    or (status = 'active' and started_at is not null and active_since is not null and completed_at is null)
    or (status = 'paused' and started_at is not null and active_since is null and completed_at is null)
    or (status = 'completed' and started_at is not null and active_since is null and completed_at is not null)
  );

create function public.update_campaign(p_id uuid, p_action text)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select * into v_campaign
  from public.campaigns
  where id = p_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'Campaign not found.'; end if;

  if p_action = 'start' and v_campaign.status = 'draft' then
    update public.campaigns
    set status = 'active', started_at = v_now, active_since = v_now,
      elapsed_seconds = 0, completed_at = null
    where id = p_id and owner_id = auth.uid()
    returning * into v_campaign;
  elsif p_action = 'pause' and v_campaign.status = 'active' then
    update public.campaigns
    set status = 'paused',
      elapsed_seconds = elapsed_seconds + greatest(0, floor(extract(epoch from (v_now - active_since)))::integer),
      active_since = null
    where id = p_id and owner_id = auth.uid()
    returning * into v_campaign;
  elsif p_action = 'resume' and v_campaign.status = 'paused' then
    update public.campaigns
    set status = 'active', active_since = v_now
    where id = p_id and owner_id = auth.uid()
    returning * into v_campaign;
  elsif p_action = 'complete' and v_campaign.status in ('active', 'paused') then
    update public.campaigns
    set status = 'completed',
      elapsed_seconds = elapsed_seconds + case
        when active_since is null then 0
        else greatest(0, floor(extract(epoch from (v_now - active_since)))::integer)
      end,
      active_since = null,
      completed_at = v_now
    where id = p_id and owner_id = auth.uid()
    returning * into v_campaign;
  elsif p_action = 'reset' then
    delete from public.campaign_calls where campaign_id = p_id;
    update public.campaigns
    set status = 'draft', started_at = null, active_since = null,
      elapsed_seconds = 0, completed_at = null
    where id = p_id and owner_id = auth.uid()
    returning * into v_campaign;
  else
    raise exception 'This action is not available for the campaign''s current status.';
  end if;

  return v_campaign;
end;
$$;

revoke all on function public.update_campaign(uuid, text) from public;
grant execute on function public.update_campaign(uuid, text) to authenticated;
