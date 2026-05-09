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
