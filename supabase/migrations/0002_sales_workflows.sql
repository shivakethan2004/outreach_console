create function public.owner_local_now()
returns timestamp without time zone
language sql
stable
set search_path = public
as $$
  select now() at time zone coalesce(
    (
      select time_zone
      from public.crm_settings
      where owner_id = auth.uid()
    ),
    'Asia/Kolkata'
  )
$$;

alter table public.activities
  alter column occurred_at set default public.owner_local_now();

create function public.create_lead(
  p_phone text,
  p_name text,
  p_category text default '',
  p_address text default '',
  p_rating text default '',
  p_reviews text default '',
  p_notes text default '',
  p_product_ids uuid[] default '{}'
)
returns public.leads
language plpgsql
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_requested_products integer;
  v_available_products integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Lead name is required.';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid normalized phone number.';
  end if;

  select count(distinct requested.product_id) into v_requested_products
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) as requested(product_id);
  select count(distinct id) into v_available_products
  from public.products
  where owner_id = auth.uid()
    and is_active
    and id = any(coalesce(p_product_ids, '{}'::uuid[]));
  if v_requested_products <> v_available_products then
    raise exception 'One or more selected products are unavailable.';
  end if;

  insert into public.leads (
    phone, owner_id, name, category, address, rating, reviews, notes
  )
  values (
    p_phone, auth.uid(), btrim(p_name), coalesce(p_category, ''),
    coalesce(p_address, ''), coalesce(p_rating, ''), coalesce(p_reviews, ''),
    coalesce(p_notes, '')
  )
  returning * into v_lead;

  insert into public.lead_products (owner_id, lead_phone, product_id)
  select auth.uid(), p_phone, requested.product_id
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) as requested(product_id)
  on conflict (lead_phone, product_id) do nothing;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(), p_phone, 'note', 'lead_created',
    public.owner_local_now(), 'Lead created.'
  );

  return v_lead;
end;
$$;

create function public.update_lead_status(
  p_phone text,
  p_status text,
  p_closed_outcome text default null
)
returns public.leads
language plpgsql
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_old_status text;
  v_old_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if p_status is null or p_status not in ('not_contacted', 'in_progress', 'no_answer', 'deal_closed') then
    raise exception 'Choose a valid lead status.';
  end if;
  if (p_status = 'deal_closed' and (
    p_closed_outcome is null or p_closed_outcome not in ('won', 'lost')
  ))
    or (p_status <> 'deal_closed' and p_closed_outcome is not null)
  then
    raise exception 'Closed leads require a Won or Lost outcome.';
  end if;

  select status, closed_outcome into v_old_status, v_old_outcome
  from public.leads
  where phone = p_phone and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Lead not found.';
  end if;

  update public.leads
  set status = p_status, closed_outcome = p_closed_outcome
  where phone = p_phone and owner_id = auth.uid()
  returning * into v_lead;

  if p_status = 'deal_closed' then
    update public.follow_ups
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'pending';
    update public.meetings
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'scheduled';
  end if;

  if v_old_status is distinct from p_status or v_old_outcome is distinct from p_closed_outcome then
    insert into public.activities (
      owner_id, lead_phone, type, outcome, occurred_at, note
    )
    values (
      auth.uid(), p_phone,
      case when p_status = 'deal_closed' then 'deal' else 'note' end,
      coalesce(p_closed_outcome, p_status),
      public.owner_local_now(),
      format('Lead status changed from %s to %s.', v_old_status, p_status)
    );
  end if;

  return v_lead;
end;
$$;

