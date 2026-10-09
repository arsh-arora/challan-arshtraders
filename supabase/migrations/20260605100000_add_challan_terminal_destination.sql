alter table public.company_challans
  add column if not exists terminal_destination_name text;

update public.company_challans
set terminal_destination_name = supplier_name
where terminal_destination_name is null;

alter table public.company_challans
  alter column terminal_destination_name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_challans_terminal_destination_not_blank'
      and conrelid = 'public.company_challans'::regclass
  ) then
    alter table public.company_challans
      add constraint company_challans_terminal_destination_not_blank
      check (btrim(terminal_destination_name) <> '');
  end if;
end;
$$;

drop view if exists public.v_outstanding_to_company;

create view public.v_outstanding_to_company
with (security_invoker = true)
as
select
  ccl.id as challan_line_id,
  i.material_code,
  i.description,
  cc.delivery_number,
  cc.supplier_name,
  cc.terminal_destination_name,
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
group by ccl.id, i.material_code, i.description, cc.delivery_number, cc.supplier_name, cc.terminal_destination_name, ccl.qty_received;

notify pgrst, 'reload schema';
