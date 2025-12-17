import { createServerSupabaseAdmin } from './supabase/server'

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
}

/**
 * Calculate available quantity for a challan_line at a specific location
 * Available = total moved in - total moved out
 */
export async function getAvailableAtLocation(
  challanLineId: string,
  locationId: string
): Promise<number> {
  const supabase = await createServerSupabaseAdmin()

  // Run both queries in parallel
  const [{ data: inData }, { data: outData }] = await Promise.all([
    supabase
      .from('doc_lines')
      .select('qty, docs!inner(dest_location_id)')
      .eq('challan_line_id', challanLineId)
      .eq('docs.dest_location_id', locationId),
    supabase
      .from('doc_lines')
      .select('qty, docs!inner(source_location_id)')
      .eq('challan_line_id', challanLineId)
      .eq('docs.source_location_id', locationId),
  ])

  const totalIn = inData?.reduce((sum, row) => sum + Number(row.qty), 0) || 0
  const totalOut = outData?.reduce((sum, row) => sum + Number(row.qty), 0) || 0

  return totalIn - totalOut
}

/**
 * Batch calculate available quantities for multiple challan_lines at a location
 * Much more efficient than calling getAvailableAtLocation in a loop
 */
export async function getBatchAvailableAtLocation(
  challanLineIds: string[],
  locationId: string
): Promise<Map<string, number>> {
  if (challanLineIds.length === 0) {
    return new Map()
  }

  const supabase = await createServerSupabaseAdmin()

  // Run both queries in parallel for ALL items at once
  const [{ data: inData }, { data: outData }] = await Promise.all([
    supabase
      .from('doc_lines')
      .select('challan_line_id, qty, docs!inner(dest_location_id)')
      .in('challan_line_id', challanLineIds)
      .eq('docs.dest_location_id', locationId),
    supabase
      .from('doc_lines')
      .select('challan_line_id, qty, docs!inner(source_location_id)')
      .in('challan_line_id', challanLineIds)
      .eq('docs.source_location_id', locationId),
  ])

  // Aggregate totals by challan_line_id
  const inTotals = new Map<string, number>()
  const outTotals = new Map<string, number>()

  inData?.forEach((row) => {
    const current = inTotals.get(row.challan_line_id) || 0
    inTotals.set(row.challan_line_id, current + Number(row.qty))
  })

  outData?.forEach((row) => {
    const current = outTotals.get(row.challan_line_id) || 0
    outTotals.set(row.challan_line_id, current + Number(row.qty))
  })

  // Calculate available for each challan_line_id
  const result = new Map<string, number>()
  for (const id of challanLineIds) {
    const totalIn = inTotals.get(id) || 0
    const totalOut = outTotals.get(id) || 0
    result.set(id, totalIn - totalOut)
  }

  return result
}

/**
 * Get all available items at a location with qty > 0
 */
export async function getAvailableInventory(
  locationId: string
): Promise<AvailableItem[]> {
  const supabase = await createServerSupabaseAdmin()

  // Get all challan lines that have been moved into this location
  const { data: challanLines } = await supabase
    .from('doc_lines')
    .select(
      `
      challan_line_id,
      docs!inner(dest_location_id)
    `
    )
    .eq('docs.dest_location_id', locationId)

  if (!challanLines || challanLines.length === 0) {
    return []
  }

  // Get unique challan_line_ids
  const uniqueChallanLineIds = [
    ...new Set(challanLines.map((line) => line.challan_line_id)),
  ]

  // Batch fetch: availability AND line details in parallel
  const [availabilityMap, { data: lineDetails }] = await Promise.all([
    getBatchAvailableAtLocation(uniqueChallanLineIds, locationId),
    supabase
      .from('company_challan_lines')
      .select(
        `
        id,
        hsn_code,
        unit_cost,
        company_challans!inner(delivery_number, delivery_date, supplier_name),
        items!inner(material_code, description)
      `
      )
      .in('id', uniqueChallanLineIds),
  ])

  // Build result - no more loops with DB calls
  const availableItems: AvailableItem[] = []

  for (const lineData of lineDetails || []) {
    const available = availabilityMap.get(lineData.id) || 0

    if (available > 0) {
      availableItems.push({
        challan_line_id: lineData.id,
        delivery_number: (lineData.company_challans as any).delivery_number,
        delivery_date: (lineData.company_challans as any).delivery_date,
        material_code: (lineData.items as any).material_code,
        material_description: (lineData.items as any).description,
        hsn_code: lineData.hsn_code,
        available_qty: available,
        unit_cost: lineData.unit_cost,
        supplier_name: (lineData.company_challans as any).supplier_name,
      })
    }
  }

  // Sort by delivery_number, then material_code
  return availableItems.sort((a, b) => {
    if (a.delivery_number !== b.delivery_number) {
      return a.delivery_number.localeCompare(b.delivery_number)
    }
    return a.material_code.localeCompare(b.material_code)
  })
}