create function public.log_call(
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
  if v_lead.status = 'deal_closed' then
    raise exception 'Closed leads cannot be called until reopened.';
  end if;
  if p_outcome is null or p_outcome not in ('no_answer', 'not_interested', 'follow_up', 'meeting') then
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
  if p_outcome in ('no_answer', 'not_interested') and p_follow_up_type is not null then
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
      else 'in_progress'
    end,
    closed_outcome = case when p_outcome = 'not_interested' then 'lost' else null end
  where phone = p_phone and owner_id = auth.uid()
  returning * into v_lead;

  if p_outcome = 'not_interested' then
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

create function public.create_follow_up(
  p_phone text,
  p_type text,
  p_scheduled_at timestamp without time zone,
  p_note text,
  p_meeting_mode text default null,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_meeting_id uuid;
  v_follow_up_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if not exists (
    select 1 from public.leads
    where phone = p_phone and owner_id = auth.uid() and status <> 'deal_closed'
  ) then
    raise exception 'An open lead is required.';
  end if;
  if p_type is null or p_type not in ('call', 'whatsapp', 'meeting') then
    raise exception 'Choose a valid follow-up type.';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'A follow-up note is required.';
  end if;

  if p_type = 'meeting' then
    if p_scheduled_at is null
      or p_meeting_mode is null
      or p_meeting_mode not in ('online', 'offline')
      or p_product_id is null
    then
      raise exception 'Meeting date/time, mode, and product are required.';
    end if;
    if not exists (
      select 1 from public.products
      where id = p_product_id and owner_id = auth.uid() and is_active
    ) then
      raise exception 'The selected product is unavailable.';
    end if;

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
  end if;

  insert into public.follow_ups (
    owner_id, lead_phone, meeting_id, type, scheduled_at, note
  )
  values (
    auth.uid(), p_phone, v_meeting_id, p_type, p_scheduled_at, btrim(p_note)
  )
  returning id into v_follow_up_id;

  update public.leads
  set status = 'in_progress', closed_outcome = null
  where phone = p_phone and owner_id = auth.uid();

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(), p_phone,
    case when p_type = 'meeting' then 'meeting' else 'note' end,
    'follow_up_created', public.owner_local_now(),
    format('Follow-up (%s): %s', p_type, btrim(p_note))
  );

  return jsonb_build_object(
    'follow_up_id', v_follow_up_id,
    'meeting_id', v_meeting_id
  );
end;
$$;

create function public.update_follow_up(
  p_id uuid,
  p_action text,
  p_scheduled_at timestamp without time zone default null
)
returns public.follow_ups
language plpgsql
set search_path = public
as $$
declare
  v_follow_up public.follow_ups%rowtype;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_follow_up
  from public.follow_ups
  where id = p_id and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Follow-up not found.';
  end if;
  if v_follow_up.status <> 'pending' then
    raise exception 'Only pending follow-ups can be changed.';
  end if;

  if p_action = 'complete' then
    update public.follow_ups
    set status = 'completed', completed_at = now()
    where id = p_id
    returning * into v_follow_up;
    if v_follow_up.meeting_id is not null then
      update public.meetings set status = 'completed' where id = v_follow_up.meeting_id;
    end if;
  elsif p_action = 'reschedule' then
    if p_scheduled_at is null then
      raise exception 'Choose a new date and time.';
    end if;
    update public.follow_ups
    set scheduled_at = p_scheduled_at
    where id = p_id
    returning * into v_follow_up;
    if v_follow_up.meeting_id is not null then
      update public.meetings
      set scheduled_at = p_scheduled_at
      where id = v_follow_up.meeting_id;
    end if;
  elsif p_action = 'cancel' then
    update public.follow_ups
    set status = 'cancelled'
    where id = p_id
    returning * into v_follow_up;
    if v_follow_up.meeting_id is not null then
      update public.meetings set status = 'cancelled' where id = v_follow_up.meeting_id;
    end if;
  elsif p_action = 'close_not_interested' then
    update public.leads
    set status = 'deal_closed', closed_outcome = 'lost'
    where phone = v_follow_up.lead_phone and owner_id = auth.uid();
    update public.follow_ups
    set status = 'cancelled'
    where id = p_id and owner_id = auth.uid()
    returning * into v_follow_up;
    update public.follow_ups
    set status = 'cancelled'
    where lead_phone = v_follow_up.lead_phone
      and owner_id = auth.uid()
      and status = 'pending';
    update public.meetings
    set status = 'cancelled'
    where lead_phone = v_follow_up.lead_phone
      and owner_id = auth.uid()
      and status = 'scheduled';
    v_note := 'Lead closed as not interested; remaining scheduled items cancelled.';
  else
    raise exception 'Unsupported follow-up action.';
  end if;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(), v_follow_up.lead_phone,
    case when p_action = 'close_not_interested' then 'deal' else 'note' end,
    p_action, public.owner_local_now(),
    coalesce(v_note, format('Follow-up %s: %s', p_action, v_follow_up.note))
  );

  return v_follow_up;
