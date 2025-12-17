import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
import { numberToWords, formatIndianCurrency } from '@/lib/numberToWords'

// Fixed Arsh Traders details
const ARSH_TRADERS_ADDRESS = 'Plot No. 119-2A, Saket Nagar, Bhopal - 462024 (M.P.)'
const ARSH_TRADERS_GSTIN = '23AECPC0996H2ZR'
const ARSH_TRADERS_EMAIL = 'director@arshtraders.com'
const ARSH_TRADERS_WEBSITE = 'arshtraders.com'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createServerSupabaseAdmin()

  try {
    // Fetch document
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

    // Fetch lines
    const { data: lines } = await supabase
      .from('doc_lines')
      .select(`
        *,
        challan_line:company_challan_lines(hsn_code, unit_cost)
      `)
      .eq('doc_id', id)
      .order('material_code')

    // Create PDF
    const doc2 = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc2.on('data', (chunk) => chunks.push(chunk))

    await new Promise<void>((resolve, reject) => {
      doc2.on('end', () => resolve())
      doc2.on('error', reject)

      // Generate PDF content
      generatePDF(doc2, doc, lines || [])
      doc2.end()
    })

    const pdfBuffer = Buffer.concat(chunks)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.doc_no}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF Generation Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

function generatePDF(doc: PDFKit.PDFDocument, docData: any, lines: any[]) {
  const NAVY = '#1e3a5f'

  // Header
  doc.fontSize(24).fillColor(NAVY).text('ARSH TRADERS', { align: 'center' })
  doc.fontSize(10).fillColor('#666').text('Goods Movement - Returnable Basis', { align: 'center' })
  doc.moveDown()

  // Document info
  doc.fontSize(16).fillColor(NAVY).text('DELIVERY CHALLAN', { align: 'center' })
  doc.moveDown()

  doc.fontSize(10).fillColor('#000')
  doc.text(`Challan No: ${docData.doc_no}`, 50)
  doc.text(`Date: ${formatDate(docData.doc_date)}`, 50)
  doc.moveDown()

  // Consignor
  doc.fontSize(12).fillColor(NAVY).text('Ship From (Consignor)', 50)
  doc.fontSize(10).fillColor('#000')
  doc.text(`${docData.source?.name || 'N/A'}`, 50)
  if (docData.source?.name === 'Arsh Traders') {
    doc.text(ARSH_TRADERS_ADDRESS, 50)
    doc.text(`GSTIN: ${ARSH_TRADERS_GSTIN}`, 50)
    doc.text(`Email: ${ARSH_TRADERS_EMAIL}`, 50)
  } else {
    if (docData.source?.address) doc.text(docData.source.address, 50)
    if (docData.source?.gstin) doc.text(`GSTIN: ${docData.source.gstin}`, 50)
    if (docData.source?.contact) doc.text(`Contact: ${docData.source.contact}`, 50)
  }
  doc.moveDown()

  // Consignee
  doc.fontSize(12).fillColor(NAVY).text('Ship To (Consignee)', 50)
  doc.fontSize(10).fillColor('#000')
  doc.text(`${docData.destination?.name || 'N/A'}`, 50)
  if (docData.destination?.address) doc.text(docData.destination.address, 50)
  if (docData.destination?.gstin) doc.text(`GSTIN: ${docData.destination.gstin}`, 50)
  if (docData.destination?.contact) doc.text(`Contact: ${docData.destination.contact}`, 50)
  doc.moveDown(2)

  // Table header
  const tableTop = doc.y
  const colX = [50, 80, 160, 310, 380, 430, 510]

  doc.fontSize(9).fillColor(NAVY)
  doc.text('Sr.', colX[0], tableTop)
  doc.text('Material Code', colX[1], tableTop)
  doc.text('Description', colX[2], tableTop)
  doc.text('HSN', colX[3], tableTop)
  doc.text('Qty', colX[4], tableTop)
  doc.text('Rate (₹)', colX[5], tableTop)
  doc.text('Amount (₹)', colX[6], tableTop)

  doc.moveTo(50, tableTop + 15).lineTo(590, tableTop + 15).stroke()

  // Table rows
  let y = tableTop + 25
  let totalQty = 0
  let totalAmount = 0

  lines.forEach((line, idx) => {
    if (y > 700) {
      doc.addPage()
      y = 50
    }

    const qty = Number(line.qty) || 0
    const rate = Number(line.challan_line?.unit_cost) || 0
    const amount = qty * rate
    const hsn = String(line.challan_line?.hsn_code || '')

    totalQty += qty
    totalAmount += amount

    doc.fontSize(9).fillColor('#000')
    doc.text(String(idx + 1), colX[0], y)
    doc.text(String(line.material_code || ''), colX[1], y, { width: 70 })
    doc.text(String(line.material_description || ''), colX[2], y, { width: 140 })
    doc.text(hsn, colX[3], y, { width: 65 })
    doc.text(String(qty), colX[4], y)
    doc.text(rate > 0 ? formatIndianCurrency(rate) : '-', colX[5], y)
    doc.text(amount > 0 ? formatIndianCurrency(amount) : '-', colX[6], y)

    y += 20
  })

  // Total line
  doc.moveTo(50, y).lineTo(590, y).stroke()
  y += 10

  doc.fontSize(10).fillColor(NAVY)
  doc.text('TOTAL', colX[2] + 50, y)
  doc.text(String(totalQty), colX[4], y)
  doc.text(totalAmount > 0 ? formatIndianCurrency(totalAmount) : '-', colX[6], y)

  y += 30

  // Amount in words
  if (totalAmount > 0) {
    doc.fontSize(10).fillColor('#000')
    doc.text('Amount in Words:', 50, y)
    doc.fontSize(10).fillColor(NAVY)
    doc.text(numberToWords(totalAmount), 50, y + 15, { width: 500 })
    y += 50
  }

  // Footer
  doc.fontSize(8).fillColor('#666')
  doc.text(`Email: ${ARSH_TRADERS_EMAIL} | Website: ${ARSH_TRADERS_WEBSITE}`, 50, 750, { align: 'center' })
  doc.text(ARSH_TRADERS_ADDRESS, 50, 765, { align: 'center' })
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
