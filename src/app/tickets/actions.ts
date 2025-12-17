'use server'

import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export interface TicketInfo {
  ticket_code: string
  material_code: string
  material_description: string | null
  delivery_number: string
  current_location: string | null
  current_location_kind: string | null
  qty_at_location: number
  total_qty: number
  status: 'active' | 'returned' // active = out with partner/hospital, returned = back to company
  created_date: string | null
}

export interface TicketMovement {
  id: string
  doc_no: string
  doc_date: string
  doc_type: 'in' | 'out' | 'return'
  from_location: string
  from_location_kind: string
  to_location: string
  to_location_kind: string
  qty: number
}

export interface TicketDetails {
  ticket_code: string
  material_code: string
  material_description: string | null
  delivery_number: string
  current_location: string | null
  current_location_kind: string | null
  qty_at_location: number
  status: 'active' | 'returned'
  movements: TicketMovement[]
}

export async function getTickets(
  searchTerm?: string,
  showActiveOnly: boolean = false
) {
  const supabase = await createServerSupabaseAdmin()

  // Get all doc_lines with ticket_code
  const { data: docLines, error } = await supabase
    .from('doc_lines')
    .select(
      `
      ticket_code,
      material_code,
      material_description,
      company_delivery_no,
      qty,
      docs!inner(
        id,
        doc_date,
        source_location_id,
        dest_location_id,
        source:locations!docs_source_location_id_fkey(name, kind),
        destination:locations!docs_dest_location_id_fkey(name, kind)
      )
    `
    )
    .not('ticket_code', 'is', null)
    .order('ticket_code')

  if (error || !docLines) {
    console.error('Failed to fetch tickets:', error)
    return []
  }

  // Group by ticket_code
  const ticketMap = new Map<string, any[]>()

  for (const line of docLines) {
    if (!line.ticket_code) continue

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesTicket = line.ticket_code.toLowerCase().includes(search)
      const matchesMaterial = line.material_code?.toLowerCase().includes(search)
      const matchesDelivery = line.company_delivery_no
        ?.toLowerCase()
        .includes(search)

      if (!matchesTicket && !matchesMaterial && !matchesDelivery) {
        continue
      }
    }

    if (!ticketMap.has(line.ticket_code)) {
      ticketMap.set(line.ticket_code, [])
    }
    ticketMap.get(line.ticket_code)!.push(line)
  }

  // Process each ticket
  const tickets: TicketInfo[] = []

  for (const [ticketCode, lines] of ticketMap.entries()) {
    // Calculate qty at each location
    const locationQty = new Map<
      string,
      { name: string; kind: string; qty: number }
    >()

    let earliestDate: string | null = null

    for (const line of lines) {
      const sourceId = (line.docs as any).source_location_id
      const destId = (line.docs as any).dest_location_id
      const sourceName = (line.docs as any).source.name
      const destName = (line.docs as any).destination.name
      const sourceKind = (line.docs as any).source.kind
      const destKind = (line.docs as any).destination.kind
      const docDate = (line.docs as any).doc_date
      const qty = Number(line.qty)

      // Track earliest date (when ticket was created)
      if (!earliestDate || docDate < earliestDate) {
        earliestDate = docDate
      }

      // Subtract from source
      if (!locationQty.has(sourceId)) {
        locationQty.set(sourceId, { name: sourceName, kind: sourceKind, qty: 0 })
      }
      locationQty.get(sourceId)!.qty -= qty

      // Add to destination
      if (!locationQty.has(destId)) {
        locationQty.set(destId, { name: destName, kind: destKind, qty: 0 })
      }
      locationQty.get(destId)!.qty += qty
    }

    // Find current location (where qty > 0)
    let currentLocation: string | null = null
    let currentLocationKind: string | null = null
    let qtyAtLocation = 0

    for (const [, loc] of locationQty.entries()) {
      if (loc.qty > 0) {
        currentLocation = loc.name
        currentLocationKind = loc.kind
        qtyAtLocation = loc.qty
        break
      }
    }

    // Determine status: closed if current location is company or warehouse, otherwise active
    // Tickets are "active" only when items are with partner/hospital
    const status: 'active' | 'returned' =
      currentLocationKind === 'company' || currentLocationKind === 'warehouse'
        ? 'returned'
        : 'active'

    // Skip if filtering for active only and this ticket is returned
    if (showActiveOnly && status === 'returned') {
      continue
    }

    // Use first line for material info
    const firstLine = lines[0]

    tickets.push({
      ticket_code: ticketCode,
      material_code: firstLine.material_code || '',
      material_description: firstLine.material_description,
      delivery_number: firstLine.company_delivery_no || '',
      current_location: currentLocation,
      current_location_kind: currentLocationKind,
      qty_at_location: qtyAtLocation,
      total_qty: lines[0].qty, // Original qty when ticket was created
      status,
      created_date: earliestDate,
    })
  }

  // Sort by status (active first), then by ticket code descending (newest first)
  return tickets.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1
    }
    return b.ticket_code.localeCompare(a.ticket_code)
  })
}

