'use server'

import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { ColumnMapping } from '@/types/database'

interface ImportRow {
  [key: string]: string | number | null | undefined
}

export async function importChallan(
  supplierName: string,
  rows: ImportRow[],
  mapping: ColumnMapping
) {
  const supabase = await createServerSupabaseAdmin()

  try {
    // 1. Ensure locations exist
    const warehouseLocation = await ensureLocation(supabase, 'Arsh Traders', 'warehouse')
    const companyLocation = await ensureLocation(supabase, `Company:${supplierName}`, 'company')

    if (!warehouseLocation || !companyLocation) {
      throw new Error('Failed to create locations')
    }

    // 2. Parse and validate all rows, extracting delivery number per row
    const validRows = rows
      .map((row) => ({
        deliveryNumber: String(row[mapping.deliveryNumber] || '').trim(),
        deliveryDate: excelDateToISO(row[mapping.deliveryDate]),
        materialCode: String(row[mapping.materialCode] || '').trim(),
        materialDescription: String(row[mapping.materialDescription] || '').trim(),
        hsnCode: String(row[mapping.hsnCode] || '').trim(),
        qty: Number(row[mapping.qty]) || 0,
        unitCost: Number(row[mapping.unitCost]) || 0,
        itemNumber: String(row[mapping.itemNumber] || '').trim(),
      }))
      .filter((r) => r.materialCode && r.qty > 0 && r.deliveryNumber)

    if (validRows.length === 0) {
      throw new Error('No valid rows to import (need material code, qty > 0, and delivery number)')
    }

    // 3. Group rows by delivery number
    const rowsByDelivery = new Map<string, typeof validRows>()
    for (const row of validRows) {
      if (!rowsByDelivery.has(row.deliveryNumber)) {
        rowsByDelivery.set(row.deliveryNumber, [])
      }
      rowsByDelivery.get(row.deliveryNumber)!.push(row)
    }

    // 4. Batch upsert all unique items at once
    const uniqueMaterials = [
      ...new Map(
        validRows.map((r) => [
          r.materialCode,
          { material_code: r.materialCode, description: r.materialDescription },
        ])
      ).values(),
    ]

    const { error: itemsError } = await supabase
      .from('items')
      .upsert(uniqueMaterials, { onConflict: 'material_code' })

    if (itemsError) {
      throw new Error(`Failed to upsert items: ${itemsError.message}`)
    }

    // Fetch all item IDs in one query
    const { data: items } = await supabase
      .from('items')
      .select('id, material_code')
      .in('material_code', uniqueMaterials.map((m) => m.material_code))

    const itemMap = new Map(items?.map((i) => [i.material_code, i.id]) || [])

    // 5. Process each delivery number group
    let totalLinesImported = 0
    const deliveryNumbers = Array.from(rowsByDelivery.keys())

    // Check for existing challans in batch
    const { data: existingChallans } = await supabase
      .from('company_challans')
      .select('id, delivery_number')
      .eq('supplier_name', supplierName)
      .in('delivery_number', deliveryNumbers)

    const existingChallanMap = new Map(
      existingChallans?.map((c) => [c.delivery_number, c.id]) || []
    )

    // Create missing challans in batch
    const newChallansToCreate = deliveryNumbers
      .filter((dn) => !existingChallanMap.has(dn))
      .map((dn) => {
        const firstRow = rowsByDelivery.get(dn)![0]
        return {
          supplier_name: supplierName,
          delivery_number: dn,
          delivery_date: firstRow.deliveryDate,
        }
      })

    if (newChallansToCreate.length > 0) {
      const { data: newChallans, error: challanError } = await supabase
        .from('company_challans')
        .insert(newChallansToCreate)
        .select('id, delivery_number')

      if (challanError) {
        throw new Error(`Failed to create challans: ${challanError.message}`)
      }

      // Add new challans to map
      newChallans?.forEach((c) => existingChallanMap.set(c.delivery_number, c.id))
    }

    // 6. Batch insert all challan lines at once
    const allChallanLines = validRows.map((r) => ({
      challan_id: existingChallanMap.get(r.deliveryNumber),
      item_id: itemMap.get(r.materialCode),
      item_number: r.itemNumber,
      hsn_code: r.hsnCode,
      unit_cost: r.unitCost,
      qty_received: r.qty,
    }))

    const { data: challanLines, error: linesError } = await supabase
      .from('company_challan_lines')
      .insert(allChallanLines)
      .select('id')

    if (linesError || !challanLines) {
      throw new Error(`Failed to create challan lines: ${linesError?.message}`)
    }

    totalLinesImported = challanLines.length

    // 7. Create inbound doc (company → warehouse)
    const docNo = `IN-${supplierName.substring(0, 10)}-${Date.now()}`
    const { data: doc, error: docError } = await supabase
      .from('docs')
      .insert({
        doc_no: docNo,
        doc_type: 'in',
        doc_date: new Date().toISOString().split('T')[0],
        source_location_id: companyLocation.id,
        dest_location_id: warehouseLocation.id,
        counterparty_name: supplierName,
        notes: `Imported ${deliveryNumbers.length} delivery numbers: ${deliveryNumbers.join(', ')}`,
      })
      .select('id')
      .single()

    if (docError || !doc) {
      throw new Error(`Failed to create doc: ${docError?.message}`)
    }

    // 8. Batch insert all doc lines at once
    const docLinesToInsert = validRows.map((r, i) => ({
      doc_id: doc.id,
      challan_line_id: challanLines[i].id,
      qty: r.qty,
      material_code: r.materialCode,
      material_description: r.materialDescription,
      company_delivery_no: r.deliveryNumber,
      company_delivery_date: r.deliveryDate,
    }))

    const { error: docLinesError } = await supabase
      .from('doc_lines')
      .insert(docLinesToInsert)

    if (docLinesError) {
      console.error('Failed to create doc lines:', docLinesError)
    }

    return {
      success: true,
      message: `Successfully imported ${totalLinesImported} lines across ${deliveryNumbers.length} delivery numbers`,
      docId: doc.id,
    }
  } catch (error) {
    console.error('Import error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Import failed',
    }
  }
}

async function ensureLocation(supabase: any, name: string, kind: string) {
  const { data: existing } = await supabase
    .from('locations')
    .select('id')
    .eq('name', name)
    .single()

  if (existing) return existing

  const { data: created, error } = await supabase
    .from('locations')
    .insert({ name, kind })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create location:', error)
    return null
  }

  return created
}

function excelDateToISO(value: any): string | null {
  if (!value) return null

  // If it's already a string date, return it
  if (typeof value === 'string') return value

  // Excel dates are numbers representing days since 1900-01-01
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString().split('T')[0]
  }

  return null
}
