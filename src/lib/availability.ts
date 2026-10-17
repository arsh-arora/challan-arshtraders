import { z } from 'zod'
import { createServerSupabaseAdmin } from './supabase/server'
import { readAllRows, readRowsByIds } from './supabase/read'

export interface AvailableItem {
  challan_line_id: string
  delivery_number: string
  delivery_date: string | null
  material_code: string
  material_description: string | null
  hsn_code: string | null
  available_qty: number
  unit_cost: number | null
  supplier_name: string
  terminal_destination_name: string
}

const receiptSchema = z.object({ challan_line_id: z.string() })
const movementSchema = receiptSchema.extend({ qty: z.coerce.number().positive() })
const lineDetailSchema = z.object({
  id: z.string(),
  hsn_code: z.string().nullable(),
  unit_cost: z.coerce.number().nonnegative().nullable(),
  company_challans: z.object({
    delivery_number: z.string(),
    delivery_date: z.string().nullable(),
    supplier_name: z.string(),
    terminal_destination_name: z.string(),
  }),
  items: z.object({ material_code: z.string(), description: z.string().nullable() }),
})

/** Available quantity is the complete movement history: receipts minus issues. */
export async function getAvailableAtLocation(
  challanLineId: string,
  locationId: string
): Promise<number> {
  const quantities = await getBatchAvailableAtLocation([challanLineId], locationId)
  return quantities.get(challanLineId) ?? 0
}

export async function getBatchAvailableAtLocation(
  challanLineIds: string[],
  locationId: string
): Promise<Map<string, number>> {
  if (challanLineIds.length === 0) return new Map()
  const supabase = await createServerSupabaseAdmin()

  const [incoming, outgoing] = await Promise.all([
    readRowsByIds('stock receipts', movementSchema, challanLineIds, (ids, from, to) =>
      supabase.from('doc_lines')
        .select('challan_line_id, qty, docs!inner(dest_location_id)', { count: 'exact' })
        .in('challan_line_id', ids)
        .eq('docs.dest_location_id', locationId)
        .order('id').range(from, to)
    ),
    readRowsByIds('stock issues', movementSchema, challanLineIds, (ids, from, to) =>
      supabase.from('doc_lines')
        .select('challan_line_id, qty, docs!inner(source_location_id)', { count: 'exact' })
        .in('challan_line_id', ids)
        .eq('docs.source_location_id', locationId)
        .order('id').range(from, to)
    ),
  ])

  const quantities = new Map([...new Set(challanLineIds)].map((id) => [id, 0]))
  for (const row of incoming) {
    quantities.set(row.challan_line_id, (quantities.get(row.challan_line_id) ?? 0) + row.qty)
  }
  for (const row of outgoing) {
    quantities.set(row.challan_line_id, (quantities.get(row.challan_line_id) ?? 0) - row.qty)
  }
  return quantities
}

export async function getAvailableInventory(locationId: string): Promise<AvailableItem[]> {
  const supabase = await createServerSupabaseAdmin()
  const receipts = await readAllRows('stock receipts', receiptSchema, (from, to) =>
    supabase.from('doc_lines')
      .select('challan_line_id, docs!inner(dest_location_id)', { count: 'exact' })
      .eq('docs.dest_location_id', locationId)
      .order('id').range(from, to)
  )
  const ids = [...new Set(receipts.map((row) => row.challan_line_id))]
  if (ids.length === 0) return []

  const [quantities, details] = await Promise.all([
    getBatchAvailableAtLocation(ids, locationId),
    readRowsByIds('item details', lineDetailSchema, ids, (batch, from, to) =>
      supabase.from('company_challan_lines')
        .select(`id, hsn_code, unit_cost,
          company_challans!inner(delivery_number, delivery_date, supplier_name, terminal_destination_name),
          items!inner(material_code, description)`, { count: 'exact' })
        .in('id', batch)
        .order('id').range(from, to)
    ),
  ])

  if (details.length !== ids.length) {
    throw new Error('Unable to load all item details. Please try again.')
  }

  return details.flatMap((line): AvailableItem[] => {
    const available = quantities.get(line.id) ?? 0
    if (available <= 0) return []
    return [{
      challan_line_id: line.id,
      delivery_number: line.company_challans.delivery_number,
      delivery_date: line.company_challans.delivery_date,
      material_code: line.items.material_code,
      material_description: line.items.description,
      hsn_code: line.hsn_code,
      available_qty: available,
      unit_cost: line.unit_cost,
      supplier_name: line.company_challans.supplier_name,
      terminal_destination_name: line.company_challans.terminal_destination_name,
    }]
  }).sort((a, b) =>
    a.delivery_number.localeCompare(b.delivery_number) || a.material_code.localeCompare(b.material_code)
  )
}
