alter table public.leads
  add column call_priority text not null default 'normal'
    check (call_priority in ('normal', 'low', 'not_calling'));
