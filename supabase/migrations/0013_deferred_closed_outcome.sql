alter table public.leads
  drop constraint if exists leads_closed_outcome_check,
  drop constraint if exists leads_closed_outcome_matches_status,
  add constraint leads_closed_outcome_check
    check (closed_outcome in ('won', 'lost', 'deferred')),
  add constraint leads_closed_outcome_matches_status
    check (
      (status = 'deal_closed' and closed_outcome is not null)
      or (status <> 'deal_closed' and closed_outcome is null)
    );

create or replace function public.update_lead_status(
  p_phone text,
  p_status text,
  p_closed_outcome text default null,
  p_amount_received integer default null
)
returns public.leads
language plpgsql
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_old_status text;
  v_old_outcome text;
  v_old_won_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if p_status is null or p_status not in ('not_contacted', 'in_progress', 'no_answer', 'deal_closed') then
    raise exception 'Choose a valid lead status.';
  end if;
  if (p_status = 'deal_closed' and (
    p_closed_outcome is null or p_closed_outcome not in ('won', 'lost', 'deferred')
  ))
    or (p_status <> 'deal_closed' and p_closed_outcome is not null)
  then
    raise exception 'Closed leads require a Won, Lost, or Not now outcome.';
  end if;
  if p_status = 'deal_closed' and p_closed_outcome = 'won'
    and (p_amount_received is null or p_amount_received <= 0)
  then
    raise exception 'Enter the amount received for a won deal.';
  end if;
  if (p_status <> 'deal_closed' or p_closed_outcome <> 'won')
    and p_amount_received is not null
  then
    raise exception 'Only won deals can have an amount received.';
  end if;

  select status, closed_outcome, won_at into v_old_status, v_old_outcome, v_old_won_at
  from public.leads
  where phone = p_phone and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Lead not found.';
  end if;

  update public.leads
  set status = p_status,
      closed_outcome = p_closed_outcome,
      amount_received = p_amount_received,
      won_at = case
        when p_status = 'deal_closed' and p_closed_outcome = 'won'
          then coalesce(v_old_won_at, now())
        else null
      end
  where phone = p_phone and owner_id = auth.uid()
  returning * into v_lead;

  if p_status = 'deal_closed' then
    update public.follow_ups
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'pending';
    update public.meetings
    set status = 'cancelled'
    where lead_phone = p_phone and owner_id = auth.uid() and status = 'scheduled';
    if p_closed_outcome = 'deferred' then
      update public.tasks
      set status = 'cancelled'
      where lead_phone = p_phone and owner_id = auth.uid() and status = 'pending';
    end if;
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

revoke all on function public.update_lead_status(text, text, text, integer) from public, anon;
grant execute on function public.update_lead_status(text, text, text, integer) to authenticated;
