-- ISOPoz — Migration 0005 : finance (factures, paiements, relances)
-- Exécuter après 0004. Idempotent autant que possible.

-- ============================================================
-- Enum
-- ============================================================
do $$ begin
  create type invoice_status as enum
    ('brouillon','envoyee','en_attente','partiellement_payee','payee','en_retard','annulee');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Factures
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,      -- règle 6
  project_id uuid references public.projects(id) on delete set null,  -- règle 6
  issue_date date not null default current_date,
  due_date date,
  status invoice_status not null default 'brouillon',
  payment_terms text,
  notes text,
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  created_by uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();
create index if not exists idx_invoices_client on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(status);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  description text,
  qty numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  vat_bps integer not null default 2000,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_items_inv on public.invoice_items(invoice_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  paid_at date not null default current_date,
  amount_cents bigint not null,
  method text,
  reference text,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  level integer not null default 1,
  sent_at timestamptz not null default now(),
  template_id uuid references public.document_templates(id) on delete set null,
  channel text default 'email',
  note text,
  created_by uuid references public.users(id) on delete set null
);
create index if not exists idx_reminders_invoice on public.reminders(invoice_id);

-- ============================================================
-- Recalcul serveur des totaux d'une facture
-- ============================================================
create or replace function public.recompute_invoice_totals(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_subtotal bigint; v_vat bigint;
begin
  update public.invoice_items ii
    set line_total_cents = round(ii.qty * ii.unit_price_cents)
    where ii.invoice_id = p_invoice_id;
  select coalesce(sum(line_total_cents),0), coalesce(sum(round(line_total_cents * vat_bps / 10000.0)),0)
    into v_subtotal, v_vat
  from public.invoice_items where invoice_id = p_invoice_id;
  update public.invoices
    set subtotal_cents = v_subtotal, vat_cents = v_vat, total_cents = v_subtotal + v_vat
    where id = p_invoice_id;
end; $$;

-- Recalcule le statut d'une facture selon les paiements (hors brouillon/annulée).
create or replace function public.refresh_invoice_status(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_paid bigint; v_status invoice_status;
begin
  select total_cents, status into v_total, v_status from public.invoices where id = p_invoice_id;
  if v_status in ('brouillon','annulee') then return; end if;
  select coalesce(sum(amount_cents),0) into v_paid from public.payments where invoice_id = p_invoice_id;
  if v_paid >= v_total and v_total > 0 then
    update public.invoices set status = 'payee' where id = p_invoice_id;
  elsif v_paid > 0 then
    update public.invoices set status = 'partiellement_payee' where id = p_invoice_id;
  else
    update public.invoices set status = 'en_attente' where id = p_invoice_id;
  end if;
end; $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments      enable row level security;
alter table public.reminders     enable row level security;

drop policy if exists inv_sel on public.invoices;
create policy inv_sel on public.invoices for select using ( auth_is_super_admin() or auth_has_permission('invoices.view') );
drop policy if exists inv_ins on public.invoices;
create policy inv_ins on public.invoices for insert with check ( auth_is_super_admin() or auth_has_permission('invoices.create') );
drop policy if exists inv_upd on public.invoices;
create policy inv_upd on public.invoices for update using ( auth_is_super_admin() or auth_has_permission('invoices.edit') or auth_has_permission('invoices.send') or auth_has_permission('invoices.mark_paid') ) with check ( auth_is_super_admin() or auth_has_permission('invoices.edit') or auth_has_permission('invoices.send') or auth_has_permission('invoices.mark_paid') );
drop policy if exists inv_del on public.invoices;
create policy inv_del on public.invoices for delete using ( auth_is_super_admin() or auth_has_permission('invoices.delete') );

drop policy if exists ii_sel on public.invoice_items;
create policy ii_sel on public.invoice_items for select using ( auth_is_super_admin() or auth_has_permission('invoices.view') );
drop policy if exists ii_wr on public.invoice_items;
create policy ii_wr on public.invoice_items for all using ( auth_is_super_admin() or auth_has_permission('invoices.create') or auth_has_permission('invoices.edit') ) with check ( auth_is_super_admin() or auth_has_permission('invoices.create') or auth_has_permission('invoices.edit') );

drop policy if exists pay_sel on public.payments;
create policy pay_sel on public.payments for select using ( auth_is_super_admin() or auth_has_permission('payments.view') or auth_has_permission('invoices.view') );
drop policy if exists pay_wr on public.payments;
create policy pay_wr on public.payments for all using ( auth_is_super_admin() or auth_has_permission('payments.create') or auth_has_permission('payments.edit') ) with check ( auth_is_super_admin() or auth_has_permission('payments.create') or auth_has_permission('payments.edit') );

drop policy if exists rem_sel on public.reminders;
create policy rem_sel on public.reminders for select using ( auth_is_super_admin() or auth_has_permission('reminders.view') or auth_has_permission('invoices.view') );
drop policy if exists rem_wr on public.reminders;
create policy rem_wr on public.reminders for all using ( auth_is_super_admin() or auth_has_permission('reminders.create') or auth_has_permission('reminders.send') ) with check ( auth_is_super_admin() or auth_has_permission('reminders.create') or auth_has_permission('reminders.send') );