/**
 * Get detailed information about a specific ticket including movement history
 */
export async function getTicketDetails(
  ticketCode: string
): Promise<TicketDetails | null> {
  const supabase = await createServerSupabaseAdmin()

  // Get all doc_lines with this ticket_code
  const { data: docLines, error } = await supabase
    .from('doc_lines')
    .select(
      `
      id,
      ticket_code,
      material_code,
      material_description,
      company_delivery_no,
      qty,
      docs!inner(
        id,
        doc_no,
        doc_date,
        doc_type,
        source_location_id,
        dest_location_id,
        source:locations!docs_source_location_id_fkey(name, kind),
        destination:locations!docs_dest_location_id_fkey(name, kind)
      )
    `
    )
    .eq('ticket_code', ticketCode)
    .order('docs(doc_date)', { ascending: true })

  if (error || !docLines || docLines.length === 0) {
    console.error('Failed to fetch ticket details:', error)
    return null
  }

  // Calculate current location
  const locationQty = new Map<
    string,
    { name: string; kind: string; qty: number }
  >()

  const movements: TicketMovement[] = []

  for (const line of docLines) {
    const doc = line.docs as any
    const sourceId = doc.source_location_id
    const destId = doc.dest_location_id
    const sourceName = doc.source.name
    const destName = doc.destination.name
    const sourceKind = doc.source.kind
    const destKind = doc.destination.kind
    const qty = Number(line.qty)

    // Track location quantities
    if (!locationQty.has(sourceId)) {
      locationQty.set(sourceId, { name: sourceName, kind: sourceKind, qty: 0 })
    }
    locationQty.get(sourceId)!.qty -= qty

    if (!locationQty.has(destId)) {
      locationQty.set(destId, { name: destName, kind: destKind, qty: 0 })
    }
    locationQty.get(destId)!.qty += qty

    // Add to movements
    movements.push({
      id: line.id,
      doc_no: doc.doc_no,
      doc_date: doc.doc_date,
      doc_type: doc.doc_type,
      from_location: sourceName,
      from_location_kind: sourceKind,
      to_location: destName,
      to_location_kind: destKind,
      qty,
    })
  }

  // Find current location
  let currentLocation: string | null = null
  let currentLocationKind: string | null = null
  let qtyAtLocation = 0

  for (const [, loc] of locationQty.entries()) {
    if (loc.qty > 0) {
      currentLocation = loc.name
      currentLocationKind = loc.kind
      qtyAtLocation = loc.qty
      break
    }
  }

  // Tickets are "closed" (returned) when items are at company OR warehouse
  const status: 'active' | 'returned' =
    currentLocationKind === 'company' || currentLocationKind === 'warehouse'
      ? 'returned'
      : 'active'

  const firstLine = docLines[0]

  return {
    ticket_code: ticketCode,
    material_code: firstLine.material_code || '',
    material_description: firstLine.material_description,
    delivery_number: firstLine.company_delivery_no || '',
    current_location: currentLocation,
    current_location_kind: currentLocationKind,
    qty_at_location: qtyAtLocation,
    status,
    movements,
  }
}
