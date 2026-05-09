create extension if not exists "pgcrypto" with schema "extensions";

create table if not exists public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  kind text not null,
  is_active boolean not null default true,
  gstin text,
  address text,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_name_key unique (name),
  constraint locations_name_not_blank check (btrim(name) <> ''),
  constraint locations_kind_check check (kind in ('warehouse', 'company', 'partner', 'hospital'))
);

create table if not exists public.items (
  id uuid primary key default extensions.gen_random_uuid(),
  material_code text not null,
  description text,
  uom text not null default 'NOS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_material_code_key unique (material_code),
  constraint items_material_code_not_blank check (btrim(material_code) <> ''),
  constraint items_uom_not_blank check (btrim(uom) <> '')
);

create table if not exists public.company_challans (
  id uuid primary key default extensions.gen_random_uuid(),
  supplier_name text not null,
  delivery_number text not null,
  delivery_date date,
  raw_doc_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_challans_supplier_not_blank check (btrim(supplier_name) <> ''),
  constraint company_challans_delivery_number_not_blank check (btrim(delivery_number) <> ''),
  constraint company_challans_supplier_delivery_key unique (supplier_name, delivery_number)
);

create table if not exists public.company_challan_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  challan_id uuid not null references public.company_challans(id) on delete cascade,
  item_id uuid not null references public.items(id),
  item_number text,
  hsn_code text,
  unit_cost numeric(12, 2),
  qty_received numeric(12, 3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_challan_lines_qty_positive check (qty_received > 0),
  constraint company_challan_lines_unit_cost_non_negative check (unit_cost is null or unit_cost >= 0)
);

create table if not exists public.docs (
  id uuid primary key default extensions.gen_random_uuid(),
  doc_no text not null,
  doc_type text not null,
  doc_date date not null,
  source_location_id uuid not null references public.locations(id),
  dest_location_id uuid not null references public.locations(id),
  counterparty_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_doc_no_key unique (doc_no),
  constraint docs_doc_no_not_blank check (btrim(doc_no) <> ''),
  constraint docs_type_check check (doc_type in ('in', 'out', 'return')),
  constraint docs_different_locations check (source_location_id <> dest_location_id)
);

create table if not exists public.doc_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  challan_line_id uuid not null references public.company_challan_lines(id),
  ticket_code text,
  qty numeric(12, 3) not null,
  material_code text,
  material_description text,
  company_delivery_no text,
  company_delivery_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doc_lines_qty_positive check (qty > 0),
  constraint doc_lines_ticket_code_not_blank check (ticket_code is null or btrim(ticket_code) <> '')
);

create index if not exists idx_locations_kind on public.locations(kind);
create index if not exists idx_items_material_code on public.items(material_code);
create index if not exists idx_company_challans_delivery on public.company_challans(delivery_number);
create index if not exists idx_company_challan_lines_challan_id on public.company_challan_lines(challan_id);
create index if not exists idx_company_challan_lines_item_id on public.company_challan_lines(item_id);
create index if not exists idx_docs_source_location_id on public.docs(source_location_id);
create index if not exists idx_docs_dest_location_id on public.docs(dest_location_id);
create index if not exists idx_docs_doc_date on public.docs(doc_date);
create index if not exists idx_doc_lines_doc_id on public.doc_lines(doc_id);
create index if not exists idx_doc_lines_challan_line_id on public.doc_lines(challan_line_id);
create index if not exists idx_doc_lines_ticket_code on public.doc_lines(ticket_code) where ticket_code is not null;
create index if not exists idx_doc_lines_company_delivery_no on public.doc_lines(company_delivery_no);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists set_items_updated_at on public.items;
create trigger set_items_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists set_company_challans_updated_at on public.company_challans;
create trigger set_company_challans_updated_at
before update on public.company_challans
for each row execute function public.set_updated_at();

drop trigger if exists set_company_challan_lines_updated_at on public.company_challan_lines;
create trigger set_company_challan_lines_updated_at
before update on public.company_challan_lines
for each row execute function public.set_updated_at();

drop trigger if exists set_docs_updated_at on public.docs;
create trigger set_docs_updated_at
before update on public.docs
for each row execute function public.set_updated_at();

drop trigger if exists set_doc_lines_updated_at on public.doc_lines;
create trigger set_doc_lines_updated_at
before update on public.doc_lines
for each row execute function public.set_updated_at();

create or replace view public.v_outstanding_to_company
with (security_invoker = true)
as
select
  ccl.id as challan_line_id,
  i.material_code,
  i.description,
  cc.delivery_number,
  cc.supplier_name,
  ccl.qty_received as initial_qty,
  coalesce(
    sum(dl.qty) filter (
      where dest.kind = 'company'
        and src.kind <> 'company'
    ),
    0
  )::numeric(12, 3) as returned_qty,
  (
    ccl.qty_received - coalesce(
      sum(dl.qty) filter (
        where dest.kind = 'company'
          and src.kind <> 'company'
      ),
      0
    )
  )::numeric(12, 3) as outstanding_qty
from public.company_challan_lines ccl
join public.company_challans cc on cc.id = ccl.challan_id
join public.items i on i.id = ccl.item_id
left join public.doc_lines dl on dl.challan_line_id = ccl.id
left join public.docs d on d.id = dl.doc_id
left join public.locations src on src.id = d.source_location_id
left join public.locations dest on dest.id = d.dest_location_id
group by ccl.id, i.material_code, i.description, cc.delivery_number, cc.supplier_name, ccl.qty_received;

alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.company_challans enable row level security;
alter table public.company_challan_lines enable row level security;
alter table public.docs enable row level security;
alter table public.doc_lines enable row level security;

insert into public.locations (name, kind, is_active, gstin, address, contact)
values (
  'Arsh Traders',
  'warehouse',
  true,
  '23AECPC0996H2ZR',
  'Plot No. 119-2A, Saket Nagar, Bhopal - 462024 (M.P.)',
  'director@arshtraders.com'
)
on conflict (name) do update set
  kind = excluded.kind,
  is_active = excluded.is_active,
  gstin = excluded.gstin,
  address = excluded.address,
  contact = excluded.contact;
