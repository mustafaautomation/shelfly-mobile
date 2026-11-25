-- Copied unchanged from the Shelfly web app (supabase/migrations/20261125120000_shelfly_init.sql).
-- The web app owns this schema. Apply it once per Supabase project; the mobile app only reads it
-- and calls public.apply_movement / public.receive_purchase_order with the user's JWT.

-- Shelfly multi-tenant inventory schema.
-- Explicit grants are required: new public tables are not exposed to the Data API
-- until anon/authenticated/service_role are granted privileges.
-- Authorization lives in memberships and profiles.is_super_admin, never in user_metadata.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  title text not null default '',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  industry text not null default '',
  plan text not null default 'starter' check (plan in ('starter', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'warehouse_staff', 'viewer')),
  unique (tenant_id, user_id)
);

create table public.warehouses (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null,
  address text not null default '',
  city text not null default '',
  unique (tenant_id, code)
);

create table public.locations (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  warehouse_id text not null references public.warehouses (id) on delete cascade,
  name text not null,
  code text not null
);

create table public.products (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  sku text not null,
  name text not null,
  description text not null default '',
  barcode text not null default '',
  category text not null default 'Uncategorized',
  unit text not null check (unit in ('each', 'lb', 'kg', 'bag', 'case', 'oz', 'qt')),
  cost_cents integer not null check (cost_cents >= 0),
  reorder_point integer not null check (reorder_point >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table public.stock_levels (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  location_id text not null references public.locations (id) on delete cascade,
  qty integer not null,
  unique (product_id, location_id)
);

create table public.movements (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  type text not null check (type in ('receive', 'adjust', 'transfer')),
  product_id text not null references public.products (id),
  qty integer not null check (qty > 0),
  signed_qty integer not null check (signed_qty <> 0),
  from_location_id text references public.locations (id),
  to_location_id text references public.locations (id),
  reason text not null default '',
  reference text,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default ''
);

create table public.purchase_orders (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  number text not null,
  supplier_id text not null references public.suppliers (id),
  warehouse_id text not null references public.warehouses (id),
  status text not null check (status in ('draft', 'sent', 'partial', 'received')),
  notes text not null default '',
  expected_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table public.po_lines (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  purchase_order_id text not null references public.purchase_orders (id) on delete cascade,
  product_id text not null references public.products (id),
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  check (qty_received <= qty_ordered)
);

create table public.alerts (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  kind text not null default 'low_stock' check (kind = 'low_stock'),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_status text not null default 'mock' check (email_status in ('mock', 'sent', 'skipped'))
);

create table public.email_log (
  id text primary key,
  tenant_id text not null references public.tenants (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('mock', 'resend'))
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_tenant_id_idx on public.memberships (tenant_id);
create index warehouses_tenant_id_idx on public.warehouses (tenant_id);
create index locations_tenant_id_idx on public.locations (tenant_id);
create index locations_warehouse_id_idx on public.locations (warehouse_id);
create index products_tenant_id_idx on public.products (tenant_id);
create index products_tenant_barcode_idx on public.products (tenant_id, barcode);
create index stock_levels_tenant_id_idx on public.stock_levels (tenant_id);
create index stock_levels_location_id_idx on public.stock_levels (location_id);
create index movements_tenant_created_idx on public.movements (tenant_id, created_at desc);
create index movements_product_id_idx on public.movements (product_id);
create index movements_from_location_idx on public.movements (from_location_id);
create index movements_to_location_idx on public.movements (to_location_id);
create index suppliers_tenant_id_idx on public.suppliers (tenant_id);
create index purchase_orders_tenant_status_idx on public.purchase_orders (tenant_id, status);
create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_warehouse_id_idx on public.purchase_orders (warehouse_id);
create index po_lines_purchase_order_id_idx on public.po_lines (purchase_order_id);
create index po_lines_product_id_idx on public.po_lines (product_id);
create index po_lines_tenant_id_idx on public.po_lines (tenant_id);
create index alerts_unread_idx on public.alerts (tenant_id, created_at desc) where read_at is null;
create index alerts_product_id_idx on public.alerts (product_id);
create index email_log_tenant_id_idx on public.email_log (tenant_id);

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_super_admin
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

create or replace function private.can_read(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.tenant_id = p_tenant_id
    );
$$;

create or replace function private.can_write(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.tenant_id = p_tenant_id
        and m.role in ('owner', 'warehouse_staff')
    );
$$;

create or replace function private.can_admin(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.tenant_id = p_tenant_id
        and m.role = 'owner'
    );
$$;

revoke all on function private.is_super_admin() from public, anon;
revoke all on function private.can_read(text) from public, anon;
revoke all on function private.can_write(text) from public, anon;
revoke all on function private.can_admin(text) from public, anon;
grant execute on function private.is_super_admin() to authenticated, service_role;
grant execute on function private.can_read(text) to authenticated, service_role;
grant execute on function private.can_write(text) to authenticated, service_role;
grant execute on function private.can_admin(text) to authenticated, service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile id is immutable.';
  end if;
  if new.is_super_admin is distinct from old.is_super_admin
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Only the service role can change super admin.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
before update on public.profiles
for each row execute function private.guard_profile();

create or replace function private.reject_movement_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Movements are an immutable audit log.';
end;
$$;

create trigger movements_immutable
before update or delete on public.movements
for each row execute function private.reject_movement_change();

create or replace function private.guard_alert_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
     or new.product_id is distinct from old.product_id
     or new.kind is distinct from old.kind
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at
     or new.email_status is distinct from old.email_status then
    raise exception 'Alerts can only be marked read.';
  end if;
  return new;
end;
$$;

create trigger alerts_read_only_body
before update on public.alerts
for each row execute function private.guard_alert_update();

create or replace function private.sync_low_stock(p_tenant_id text, p_product_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer;
  v_reorder integer;
  v_name text;
  v_sku text;
  v_unit text;
  v_message text;
  v_owner uuid;
  v_email text;
begin
  select name, sku, unit, reorder_point
    into v_name, v_sku, v_unit, v_reorder
  from public.products
  where id = p_product_id and tenant_id = p_tenant_id;

  if v_sku is null then
    return;
  end if;

  select coalesce(sum(qty), 0)
    into v_on_hand
  from public.stock_levels
  where product_id = p_product_id and tenant_id = p_tenant_id;

  if v_on_hand > v_reorder then
    return;
  end if;

  if exists (
    select 1 from public.alerts
    where tenant_id = p_tenant_id and product_id = p_product_id and read_at is null
  ) then
    return;
  end if;

  v_message := v_name || ' (' || v_sku || ') is at ' || v_on_hand || ' ' || v_unit
    || ', at or below the reorder point of ' || v_reorder || '.';

  insert into public.alerts (id, tenant_id, product_id, kind, message, email_status)
  values (
    'alt_' || replace(gen_random_uuid()::text, '-', ''),
    p_tenant_id,
    p_product_id,
    'low_stock',
    v_message,
    'mock'
  );

  select m.user_id into v_owner
  from public.memberships m
  where m.tenant_id = p_tenant_id and m.role = 'owner'
  limit 1;

  if v_owner is not null then
    select email into v_email from public.profiles where id = v_owner;
    if v_email is not null and v_email <> '' then
      insert into public.email_log (id, tenant_id, to_email, subject, body, provider)
      values (
        'eml_' || replace(gen_random_uuid()::text, '-', ''),
        p_tenant_id,
        v_email,
        'Low stock: ' || v_sku,
        v_message,
        'mock'
      );
    end if;
  end if;
end;
$$;

revoke all on function private.sync_low_stock(text, text) from public, anon, authenticated;
grant execute on function private.sync_low_stock(text, text) to service_role;

create or replace function private.lock_stock(p_tenant_id text, p_product_id text, p_location_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty integer;
begin
  insert into public.stock_levels (id, tenant_id, product_id, location_id, qty)
  values (p_product_id || ':' || p_location_id, p_tenant_id, p_product_id, p_location_id, 0)
  on conflict (product_id, location_id) do nothing;

  select qty into v_qty
  from public.stock_levels
  where product_id = p_product_id and location_id = p_location_id
  for update;

  return v_qty;
end;
$$;

revoke all on function private.lock_stock(text, text, text) from public, anon, authenticated;
grant execute on function private.lock_stock(text, text, text) to service_role;

create or replace function private.apply_movement(
  p_tenant_id text,
  p_type text,
  p_product_id text,
  p_signed_qty integer,
  p_from_location_id text,
  p_to_location_id text,
  p_reason text,
  p_reference text
)
returns public.movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_from integer;
  v_to integer;
  v_next integer;
  v_reason text := coalesce(p_reason, '');
  v_movement public.movements;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required.';
  end if;
  if not private.can_write(p_tenant_id) then
    raise exception 'You cannot change inventory in this workspace.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'That SKU is not in this workspace.';
  end if;

  if p_type = 'receive' then
    if p_signed_qty is null or p_signed_qty <= 0 then
      raise exception 'Receive quantity must be greater than zero.';
    end if;
    if p_to_location_id is null or not exists (
      select 1 from public.locations
      where id = p_to_location_id and tenant_id = p_tenant_id
    ) then
      raise exception 'That location is not in this workspace.';
    end if;
    v_to := private.lock_stock(p_tenant_id, p_product_id, p_to_location_id);
    update public.stock_levels set qty = v_to + p_signed_qty
    where product_id = p_product_id and location_id = p_to_location_id;
    insert into public.movements (
      id, tenant_id, type, product_id, qty, signed_qty, from_location_id, to_location_id, reason, reference, created_by
    ) values (
      'mov_' || replace(gen_random_uuid()::text, '-', ''),
      p_tenant_id, 'receive', p_product_id, p_signed_qty, p_signed_qty,
      null, p_to_location_id, case when btrim(v_reason) = '' then 'Receipt' else btrim(v_reason) end,
      p_reference, (select auth.uid())::text
    ) returning * into v_movement;

  elsif p_type = 'adjust' then
    if p_signed_qty is null or p_signed_qty = 0 then
      raise exception 'Adjustment cannot be zero.';
    end if;
    if p_to_location_id is null and p_from_location_id is null then
      raise exception 'Choose a location.';
    end if;
    if not exists (
      select 1 from public.locations
      where id = coalesce(p_to_location_id, p_from_location_id) and tenant_id = p_tenant_id
    ) then
      raise exception 'That location is not in this workspace.';
    end if;
    v_from := private.lock_stock(p_tenant_id, p_product_id, coalesce(p_to_location_id, p_from_location_id));
    v_next := v_from + p_signed_qty;
    if v_next < 0 and btrim(v_reason) = '' then
      raise exception 'Stock cannot go negative without an explicit adjust reason.';
    end if;
    update public.stock_levels set qty = v_next
    where product_id = p_product_id and location_id = coalesce(p_to_location_id, p_from_location_id);
    insert into public.movements (
      id, tenant_id, type, product_id, qty, signed_qty, from_location_id, to_location_id, reason, reference, created_by
    ) values (
      'mov_' || replace(gen_random_uuid()::text, '-', ''),
      p_tenant_id, 'adjust', p_product_id, abs(p_signed_qty), p_signed_qty,
      case when p_signed_qty < 0 then coalesce(p_from_location_id, p_to_location_id) else null end,
      case when p_signed_qty > 0 then coalesce(p_to_location_id, p_from_location_id) else null end,
      case when btrim(v_reason) = '' then 'Adjustment' else btrim(v_reason) end,
      p_reference, (select auth.uid())::text
    ) returning * into v_movement;

  elsif p_type = 'transfer' then
    if p_signed_qty is null or p_signed_qty <= 0 then
      raise exception 'Transfer quantity must be greater than zero.';
    end if;
    if p_from_location_id is null or p_to_location_id is null or p_from_location_id = p_to_location_id then
      raise exception 'Choose two different locations.';
    end if;
    if not exists (
      select 1 from public.locations where id = p_from_location_id and tenant_id = p_tenant_id
    ) or not exists (
      select 1 from public.locations where id = p_to_location_id and tenant_id = p_tenant_id
    ) then
      raise exception 'That location is not in this workspace.';
    end if;
    if p_from_location_id < p_to_location_id then
      v_from := private.lock_stock(p_tenant_id, p_product_id, p_from_location_id);
      v_to := private.lock_stock(p_tenant_id, p_product_id, p_to_location_id);
    else
      v_to := private.lock_stock(p_tenant_id, p_product_id, p_to_location_id);
      v_from := private.lock_stock(p_tenant_id, p_product_id, p_from_location_id);
    end if;
    if v_from < p_signed_qty then
      raise exception 'Source location does not have enough on-hand stock to transfer.';
    end if;
    update public.stock_levels set qty = v_from - p_signed_qty
    where product_id = p_product_id and location_id = p_from_location_id;
    update public.stock_levels set qty = v_to + p_signed_qty
    where product_id = p_product_id and location_id = p_to_location_id;
    insert into public.movements (
      id, tenant_id, type, product_id, qty, signed_qty, from_location_id, to_location_id, reason, reference, created_by
    ) values (
      'mov_' || replace(gen_random_uuid()::text, '-', ''),
      p_tenant_id, 'transfer', p_product_id, p_signed_qty, p_signed_qty,
      p_from_location_id, p_to_location_id,
      case when btrim(v_reason) = '' then 'Transfer' else btrim(v_reason) end,
      p_reference, (select auth.uid())::text
    ) returning * into v_movement;
  else
    raise exception 'Unknown movement type.';
  end if;

  perform private.sync_low_stock(p_tenant_id, p_product_id);
  return v_movement;
end;
$$;

revoke all on function private.apply_movement(text, text, text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function private.apply_movement(text, text, text, integer, text, text, text, text) to service_role;

create or replace function public.apply_movement(
  p_tenant_id text,
  p_type text,
  p_product_id text,
  p_signed_qty integer,
  p_from_location_id text,
  p_to_location_id text,
  p_reason text,
  p_reference text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select to_jsonb(private.apply_movement(
    p_tenant_id,
    p_type,
    p_product_id,
    p_signed_qty,
    p_from_location_id,
    p_to_location_id,
    p_reason,
    p_reference
  ));
$$;

revoke all on function public.apply_movement(text, text, text, integer, text, text, text, text) from public, anon;
grant execute on function public.apply_movement(text, text, text, integer, text, text, text, text) to authenticated, service_role;

-- The public wrapper is security invoker, so authenticated needs to execute the private function.
grant execute on function private.apply_movement(text, text, text, integer, text, text, text, text) to authenticated;

create or replace function public.receive_purchase_order(
  p_tenant_id text,
  p_purchase_order_id text,
  p_location_id text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_po public.purchase_orders;
  v_line jsonb;
  v_row public.po_lines;
  v_qty integer;
  v_location public.locations;
  v_any boolean := false;
begin
  if not private.can_write(p_tenant_id) then
    raise exception 'You cannot change inventory in this workspace.';
  end if;

  select * into v_po
  from public.purchase_orders
  where id = p_purchase_order_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'Purchase order not found.';
  end if;
  if v_po.status = 'draft' then
    raise exception 'Send the purchase order before receiving it.';
  end if;
  if v_po.status = 'received' then
    raise exception 'This purchase order is already fully received.';
  end if;

  select * into v_location
  from public.locations
  where id = p_location_id and tenant_id = p_tenant_id;
  if not found or v_location.warehouse_id is distinct from v_po.warehouse_id then
    raise exception 'Receive into a location that belongs to the purchase order warehouse.';
  end if;

  for v_line in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_qty := (v_line ->> 'qty')::integer;
    if v_qty is null or v_qty = 0 then
      continue;
    end if;
    if v_qty < 0 then
      raise exception 'Receipt quantity must be a whole number of zero or more.';
    end if;
    select * into v_row
    from public.po_lines
    where id = v_line ->> 'line_id' and purchase_order_id = v_po.id and tenant_id = p_tenant_id;
    if not found then
      raise exception 'A receipt line does not belong to this order.';
    end if;
    if v_row.qty_received + v_qty > v_row.qty_ordered then
      raise exception 'Cannot receive more than the remaining quantity.';
    end if;
    perform public.apply_movement(
      p_tenant_id, 'receive', v_row.product_id, v_qty, null, p_location_id,
      'Received on ' || v_po.number, v_po.id
    );
    update public.po_lines
    set qty_received = qty_received + v_qty
    where id = v_row.id;
    v_any := true;
  end loop;

  if not v_any then
    raise exception 'Enter a quantity to receive.';
  end if;

  update public.purchase_orders po
  set status = case
        when not exists (
          select 1 from public.po_lines l
          where l.purchase_order_id = po.id and l.qty_received < l.qty_ordered
        ) then 'received'
        else 'partial'
      end,
      updated_at = now()
  where po.id = v_po.id
  returning * into v_po;

  return to_jsonb(v_po);
end;
$$;

revoke all on function public.receive_purchase_order(text, text, text, jsonb) from public, anon;
grant execute on function public.receive_purchase_order(text, text, text, jsonb) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.warehouses enable row level security;
alter table public.locations enable row level security;
alter table public.products enable row level security;
alter table public.stock_levels enable row level security;
alter table public.movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_lines enable row level security;
alter table public.alerts enable row level security;
alter table public.email_log enable row level security;

alter table public.profiles force row level security;
alter table public.tenants force row level security;
alter table public.memberships force row level security;
alter table public.warehouses force row level security;
alter table public.locations force row level security;
alter table public.products force row level security;
alter table public.stock_levels force row level security;
alter table public.movements force row level security;
alter table public.suppliers force row level security;
alter table public.purchase_orders force row level security;
alter table public.po_lines force row level security;
alter table public.alerts force row level security;
alter table public.email_log force row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_super_admin())
  or id in (
    select m.user_id from public.memberships m
    where m.tenant_id in (
      select m2.tenant_id from public.memberships m2 where m2.user_id = (select auth.uid())
    )
  )
);

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()) or (select private.is_super_admin()))
with check (id = (select auth.uid()) or (select private.is_super_admin()));

create policy tenants_select on public.tenants
for select to authenticated
using ((select private.can_read(id)));

create policy tenants_update on public.tenants
for update to authenticated
using ((select private.can_admin(id)))
with check ((select private.can_admin(id)));

create policy memberships_select on public.memberships
for select to authenticated
using ((select private.can_read(tenant_id)) or user_id = (select auth.uid()));

create policy memberships_insert on public.memberships
for insert to authenticated
with check ((select private.can_admin(tenant_id)));

create policy memberships_update on public.memberships
for update to authenticated
using ((select private.can_admin(tenant_id)))
with check ((select private.can_admin(tenant_id)));

create policy memberships_delete on public.memberships
for delete to authenticated
using ((select private.can_admin(tenant_id)));

create policy warehouses_select on public.warehouses
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy warehouses_write on public.warehouses
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy warehouses_update on public.warehouses
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy locations_select on public.locations
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy locations_insert on public.locations
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy locations_update on public.locations
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy products_select on public.products
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy products_insert on public.products
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy products_update on public.products
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy stock_select on public.stock_levels
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy movements_select on public.movements
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy suppliers_select on public.suppliers
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy suppliers_insert on public.suppliers
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy suppliers_update on public.suppliers
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy po_select on public.purchase_orders
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy po_insert on public.purchase_orders
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy po_update on public.purchase_orders
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy pol_select on public.po_lines
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy pol_insert on public.po_lines
for insert to authenticated
with check ((select private.can_write(tenant_id)));

create policy pol_update on public.po_lines
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy alerts_select on public.alerts
for select to authenticated
using ((select private.can_read(tenant_id)));

create policy alerts_update on public.alerts
for update to authenticated
using ((select private.can_write(tenant_id)))
with check ((select private.can_write(tenant_id)));

create policy email_select on public.email_log
for select to authenticated
using ((select private.can_read(tenant_id)));

grant usage on schema public to anon, authenticated, service_role;

grant select, update on public.profiles to authenticated;
grant select, update on public.tenants to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update on public.warehouses to authenticated;
grant select, insert, update on public.locations to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.stock_levels to authenticated;
grant select on public.movements to authenticated;
grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.po_lines to authenticated;
grant select, update on public.alerts to authenticated;
grant select on public.email_log to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
