create function public.update_meeting(
  p_id uuid,
  p_action text,
  p_scheduled_at timestamp without time zone default null
)
returns public.meetings
language plpgsql
set search_path = public
as $$
declare
  v_meeting public.meetings%rowtype;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_meeting
  from public.meetings
  where id = p_id and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Meeting not found.';
  end if;
  if v_meeting.status <> 'scheduled' then
    raise exception 'Only scheduled meetings can be changed.';
  end if;

  if p_action = 'complete' then
    update public.meetings
    set status = 'completed'
    where id = p_id
    returning * into v_meeting;
    update public.follow_ups
    set status = 'completed', completed_at = now()
    where meeting_id = p_id and owner_id = auth.uid() and status = 'pending';
  elsif p_action = 'reschedule' then
    if p_scheduled_at is null then
      raise exception 'Choose a new date and time.';
    end if;
    update public.meetings
    set scheduled_at = p_scheduled_at, legacy_date = null, legacy_time = null
    where id = p_id
    returning * into v_meeting;
    update public.follow_ups
    set scheduled_at = p_scheduled_at
    where meeting_id = p_id and owner_id = auth.uid() and status = 'pending';
  elsif p_action = 'cancel' then
    update public.meetings
    set status = 'cancelled'
    where id = p_id
    returning * into v_meeting;
    update public.follow_ups
    set status = 'cancelled'
    where meeting_id = p_id and owner_id = auth.uid() and status = 'pending';
  elsif p_action = 'close_not_interested' then
    update public.leads
    set status = 'deal_closed', closed_outcome = 'lost'
    where phone = v_meeting.lead_phone and owner_id = auth.uid();
    update public.follow_ups
    set status = 'cancelled'
    where lead_phone = v_meeting.lead_phone
      and owner_id = auth.uid()
      and status = 'pending';
    update public.meetings
    set status = 'cancelled'
    where lead_phone = v_meeting.lead_phone
      and owner_id = auth.uid()
      and status = 'scheduled';
    select * into v_meeting
    from public.meetings
    where id = p_id and owner_id = auth.uid();
    v_note := 'Lead closed as not interested; remaining scheduled items cancelled.';
  else
    raise exception 'Choose a valid meeting action.';
  end if;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(),
    v_meeting.lead_phone,
    case when p_action = 'close_not_interested' then 'deal' else 'meeting' end,
    p_action,
    public.owner_local_now(),
    coalesce(v_note, format('Meeting %s: %s', p_action, v_meeting.note))
  );

  return v_meeting;
end;
$$;

revoke all on function public.update_meeting(uuid, text, timestamp without time zone) from public, anon;
grant execute on function public.update_meeting(uuid, text, timestamp without time zone) to authenticated;
