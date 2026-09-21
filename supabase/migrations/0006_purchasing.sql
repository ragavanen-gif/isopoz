-- ISOPoz — Migration 0006 : achats (fournisseurs, produits, commandes, négociations)
-- Exécuter après 0005. Idempotent autant que possible.

-- ============================================================
-- Enum
-- ============================================================
do $$ begin
  create type po_status as enum ('brouillon','envoyee','negociation','recue','annulee');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Fournisseurs
-- ============================================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  email text,
  phone text,
  address text,
  siret text,
  vat_number text,
  payment_terms text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_suppliers_updated on public.suppliers;
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create index if not exists idx_suppliers_name on public.suppliers(name);

-- ============================================================
-- Produits / marchandises
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  reference text,
  unit text default 'u',
  last_price_cents bigint,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- Commandes fournisseur
-- ============================================================
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  status po_status not null default 'brouillon',
  initial_total_cents bigint not null default 0,   -- somme des lignes (avant négo)
  negotiated_total_cents bigint,                    -- prix final négocié (si accord)
  notes text,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_po_updated on public.purchase_orders;
create trigger trg_po_updated before update on public.purchase_orders
  for each row execute function public.set_updated_at();
create index if not exists idx_po_supplier on public.purchase_orders(supplier_id);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  position integer not null default 0,
  product_id uuid references public.products(id) on delete set null,
  label text not null,
  qty numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_po_items_po on public.purchase_order_items(po_id);

-- Historique de négociation (CDC §27)
create table if not exists public.negotiations (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  at date not null default current_date,
  party text not null default 'isopoz' check (party in ('supplier','isopoz')),
  amount_cents bigint not null,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_negotiations_po on public.negotiations(po_id);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  received_at date not null default current_date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Recalcul du total initial d'une commande
-- ============================================================
create or replace function public.recompute_po_totals(p_po_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  update public.purchase_order_items pi
    set line_total_cents = round(pi.qty * pi.unit_price_cents)
    where pi.po_id = p_po_id;
  select coalesce(sum(line_total_cents),0) into v_total
    from public.purchase_order_items where po_id = p_po_id;
  update public.purchase_orders set initial_total_cents = v_total where id = p_po_id;
end; $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.suppliers            enable row level security;
alter table public.products             enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.negotiations         enable row level security;
alter table public.goods_receipts       enable row level security;

-- suppliers
drop policy if exists sup_sel on public.suppliers;
create policy sup_sel on public.suppliers for select using ( auth_is_super_admin() or auth_has_permission('suppliers.view') );
drop policy if exists sup_ins on public.suppliers;
create policy sup_ins on public.suppliers for insert with check ( auth_is_super_admin() or auth_has_permission('suppliers.create') );
drop policy if exists sup_upd on public.suppliers;
create policy sup_upd on public.suppliers for update using ( auth_is_super_admin() or auth_has_permission('suppliers.edit') ) with check ( auth_is_super_admin() or auth_has_permission('suppliers.edit') );
drop policy if exists sup_del on public.suppliers;
create policy sup_del on public.suppliers for delete using ( auth_is_super_admin() or auth_has_permission('suppliers.delete') );

-- products : lecture suppliers.view, écriture suppliers.edit/create
drop policy if exists prod_sel on public.products;
create policy prod_sel on public.products for select using ( auth_is_super_admin() or auth_has_permission('suppliers.view') or auth_has_permission('orders.view') );
drop policy if exists prod_wr on public.products;
create policy prod_wr on public.products for all using ( auth_is_super_admin() or auth_has_permission('suppliers.edit') or auth_has_permission('suppliers.create') ) with check ( auth_is_super_admin() or auth_has_permission('suppliers.edit') or auth_has_permission('suppliers.create') );

-- purchase_orders
drop policy if exists po_sel on public.purchase_orders;
create policy po_sel on public.purchase_orders for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists po_ins on public.purchase_orders;
create policy po_ins on public.purchase_orders for insert with check ( auth_is_super_admin() or auth_has_permission('orders.create') );
drop policy if exists po_upd on public.purchase_orders;
create policy po_upd on public.purchase_orders for update using ( auth_is_super_admin() or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.edit') );
drop policy if exists po_del on public.purchase_orders;
create policy po_del on public.purchase_orders for delete using ( auth_is_super_admin() or auth_has_permission('orders.delete') );

drop policy if exists poi_sel on public.purchase_order_items;
create policy poi_sel on public.purchase_order_items for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists poi_wr on public.purchase_order_items;
create policy poi_wr on public.purchase_order_items for all using ( auth_is_super_admin() or auth_has_permission('orders.create') or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.create') or auth_has_permission('orders.edit') );

-- negotiations
drop policy if exists nego_sel on public.negotiations;
create policy nego_sel on public.negotiations for select using ( auth_is_super_admin() or auth_has_permission('negotiations.view') or auth_has_permission('orders.view') );
drop policy if exists nego_wr on public.negotiations;
create policy nego_wr on public.negotiations for all using ( auth_is_super_admin() or auth_has_permission('negotiations.create') or auth_has_permission('negotiations.edit') ) with check ( auth_is_super_admin() or auth_has_permission('negotiations.create') or auth_has_permission('negotiations.edit') );

-- goods_receipts
drop policy if exists gr_sel on public.goods_receipts;
create policy gr_sel on public.goods_receipts for select using ( auth_is_super_admin() or auth_has_permission('orders.view') );
drop policy if exists gr_wr on public.goods_receipts;
create policy gr_wr on public.goods_receipts for all using ( auth_is_super_admin() or auth_has_permission('orders.edit') ) with check ( auth_is_super_admin() or auth_has_permission('orders.edit') );
