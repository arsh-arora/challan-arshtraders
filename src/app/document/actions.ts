'use server'

import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import {
  getBatchAvailableAtLocation,
  getAvailableInventory,
} from '@/lib/availability'
import { revalidatePath } from 'next/cache'

export interface DocumentHeader {
  doc_no: string
  doc_date: string
  source_location_id: string
  dest_location_id: string
  counterparty_name?: string
  notes?: string
}

export interface DocumentLine {
  challan_line_id: string
  qty: number
  ticket_code?: string
}

/**
 * Determine document type based on destination location kind
 * - warehouse: inbound (items coming back to warehouse)
 * - company: return (items returned to supplier/company)
 * - partner/hospital: outbound (items going out)
 */
function determineDocType(destKind: string): 'in' | 'out' | 'return' {
  const kind = destKind?.toLowerCase().trim() || ''
  console.log('[determineDocType] destKind:', destKind, '-> normalized:', kind)

  if (kind === 'warehouse') {
    return 'in'
  } else if (kind === 'company') {
    return 'return'
  } else {
    // partner or hospital
    return 'out'
  }
}

/**
 * Generate a unique ticket code for items leaving warehouse
 * Format: TKT-YYYYMMDD-XXXX (e.g., TKT-20241216-0001)
 */
async function generateTicketCode(supabase: any): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `TKT-${dateStr}-`

  // Get the highest ticket number for today
  const { data: lastTicket } = await supabase
    .from('doc_lines')
    .select('ticket_code')
    .like('ticket_code', `${prefix}%`)
    .order('ticket_code', { ascending: false })
    .limit(1)
    .single()

  let nextNum = 1
  if (lastTicket?.ticket_code) {
    const lastNum = parseInt(lastTicket.ticket_code.split('-').pop() || '0', 10)
    nextNum = lastNum + 1
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

/**
 * Find existing ticket codes for challan lines at a given location
 * This allows us to carry forward tickets when items move between locations
 */
async function findExistingTickets(
  supabase: any,
  challanLineIds: string[],
  sourceLocationId: string
): Promise<Map<string, string>> {
  // Find the most recent ticket_code for each challan_line at the source location
  // A ticket exists if items were moved TO this location with that ticket
  const { data: existingTickets } = await supabase
    .from('doc_lines')
    .select(
      `
      challan_line_id,
      ticket_code,
      docs!inner(dest_location_id, doc_date)
    `
    )
    .in('challan_line_id', challanLineIds)
    .eq('docs.dest_location_id', sourceLocationId)
    .not('ticket_code', 'is', null)
    .order('docs(doc_date)', { ascending: false })

  const ticketMap = new Map<string, string>()

  // Get the most recent ticket for each challan_line
  for (const ticket of existingTickets || []) {
    if (!ticketMap.has(ticket.challan_line_id) && ticket.ticket_code) {
      ticketMap.set(ticket.challan_line_id, ticket.ticket_code)
    }
  }

  return ticketMap
}

export async function createDocument(
  header: DocumentHeader,
  lines: DocumentLine[]
) {
  const supabase = await createServerSupabaseAdmin()

  try {
    // Validate that source and dest are different
    if (header.source_location_id === header.dest_location_id) {
      return {
        success: false,
        message: 'Source and destination locations must be different',
      }
    }

    // Validate lines are not empty
    if (lines.length === 0) {
      return {
        success: false,
        message: 'At least one line item is required',
      }
    }

    // Get all challan_line_ids
    const challanLineIds = lines.map((line) => line.challan_line_id)

    // Batch fetch: availability, challan line details, AND location info in parallel
    const [
      availabilityMap,
      { data: challanLineDetails },
      { data: sourceLocation },
      { data: destLocation },
    ] = await Promise.all([
      getBatchAvailableAtLocation(challanLineIds, header.source_location_id),
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
        .in('id', challanLineIds),
      supabase
        .from('locations')
        .select('id, name, kind')
        .eq('id', header.source_location_id)
        .single(),
      supabase
        .from('locations')
        .select('id, name, kind')
        .eq('id', header.dest_location_id)
        .single(),
    ])

    // Create lookup map for challan line details
    const challanLineMap = new Map(
      challanLineDetails?.map((cl) => [cl.id, cl]) || []
    )

    // Validate availability for all lines
    for (const line of lines) {
      const available = availabilityMap.get(line.challan_line_id) || 0

      if (line.qty > available) {
        const challanLine = challanLineMap.get(line.challan_line_id)
        const materialCode = challanLine
          ? (challanLine.items as any).material_code
          : line.challan_line_id

        return {
          success: false,
          message: `Insufficient quantity for ${materialCode}. Available: ${available}, Requested: ${line.qty}`,
        }
      }
    }

    // Log location details for debugging
    console.log('[createDocument] Source location:', sourceLocation)
    console.log('[createDocument] Dest location:', destLocation)

    // Auto-determine document type based on destination
    const docType = determineDocType(destLocation?.kind || '')
    console.log('[createDocument] Determined docType:', docType)

    // For returns to company: validate that all items originated from this company
    if (docType === 'return' && destLocation) {
      const mismatchedItems: string[] = []
      // Location names have "Company:" prefix, but supplier_name in DB doesn't
      // e.g., location "Company:Karl Storz" → supplier_name "Karl Storz"
      const expectedSupplier = destLocation.name.replace(/^Company:/i, '')

      for (const line of lines) {
        const challanLine = challanLineMap.get(line.challan_line_id)
        if (challanLine) {
          const supplierName = (challanLine.company_challans as any).supplier_name
          // Check if supplier name matches destination company
          if (supplierName !== expectedSupplier) {
            const materialCode = (challanLine.items as any).material_code
            mismatchedItems.push(`${materialCode} (from ${supplierName})`)
          }
        }
      }

      if (mismatchedItems.length > 0) {
        return {
          success: false,
          message: `Cannot return items to ${expectedSupplier}. The following items belong to different suppliers: ${mismatchedItems.join(', ')}`,
        }
      }
    }

    // Determine ticket handling:
    // - If from warehouse to partner/hospital: generate new tickets
    // - If from partner/hospital to elsewhere: carry forward existing tickets
    // - If going to warehouse or company: tickets get "closed" (still tracked in doc_lines)
    const isFromWarehouse = sourceLocation?.kind === 'warehouse'
    const isToPartnerOrHospital =
      destLocation?.kind === 'partner' || destLocation?.kind === 'hospital'
    const shouldAutoGenerateTickets = isFromWarehouse && isToPartnerOrHospital

    // Find existing tickets for items being moved (for carrying forward)
    const existingTicketMap = await findExistingTickets(
      supabase,
      challanLineIds,
      header.source_location_id
    )

    // Create document header with auto-detected doc_type
    const { data: doc, error: docError } = await supabase
      .from('docs')
      .insert({
        doc_no: header.doc_no,
        doc_type: docType,
        doc_date: header.doc_date,
        source_location_id: header.source_location_id,
        dest_location_id: header.dest_location_id,
        counterparty_name: header.counterparty_name,
        notes: header.notes,
      })
      .select('id')
      .single()

    if (docError || !doc) {
      return {
        success: false,
        message: `Failed to create document: ${docError?.message}`,
      }
    }

    // Build all doc_lines for batch insert
    const docLinesToInsert = []
    for (const line of lines) {
      const challanLine = challanLineMap.get(line.challan_line_id)
      if (!challanLine) continue

      // Determine ticket code:
      // 1. Use user-provided ticket code if any
      // 2. Carry forward existing ticket if items are being moved from a location with a ticket
      // 3. Auto-generate new ticket only when items first leave warehouse to partner/hospital
      let ticketCode = line.ticket_code

      if (!ticketCode) {
        // Check if there's an existing ticket for this item at the source location
        const existingTicket = existingTicketMap.get(line.challan_line_id)
        if (existingTicket) {
          // Carry forward the existing ticket
          ticketCode = existingTicket
        } else if (shouldAutoGenerateTickets) {
          // Generate new ticket only when leaving warehouse for partner/hospital
          ticketCode = await generateTicketCode(supabase)
        }
      }

      docLinesToInsert.push({
        doc_id: doc.id,
        challan_line_id: line.challan_line_id,
        ticket_code: ticketCode,
        qty: line.qty,
        material_code: (challanLine.items as any).material_code,
        material_description: (challanLine.items as any).description,
        company_delivery_no: (challanLine.company_challans as any)
          .delivery_number,
        company_delivery_date: (challanLine.company_challans as any)
          .delivery_date,
      })
    }

    // Batch insert all doc_lines in one query
    if (docLinesToInsert.length > 0) {
      const { error: linesError } = await supabase
        .from('doc_lines')
        .insert(docLinesToInsert)

      if (linesError) {
        console.error('Failed to insert doc_lines:', linesError)
      }
    }

    revalidatePath('/document')
    revalidatePath('/inventory')
    revalidatePath('/tickets')

    return {
      success: true,
      message: 'Document created successfully',
      docId: doc.id,
    }
  } catch (error) {
    console.error('Create document error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create document',
    }
  }
}

export async function getLocations() {
  const supabase = await createServerSupabaseAdmin()

  // Try to fetch with new columns first, fallback to basic columns if they don't exist
  let { data, error } = await supabase
    .from('locations')
    .select('id, name, kind, gstin, address, contact')
    .eq('is_active', true)
    .order('name')

  // If error (possibly due to missing columns), try without new columns
  if (error) {
    console.error('Failed to fetch locations with full columns, trying basic:', error.message)
    const basicResult = await supabase
      .from('locations')
      .select('id, name, kind')
      .eq('is_active', true)
      .order('name')

    if (basicResult.error) {
      console.error('Failed to fetch locations:', basicResult.error)
      return []
    }

    // Add null values for missing columns
    return (basicResult.data || []).map(loc => ({
      ...loc,
      gstin: null,
      address: null,
      contact: null,
    }))
  }

  return data || []
}

export async function getAvailableItems(locationId: string) {
  return getAvailableInventory(locationId)
}

export interface LocationInput {
  name: string
  kind: 'warehouse' | 'company' | 'partner' | 'hospital'
  gstin?: string
  address?: string
  contact?: string
}

export async function createLocation(input: LocationInput) {
  const supabase = await createServerSupabaseAdmin()
  const { name, kind, gstin, address, contact } = input

  // Check if location already exists
  const { data: existing } = await supabase
    .from('locations')
    .select('id, kind')
    .eq('name', name)
    .single()

  if (existing) {
    // Update location with new details
    const updateData: Record<string, string> = {}
    if (existing.kind !== kind) updateData.kind = kind
    if (gstin) updateData.gstin = gstin
    if (address) updateData.address = address
    if (contact) updateData.contact = contact

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', existing.id)

      if (updateError) {
        console.error('Failed to update location:', updateError)
      } else {
        console.log(`[createLocation] Updated location "${name}"`)
      }
    }

    return {
      success: true,
      locationId: existing.id,
      message: 'Location updated',
    }
  }

  // Create new location
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name,
      kind,
      is_active: true,
      gstin: gstin || null,
      address: address || null,
      contact: contact || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      success: false,
      message: `Failed to create location: ${error?.message}`,
    }
  }

  return {
    success: true,
    locationId: data.id,
    message: 'Location created successfully',
  }
}

export async function updateLocation(
  id: string,
  updates: { gstin?: string; address?: string; contact?: string }
) {
  const supabase = await createServerSupabaseAdmin()

  const { error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/document')
  return { success: true, message: 'Location updated' }
}