end;
$$;

create function public.create_task(
  p_title text,
  p_note text default '',
  p_due_at timestamp without time zone default null,
  p_phone text default null
)
returns public.tasks
language plpgsql
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'Task title is required.';
  end if;
  if p_phone is not null and not exists (
    select 1 from public.leads
    where phone = p_phone and owner_id = auth.uid() and not is_archived
  ) then
    raise exception 'The selected lead is unavailable.';
  end if;

  insert into public.tasks (owner_id, lead_phone, title, note, due_at)
  values (auth.uid(), p_phone, btrim(p_title), coalesce(p_note, ''), p_due_at)
  returning * into v_task;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(), p_phone, 'task', 'created',
    public.owner_local_now(), btrim(p_title)
  );

  return v_task;
end;
$$;

create function public.update_task(
  p_id uuid,
  p_action text,
  p_due_at timestamp without time zone default null
)
returns public.tasks
language plpgsql
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  select * into v_task
  from public.tasks
  where id = p_id and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Task not found.';
  end if;
  if v_task.status <> 'pending' then
    raise exception 'Only pending tasks can be changed.';
  end if;

  if p_action = 'complete' then
    update public.tasks
    set status = 'completed', completed_at = now()
    where id = p_id
    returning * into v_task;
  elsif p_action = 'cancel' then
    update public.tasks
    set status = 'cancelled'
    where id = p_id
    returning * into v_task;
  elsif p_action = 'reschedule' and p_due_at is not null then
    update public.tasks
    set due_at = p_due_at
    where id = p_id
    returning * into v_task;
  else
    raise exception 'Choose a valid task action.';
  end if;

  insert into public.activities (
    owner_id, lead_phone, type, outcome, occurred_at, note
  )
  values (
    auth.uid(), v_task.lead_phone, 'task', p_action,
    public.owner_local_now(), v_task.title
  );

  return v_task;
end;
$$;

revoke all on function public.log_call(text, text, text, text, timestamp without time zone, text, uuid) from public, anon;
revoke all on function public.owner_local_now() from public, anon;
revoke all on function public.create_lead(text, text, text, text, text, text, text, uuid[]) from public, anon;
revoke all on function public.update_lead_status(text, text, text) from public, anon;
revoke all on function public.create_follow_up(text, text, timestamp without time zone, text, text, uuid) from public, anon;
revoke all on function public.update_follow_up(uuid, text, timestamp without time zone) from public, anon;
revoke all on function public.create_task(text, text, timestamp without time zone, text) from public, anon;
revoke all on function public.update_task(uuid, text, timestamp without time zone) from public, anon;
grant execute on function public.create_lead(text, text, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_lead_status(text, text, text) to authenticated;
grant execute on function public.log_call(text, text, text, text, timestamp without time zone, text, uuid) to authenticated;
grant execute on function public.owner_local_now() to authenticated;
grant execute on function public.create_follow_up(text, text, timestamp without time zone, text, text, uuid) to authenticated;
grant execute on function public.update_follow_up(uuid, text, timestamp without time zone) to authenticated;
grant execute on function public.create_task(text, text, timestamp without time zone, text) to authenticated;
grant execute on function public.update_task(uuid, text, timestamp without time zone) to authenticated;
