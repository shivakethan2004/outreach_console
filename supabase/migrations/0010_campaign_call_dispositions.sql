alter table public.campaign_calls
  add column active_elapsed_seconds integer check (active_elapsed_seconds >= 0);

update public.campaign_calls
set duration_seconds = 0,
    answered = false
where outcome in ('not_qualified', 'wrong_lead');

create or replace function public.log_campaign_call(
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
  v_active_elapsed_seconds integer;
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

  select elapsed_seconds + greatest(
    0,
    floor(extract(epoch from (now() - active_since)))::integer
  )
  into v_active_elapsed_seconds
  from public.campaigns
  where id = p_campaign_id and owner_id = auth.uid() and status = 'active';
  if v_active_elapsed_seconds is null then
    raise exception 'The campaign is not active.';
  end if;

  perform public.log_call(
    p_phone, p_outcome, p_note, p_follow_up_type, p_scheduled_at, p_meeting_mode, p_product_id
  );

  if p_outcome in ('not_qualified', 'wrong_lead') then
    p_duration_seconds := 0;
  end if;

  insert into public.campaign_calls (
    campaign_id,
    lead_phone,
    outcome,
    duration_seconds,
    answered,
    active_elapsed_seconds
  )
  values (
    p_campaign_id,
    p_phone,
    p_outcome,
    p_duration_seconds,
    p_outcome not in ('no_answer', 'not_qualified', 'wrong_lead'),
    v_active_elapsed_seconds
  )
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
