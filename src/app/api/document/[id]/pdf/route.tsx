import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
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
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { width, height } = page.getSize()
    const navy = rgb(0.12, 0.23, 0.37)
    const gray = rgb(0.4, 0.4, 0.4)
    const black = rgb(0, 0, 0)

    let y = height - 50

    // Header
    page.drawText('ARSH TRADERS', {
      x: width / 2 - 80,
      y,
      size: 24,
      font: fontBold,
      color: navy,
    })
    y -= 20

    page.drawText('Goods Movement - Returnable Basis', {
      x: width / 2 - 90,
      y,
      size: 10,
      font,
      color: gray,
    })
    y -= 30

    // Document Title
    page.drawText('DELIVERY CHALLAN', {
      x: width / 2 - 70,
      y,
      size: 16,
      font: fontBold,
      color: navy,
    })
    y -= 30

    // Document Info
    page.drawText(`Challan No: ${doc.doc_no}`, { x: 50, y, size: 10, font, color: black })
    y -= 15
    page.drawText(`Date: ${formatDate(doc.doc_date)}`, { x: 50, y, size: 10, font, color: black })
    y -= 25

    // Consignor
    page.drawText('Ship From (Consignor)', { x: 50, y, size: 12, font: fontBold, color: navy })
    y -= 15
    page.drawText(doc.source?.name || 'N/A', { x: 50, y, size: 10, font, color: black })
    y -= 12

    if (doc.source?.name === 'Arsh Traders') {
      page.drawText(ARSH_TRADERS_ADDRESS, { x: 50, y, size: 9, font, color: black })
      y -= 12
      page.drawText(`GSTIN: ${ARSH_TRADERS_GSTIN}`, { x: 50, y, size: 9, font, color: black })
      y -= 12
      page.drawText(`Email: ${ARSH_TRADERS_EMAIL}`, { x: 50, y, size: 9, font, color: black })
      y -= 12
    } else {
      if (doc.source?.address) {
        page.drawText(doc.source.address, { x: 50, y, size: 9, font, color: black })
        y -= 12
      }
      if (doc.source?.gstin) {
        page.drawText(`GSTIN: ${doc.source.gstin}`, { x: 50, y, size: 9, font, color: black })
        y -= 12
      }
      if (doc.source?.contact) {
        page.drawText(`Contact: ${doc.source.contact}`, { x: 50, y, size: 9, font, color: black })
        y -= 12
      }
    }
    y -= 10

    // Consignee
    page.drawText('Ship To (Consignee)', { x: 50, y, size: 12, font: fontBold, color: navy })
    y -= 15
    page.drawText(doc.destination?.name || 'N/A', { x: 50, y, size: 10, font, color: black })
    y -= 12

    if (doc.destination?.address) {
      page.drawText(doc.destination.address, { x: 50, y, size: 9, font, color: black })
      y -= 12
    }
    if (doc.destination?.gstin) {
      page.drawText(`GSTIN: ${doc.destination.gstin}`, { x: 50, y, size: 9, font, color: black })
      y -= 12
    }
    if (doc.destination?.contact) {
      page.drawText(`Contact: ${doc.destination.contact}`, { x: 50, y, size: 9, font, color: black })
      y -= 12
    }
    y -= 20

    // Table Header
    const colX = [50, 100, 200, 340, 400, 460, 520]
    page.drawText('Sr.', { x: colX[0], y, size: 9, font: fontBold, color: navy })
    page.drawText('Code', { x: colX[1], y, size: 9, font: fontBold, color: navy })
    page.drawText('Description', { x: colX[2], y, size: 9, font: fontBold, color: navy })
    page.drawText('HSN', { x: colX[3], y, size: 9, font: fontBold, color: navy })
    page.drawText('Qty', { x: colX[4], y, size: 9, font: fontBold, color: navy })
    page.drawText('Rate', { x: colX[5], y, size: 9, font: fontBold, color: navy })
    page.drawText('Amount', { x: colX[6], y, size: 9, font: fontBold, color: navy })

    y -= 2
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: navy })
    y -= 15

    // Table Rows
    let totalQty = 0
    let totalAmount = 0

    for (let idx = 0; idx < (lines || []).length; idx++) {
      const line = lines![idx]

      if (y < 100) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([595, 842])
        y = height - 50
        newPage.drawText('Sr.', { x: colX[0], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('Code', { x: colX[1], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('Description', { x: colX[2], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('HSN', { x: colX[3], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('Qty', { x: colX[4], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('Rate', { x: colX[5], y, size: 9, font: fontBold, color: navy })
        newPage.drawText('Amount', { x: colX[6], y, size: 9, font: fontBold, color: navy })
        y -= 15
      }

      const qty = Number(line.qty) || 0
      const rate = Number(line.challan_line?.unit_cost) || 0
      const amount = qty * rate
      const hsn = String(line.challan_line?.hsn_code || '')

      totalQty += qty
      totalAmount += amount

      page.drawText(String(idx + 1), { x: colX[0], y, size: 8, font, color: black })
      page.drawText(truncate(String(line.material_code || ''), 10), { x: colX[1], y, size: 7, font, color: black })
      page.drawText(truncate(String(line.material_description || ''), 20), { x: colX[2], y, size: 8, font, color: black })
      page.drawText(truncate(hsn, 10), { x: colX[3], y, size: 8, font, color: black })
      page.drawText(String(qty), { x: colX[4], y, size: 8, font: fontBold, color: black })
      page.drawText(rate > 0 ? formatIndianCurrency(rate) : '-', { x: colX[5], y, size: 8, font, color: black })
      page.drawText(amount > 0 ? formatIndianCurrency(amount) : '-', { x: colX[6], y, size: 8, font: fontBold, color: black })

      y -= 18
    }

    // Total Line
    y -= 5
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: navy })
    y -= 15

    page.drawText('TOTAL', { x: colX[2], y, size: 10, font: fontBold, color: navy })
    page.drawText(String(totalQty), { x: colX[4], y, size: 10, font: fontBold, color: navy })
    page.drawText(totalAmount > 0 ? formatIndianCurrency(totalAmount) : '-', { x: colX[6], y, size: 10, font: fontBold, color: navy })

    y -= 25

    // Amount in Words
    if (totalAmount > 0) {
      page.drawText('Amount in Words:', { x: 50, y, size: 10, font, color: black })
      y -= 15
      page.drawText(numberToWords(totalAmount), { x: 50, y, size: 10, font: fontBold, color: navy })
      y -= 20
    }

    // Footer
    page.drawText(`Email: ${ARSH_TRADERS_EMAIL} | Website: ${ARSH_TRADERS_WEBSITE}`, {
      x: width / 2 - 120,
      y: 40,
      size: 8,
      font,
      color: gray,
    })
    page.drawText(ARSH_TRADERS_ADDRESS, {
      x: width / 2 - 130,
      y: 25,
      size: 8,
      font,
      color: gray,
    })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
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

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function truncate(str: string, maxLen: number) {
  return str.length > maxLen ? str.substring(0, maxLen - 2) + '..' : str
}
