alter table public.lead_products
  add column is_active boolean not null default true;

create index lead_products_active_product_idx
  on public.lead_products(owner_id, product_id, lead_phone)
  where is_active;

create function public.set_lead_products(
  p_phone text,
  p_product_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_requested_count integer;
  v_unique_count integer;
  v_owned_count integer;
  v_added text;
  v_removed text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if not exists (
    select 1
    from public.leads
    where phone = p_phone and owner_id = auth.uid() and not is_archived
  ) then
    raise exception 'Lead not found.';
  end if;

  v_requested_count := cardinality(coalesce(p_product_ids, '{}'::uuid[]));
  select count(distinct requested.product_id)
  into v_unique_count
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) as requested(product_id);
  if v_requested_count <> v_unique_count then
    raise exception 'Duplicate products are not allowed.';
  end if;

  select count(distinct id)
  into v_owned_count
  from public.products
  where owner_id = auth.uid()
    and id = any(coalesce(p_product_ids, '{}'::uuid[]));
  if v_owned_count <> v_requested_count then
    raise exception 'One or more selected products are unavailable.';
  end if;

  select string_agg(product.name, ', ' order by product.name)
  into v_removed
  from public.lead_products relation
  join public.products product on product.id = relation.product_id
  where relation.owner_id = auth.uid()
    and relation.lead_phone = p_phone
    and relation.is_active
    and not (relation.product_id = any(coalesce(p_product_ids, '{}'::uuid[])));

  select string_agg(product.name, ', ' order by product.name)
  into v_added
  from public.products product
  where product.owner_id = auth.uid()
    and product.id = any(coalesce(p_product_ids, '{}'::uuid[]))
    and not exists (
      select 1
      from public.lead_products relation
      where relation.owner_id = auth.uid()
        and relation.lead_phone = p_phone
        and relation.product_id = product.id
        and relation.is_active
    );

  update public.lead_products
  set is_active = false
  where owner_id = auth.uid()
    and lead_phone = p_phone
    and is_active
    and not (product_id = any(coalesce(p_product_ids, '{}'::uuid[])));

  insert into public.lead_products (owner_id, lead_phone, product_id, is_active)
  select auth.uid(), p_phone, requested.product_id, true
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) as requested(product_id)
  on conflict (lead_phone, product_id)
  do update set is_active = true;

  if v_added is not null or v_removed is not null then
    insert into public.activities (
      owner_id, lead_phone, type, outcome, occurred_at, note
    )
    values (
      auth.uid(), p_phone, 'note', 'products_updated', public.owner_local_now(),
      concat_ws(
        ' ',
        case when v_added is not null then 'Added: ' || v_added || '.' end,
        case when v_removed is not null then 'Removed: ' || v_removed || '.' end
      )
    );
  end if;
end;
$$;

revoke all on function public.set_lead_products(text, uuid[]) from public, anon;
grant execute on function public.set_lead_products(text, uuid[]) to authenticated;
