'use server'

import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { getBatchAvailableAtLocation } from '@/lib/availability'

export interface InventoryItem {
  challan_line_id: string
  delivery_number: string
  delivery_date: string | null
  supplier_name: string
  material_code: string
  material_description: string | null
  hsn_code: string | null
  qty_received: number
  // Breakdown of where qty currently is
  qty_at_warehouse: number // currently at Arsh Traders
  qty_out: number // currently with partner/hospital (sent out but not returned)
  qty_returned: number // returned to company
  outstanding: number // qty not yet returned to company = qty_received - qty_returned
}

export async function getInventory(searchTerm?: string) {
  const supabase = await createServerSupabaseAdmin()

  // Get warehouse location
  const { data: warehouse } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'Arsh Traders')
    .single()

  if (!warehouse) {
    return []
  }

  // Get all challan lines with items and challans
  const { data: challanLines, error } = await supabase
    .from('company_challan_lines')
    .select(
      `
      id,
      hsn_code,
      qty_received,
      company_challans!inner(delivery_number, delivery_date, supplier_name),
      items!inner(material_code, description)
    `
    )
    .order('company_challans(delivery_number)')

  if (error || !challanLines) {
    console.error('Failed to fetch inventory:', error)
    return []
  }

  // Filter by search term in memory first (no DB calls needed)
  const filteredLines = searchTerm
    ? challanLines.filter((line) => {
        const materialCode = (line.items as any).material_code
        const materialDescription = (line.items as any).description
        const deliveryNumber = (line.company_challans as any).delivery_number
        const search = searchTerm.toLowerCase()

        return (
          deliveryNumber.toLowerCase().includes(search) ||
          materialCode.toLowerCase().includes(search) ||
          materialDescription?.toLowerCase().includes(search)
        )
      })
    : challanLines

  if (filteredLines.length === 0) {
    return []
  }

  // Get all challan_line_ids for batch queries
  const challanLineIds = filteredLines.map((line) => line.id)

  // First get warehouse availability
  const availabilityMap = await getBatchAvailableAtLocation(challanLineIds, warehouse.id)

  // Get all doc_lines with location info to filter returns properly
  const { data: allDocLines } = await supabase
    .from('doc_lines')
    .select(
      `
      challan_line_id,
      qty,
      docs!inner(
        source_location_id,
        dest_location_id,
        source:locations!docs_source_location_id_fkey(kind),
        destination:locations!docs_dest_location_id_fkey(kind)
      )
    `
    )
    .in('challan_line_id', challanLineIds)

  // Filter for returns: items going TO company (excluding initial import)
  // Items are "returned" when they reach a company location (back to supplier)
  // But we must exclude the initial import which goes FROM company TO warehouse
  // This is done in JS because Supabase nested .in() filters don't work reliably
  const returnData = allDocLines?.filter((row) => {
    const sourceKind = (row.docs as any)?.source?.kind
    const destKind = (row.docs as any)?.destination?.kind
    // Return = destination is company, but NOT the initial receipt (which is company → warehouse)
    // Initial receipt: source=company, dest=warehouse
    // Actual return: source=anything except company initial, dest=company
    return destKind === 'company' && sourceKind !== 'company'
  })

  // Debug: Log all doc movements to trace return calculation
  console.log('[getInventory] Total doc_lines:', allDocLines?.length)
  console.log('[getInventory] Return doc_lines:', returnData?.length)
  if (returnData && returnData.length > 0) {
    console.log('[getInventory] Sample return:', {
      sourceKind: (returnData[0].docs as any)?.source?.kind,
      destKind: (returnData[0].docs as any)?.destination?.kind,
      qty: returnData[0].qty
    })
  }

  // Aggregate return quantities by challan_line_id
  const returnTotals = new Map<string, number>()
  returnData?.forEach((row) => {
    const current = returnTotals.get(row.challan_line_id) || 0
    returnTotals.set(row.challan_line_id, current + Number(row.qty))
  })

  // Build inventory - pure in-memory computation, no DB calls
  const inventory: InventoryItem[] = filteredLines.map((line) => {
    const materialCode = (line.items as any).material_code
    const materialDescription = (line.items as any).description
    const deliveryNumber = (line.company_challans as any).delivery_number
    const supplierName = (line.company_challans as any).supplier_name

    const qty_at_warehouse = availabilityMap.get(line.id) || 0
    const qty_returned = returnTotals.get(line.id) || 0

    // qty_out = what's not at warehouse AND not returned to company
    // This is items currently with partner/hospital
    const qty_out = Math.max(0, line.qty_received - qty_at_warehouse - qty_returned)

    // Outstanding = warehouse + out = everything not yet returned to company
    const outstanding = qty_at_warehouse + qty_out

    return {
      challan_line_id: line.id,
      delivery_number: deliveryNumber,
      delivery_date: (line.company_challans as any).delivery_date,
      supplier_name: supplierName,
      material_code: materialCode,
      material_description: materialDescription,
      hsn_code: line.hsn_code,
      qty_received: line.qty_received,
      qty_at_warehouse,
      qty_out,
      qty_returned,
      outstanding,
    }
  })

  return inventory
}
