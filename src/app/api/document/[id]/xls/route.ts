'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Fixed Arsh Traders details - non-negotiable
const ARSH_TRADERS_ADDRESS = 'Plot No. 119-2A, Saket Nagar, Bhopal - 462024 (M.P.)'
const ARSH_TRADERS_GSTIN = '23AECPC0996H2ZR'
const ARSH_TRADERS_EMAIL = 'director@arshtraders.com'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createServerSupabaseAdmin()

  try {
    // Fetch document with full location details including GSTIN, address, contact
    const { data: doc, error: docError } = await supabase
      .from('docs')
      .select(
        `
        *,
        source:locations!docs_source_location_id_fkey(id, name, kind, gstin, address, contact),
        destination:locations!docs_dest_location_id_fkey(id, name, kind, gstin, address, contact)
      `
      )
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Fetch lines with challan line data for HSN and rate
    const { data: lines } = await supabase
      .from('doc_lines')
      .select(`
        *,
        challan_line:company_challan_lines(hsn_code, unit_cost)
      `)
      .eq('doc_id', id)
      .order('material_code')

    // Format date for display
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '.')
    }

    // Get unique KSI challan numbers from lines
    const ksiChallanNos = [...new Set(lines?.map(l => l.company_delivery_no).filter(Boolean))].join(', ')
    const ksiChallanDates = [...new Set(lines?.map(l => l.company_delivery_date).filter(Boolean))].map(d => formatDate(d)).join(', ')

    // Build the worksheet data
    const wsData: (string | number | null)[][] = []

    // Row 1-3: Title
    wsData.push(['', '', '', '', 'Delivery Challan', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', '', '', '', 'GOODS MOVEMENT', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', '', '', '', '(GOODS SENT ON RETURNABLE BASIS)', '', '', '', '', '', '', '', '', '', '', ''])

    // Determine source details - use fixed values for Arsh Traders
    const isSourceArshTraders = doc.source?.name === 'Arsh Traders'
    const sourceAddress = isSourceArshTraders ? ARSH_TRADERS_ADDRESS : (doc.source?.address || '')
    const sourceGstin = isSourceArshTraders ? ARSH_TRADERS_GSTIN : (doc.source?.gstin || '')
    const sourceContact = isSourceArshTraders ? ARSH_TRADERS_EMAIL : (doc.source?.contact || '')

    // Destination details from database
    const destAddress = doc.destination?.address || ''
    const destGstin = doc.destination?.gstin || ''
    const destContact = doc.destination?.contact || ''

    // Row 4: Consignor header + Delivery Challan no
    wsData.push(['', 'Name of Consignor (Ship from)', '', '', '', '', '', '', '', '', 'Delivery Challan no.', '', '', doc.doc_no, '', ''])

    // Row 5: Consignor name
    wsData.push(['', doc.source?.name || '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 6: Address
    wsData.push(['', sourceAddress, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 7: More address + Delivery Challan date
    wsData.push(['', '', '', '', '', '', '', '', '', '', 'Delivery Challan date', '', '', formatDate(doc.doc_date), '', ''])

    // Row 8: Empty
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 9: Contact + KSI Challan No
    wsData.push(['', '', '', '', '', '', '', '', '', '', 'KSI CHALLAN NO.', '', '', ksiChallanNos, '', ''])

    // Row 10: Contact
    wsData.push(['', `Contact: ${sourceContact}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 11: GSTIN
    wsData.push(['', `GSTIN: ${sourceGstin}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 12: Consignee header + KSI Challan Date
    wsData.push(['', 'Name of Consignee (Ship To)', '', '', '', '', '', '', '', '', 'KSI CHALLAN DATE', '', '', ksiChallanDates, '', ''])

    // Row 13: Consignee name
    wsData.push(['', doc.destination?.name || '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 14-18: Consignee address details
    wsData.push(['', destAddress, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', `GSTIN: ${destGstin}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', `CONTACT: ${destContact}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 19: Empty
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Row 20-21: Table headers
    wsData.push([
      'SR.No.',
      'Material Code',
      'Description of Goods',
      'HSN of Goods',
      'Quantity',
      'Rate/ Price',
      'Total Amount (base price)',
      'Taxable Amount',
      'Central Tax/ CGST',
      '',
      'SGST/ UTGST',
      '',
      'Integrated Tax/ IGST',
      '',
      'Total Amount (incl. tax)',
      'REMARKS'
    ])
    wsData.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Rate',
      'Amount',
      'Rate',
      'Amount',
      'Rate',
      'Amount',
      '',
      ''
    ])

    // Data rows
    let totalQty = 0
    let totalBaseAmount = 0
    lines?.forEach((line, index) => {
      const qty = Number(line.qty) || 0
      const rate = Number((line.challan_line as any)?.unit_cost) || 0
      const hsnCode = (line.challan_line as any)?.hsn_code || ''
      const baseAmount = qty * rate

      totalQty += qty
      totalBaseAmount += baseAmount

      wsData.push([
        index + 1,
        line.material_code || '',
        line.material_description || '',
        hsnCode,
        qty,
        rate,
        baseAmount, // Total Amount base
        baseAmount, // Taxable Amount (same as base for now)
        0, // CGST Rate
        0, // CGST Amount
        0, // SGST Rate
        0, // SGST Amount
        0, // IGST Rate
        0, // IGST Amount
        baseAmount, // Total incl tax (no tax for now)
        line.ticket_code || '' // Remarks - using ticket code
      ])
    })

    // Total row
    wsData.push([
      '',
      '',
      'TOTAL',
      '',
      totalQty,
      '',
      totalBaseAmount,
      totalBaseAmount,
      '',
      '',
      '',
      '',
      '',
      '',
      totalBaseAmount,
      ''
    ])

    // Amount in words row
    wsData.push(['', 'IN WORDS:', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Empty rows
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    // Signature row
    wsData.push(['', '', '', '', '', '', '', '', '', '', '', 'Signature of supplier/ authorised representative', '', '', '', ''])

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },   // SR.No.
      { wch: 15 },  // Material Code
      { wch: 40 },  // Description
      { wch: 12 },  // HSN
      { wch: 10 },  // Quantity
      { wch: 12 },  // Rate
      { wch: 15 },  // Total base
      { wch: 12 },  // Taxable
      { wch: 6 },   // CGST Rate
      { wch: 10 },  // CGST Amount
      { wch: 6 },   // SGST Rate
      { wch: 10 },  // SGST Amount
      { wch: 6 },   // IGST Rate
      { wch: 10 },  // IGST Amount
      { wch: 15 },  // Total incl tax
      { wch: 20 },  // Remarks
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Challan')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${doc.doc_no}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('XLS generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate XLS', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
