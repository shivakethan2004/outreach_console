update public.leads l
set status = 'in_progress',
    closed_outcome = null,
    is_archived = true,
    archived_at = coalesce(l.archived_at, now())
where l.status = 'deal_closed'
  and l.closed_outcome = 'lost'
  and exists (
    select 1
    from public.activities a
    where a.lead_phone = l.phone
      and a.type = 'call'
      and a.outcome = 'not_qualified'
      and not exists (
        select 1
        from public.activities newer
        where newer.lead_phone = l.phone
          and newer.occurred_at > a.occurred_at
          and (
            (newer.type = 'call' and newer.outcome in ('not_interested', 'not_qualified'))
            or (newer.type = 'deal' and newer.outcome in ('won', 'lost'))
          )
      )
  );

create or replace function public.log_call(
  p_phone text,
  p_outcome text,
  p_note text default '',
  p_follow_up_type text default null,
  p_scheduled_at timestamp without time zone default null,
  p_meeting_mode text default null,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_meeting_id uuid;
  v_follow_up_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_lead
  from public.leads
  where phone = p_phone and owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'Lead not found.';
  end if;
  if v_lead.is_archived then
    raise exception 'Archived leads cannot be called.';
  end if;
  if v_lead.status = 'deal_closed' then
    raise exception 'Closed leads cannot be called until reopened.';
  end if;
  if p_outcome is null or p_outcome not in (
    'no_answer', 'not_interested', 'not_qualified', 'wrong_lead', 'follow_up', 'meeting'
  ) then
    raise exception 'Unsupported call outcome.';
  end if;
  if p_outcome = 'follow_up' and (
    p_follow_up_type is null
    or p_follow_up_type not in ('call', 'whatsapp', 'meeting')
  ) then
    raise exception 'Choose a valid follow-up type.';
  end if;
  if p_outcome = 'meeting' and p_follow_up_type is distinct from 'meeting' then
    p_follow_up_type := 'meeting';
  end if;
  if p_outcome in ('no_answer', 'not_interested', 'not_qualified', 'wrong_lead')
    and p_follow_up_type is not null
  then
    raise exception 'This call outcome cannot create a follow-up.';
  end if;
  if p_outcome = 'follow_up' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'A follow-up note is required.';
  end if;
  if p_follow_up_type = 'meeting' then
    if p_scheduled_at is null
      or p_meeting_mode is null
      or p_meeting_mode not in ('online', 'offline')
      or p_product_id is null
    then
      raise exception 'Meeting type, date/time, mode, and product are required.';
    end if;
    if length(btrim(coalesce(p_note, ''))) = 0 then
      raise exception 'A meeting note is required.';
    end if;
    if not exists (
      select 1 from public.products
      where id = p_product_id and owner_id = auth.uid() and is_active
    ) then
      raise exception 'The selected product is unavailable.';
    end if;
  end if;

  update public.leads
  set
    status = case
      when p_outcome = 'no_answer' then 'no_answer'
      when p_outcome = 'not_interested' then 'deal_closed'
      when p_outcome in ('not_qualified', 'wrong_lead') then v_lead.status
      else 'in_progress'
    end,
    closed_outcome = case when p_outcome = 'not_interested' then 'lost' else null end,
    is_archived = case
      when p_outcome in ('not_qualified', 'wrong_lead') then true
      else is_archived
    end,
    archived_at = case
      when p_outcome in ('not_qualified', 'wrong_lead') then now()
      else archived_at
    end
  where phone = p_phone and owner_id = auth.uid()
  returning * into v_lead;

  if p_outcome in ('not_interested', 'not_qualified', 'wrong_lead') then
    update public.follow_ups
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'pending';
    update public.meetings
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'scheduled';
  end if;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note, is_call_attempt
  )
  values (
    auth.uid(), p_phone, 'call', p_outcome, public.owner_local_now(),
    coalesce(p_note, ''), true
  );

  if p_follow_up_type = 'meeting' then
    insert into public.meetings (
      owner_id, lead_phone, product_id, mode, scheduled_at, note
    )
    values (
      auth.uid(), p_phone, p_product_id, p_meeting_mode, p_scheduled_at, btrim(p_note)
    )
    returning id into v_meeting_id;

    insert into public.lead_products (owner_id, lead_phone, product_id)
    values (auth.uid(), p_phone, p_product_id)
    on conflict (lead_phone, product_id) do nothing;

    insert into public.follow_ups (
      owner_id, lead_phone, meeting_id, type, scheduled_at, note
    )
    values (
      auth.uid(), p_phone, v_meeting_id, 'meeting', p_scheduled_at, btrim(p_note)
    )
    returning id into v_follow_up_id;

    insert into public.activities (
      owner_id, lead_phone, type, outcome, occurred_at, note
    )
    values (
      auth.uid(), p_phone, 'meeting', 'scheduled', public.owner_local_now(), btrim(p_note)
    );
  elsif p_outcome = 'follow_up' then
    insert into public.follow_ups (
      owner_id, lead_phone, type, scheduled_at, note
    )
    values (
      auth.uid(), p_phone, p_follow_up_type, p_scheduled_at, btrim(p_note)
    )
    returning id into v_follow_up_id;

    insert into public.activities (
      owner_id, lead_phone, type, outcome, occurred_at, note
    )
    values (
      auth.uid(), p_phone, 'note', 'follow_up_created',
      public.owner_local_now(),
      format('Follow-up (%s): %s', p_follow_up_type, btrim(p_note))
    );
  end if;

  return jsonb_build_object(
    'lead', to_jsonb(v_lead),
    'meeting_id', v_meeting_id,
    'follow_up_id', v_follow_up_id
  );
end;
$$;
