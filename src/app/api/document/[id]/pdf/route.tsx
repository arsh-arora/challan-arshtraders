import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { numberToWords, formatIndianCurrency } from '@/lib/numberToWords'
import { readFile } from 'fs/promises'
import { join } from 'path'

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
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Load and embed logo
    const logoPath = join(process.cwd(), 'HORIZONTAL LOGO.png')
    const logoBytes = await readFile(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    const logoDims = logoImage.scale(0.3) // Scale to appropriate size

    const { width, height } = page.getSize()
    const navy = rgb(0.12, 0.23, 0.37)
    const gray = rgb(0.47, 0.55, 0.64)
    const lightGray = rgb(0.97, 0.98, 0.99)
    const black = rgb(0, 0, 0)
    const white = rgb(1, 1, 1)

    let y = height

    // Header - Navy background
    page.drawRectangle({ x: 0, y: y - 80, width, height: 80, color: navy })

    // Draw Arsh Traders logo
    page.drawImage(logoImage, {
      x: 70,
      y: y - 70,
      width: logoDims.width,
      height: logoDims.height,
    })

    y -= 100

    // Navy stripe
    page.drawRectangle({ x: 0, y: y - 4, width, height: 4, color: navy })
    y -= 35

    // Title
    page.drawText('DELIVERY CHALLAN', { x: width / 2 - 95, y, size: 20, font: fontBold, color: navy })
    y -= 18
    page.drawText('Goods Movement - Returnable Basis', { x: width / 2 - 95, y, size: 10, font, color: gray })
    y -= 30

    // Document info row (Challan No, Date, Ref)
    const ksiChallanNos = [...new Set((lines || []).map(l => l.company_delivery_no).filter(Boolean))].join(', ')

    page.drawText('Challan No:', { x: 40, y, size: 10, font, color: gray })
    page.drawText(doc.doc_no, { x: 105, y, size: 10, font: fontBold, color: black })

    page.drawText('Date:', { x: 280, y, size: 10, font, color: gray })
    page.drawText(formatDate(doc.doc_date), { x: 315, y, size: 10, font: fontBold, color: black })

    if (ksiChallanNos) {
      page.drawText('Ref (KSI):', { x: 450, y, size: 10, font, color: gray })
      page.drawText(ksiChallanNos, { x: 505, y, size: 10, font: fontBold, color: black })
    }

    y -= 30

    // Consignor/Consignee boxes
    const boxWidth = 250
    const boxHeight = 85
    const boxX1 = 40
    const boxX2 = 305

    // Consignor box (left)
    page.drawRectangle({ x: boxX1, y: y - boxHeight, width: boxWidth, height: boxHeight, color: lightGray })
    page.drawRectangle({ x: boxX1, y: y - boxHeight, width: 3, height: boxHeight, color: navy })

    page.drawText('SHIP FROM (CONSIGNOR)', { x: boxX1 + 10, y: y - 15, size: 9, font, color: gray })
    page.drawText(doc.source?.name || 'N/A', { x: boxX1 + 10, y: y - 30, size: 11, font: fontBold, color: black })

    let consignorY = y - 43
    if (doc.source?.name === 'Arsh Traders') {
      page.drawText(ARSH_TRADERS_ADDRESS, { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
      consignorY -= 11
      page.drawText(`GSTIN: ${ARSH_TRADERS_GSTIN}`, { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
      consignorY -= 11
      page.drawText(`Email: ${ARSH_TRADERS_EMAIL}`, { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
    } else {
      if (doc.source?.address) {
        page.drawText(doc.source.address.substring(0, 45), { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
        consignorY -= 11
      }
      if (doc.source?.gstin) {
        page.drawText(`GSTIN: ${doc.source.gstin}`, { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
        consignorY -= 11
      }
      if (doc.source?.contact) {
        page.drawText(`Contact: ${doc.source.contact}`, { x: boxX1 + 10, y: consignorY, size: 8, font, color: black })
      }
    }

    // Consignee box (right)
    page.drawRectangle({ x: boxX2, y: y - boxHeight, width: boxWidth, height: boxHeight, color: lightGray })
    page.drawRectangle({ x: boxX2, y: y - boxHeight, width: 3, height: boxHeight, color: navy })

    page.drawText('SHIP TO (CONSIGNEE)', { x: boxX2 + 10, y: y - 15, size: 9, font, color: gray })
    page.drawText(doc.destination?.name || 'N/A', { x: boxX2 + 10, y: y - 30, size: 11, font: fontBold, color: black })

    let consigneeY = y - 43
    if (doc.destination?.address) {
      page.drawText(doc.destination.address.substring(0, 45), { x: boxX2 + 10, y: consigneeY, size: 8, font, color: black })
      consigneeY -= 11
    }
    if (doc.destination?.gstin) {
      page.drawText(`GSTIN: ${doc.destination.gstin}`, { x: boxX2 + 10, y: consigneeY, size: 8, font, color: black })
      consigneeY -= 11
    }
    if (doc.destination?.contact) {
      page.drawText(`Contact: ${doc.destination.contact}`, { x: boxX2 + 10, y: consigneeY, size: 8, font, color: black })
    }

    y -= boxHeight + 25

    // Table Header
    const tableTop = y
    const colX = [40, 70, 140, 340, 450, 500, 530]

    page.drawRectangle({ x: 40, y: tableTop - 20, width: width - 80, height: 20, color: navy })

    page.drawText('SR.', { x: colX[0] + 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('MATERIAL CODE', { x: colX[1] + 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('DESCRIPTION', { x: colX[2] + 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('HSN', { x: colX[3] + 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('QTY', { x: colX[4] + 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('RATE (Rs.)', { x: colX[5] - 5, y: tableTop - 13, size: 8, font: fontBold, color: white })
    page.drawText('AMOUNT (Rs.)', { x: colX[6] - 10, y: tableTop - 13, size: 8, font: fontBold, color: white })

    y = tableTop - 23

    // Table Rows
    let totalQty = 0
    let totalAmount = 0

    for (let idx = 0; idx < (lines || []).length; idx++) {
      const line = lines![idx]
      const qty = Number(line.qty) || 0
      const rate = Number(line.challan_line?.unit_cost) || 0
      const amount = qty * rate
      const hsn = String(line.challan_line?.hsn_code || '')

      totalQty += qty
      totalAmount += amount

      // Alternating row background
      if (idx % 2 === 1) {
        page.drawRectangle({ x: 40, y: y - 18, width: width - 80, height: 18, color: lightGray })
      }

      y -= 13

      page.drawText(String(idx + 1), { x: colX[0] + 5, y, size: 8, font, color: black })
      page.drawText(truncate(String(line.material_code || ''), 12), { x: colX[1] + 5, y, size: 7, font: fontBold, color: black })
      page.drawText(truncate(String(line.material_description || ''), 35), { x: colX[2] + 5, y, size: 8, font, color: black })
      page.drawText(hsn, { x: colX[3] + 5, y, size: 8, font, color: black })
      page.drawText(String(qty), { x: colX[4] + 15, y, size: 8, font: fontBold, color: black })
      page.drawText(rate > 0 ? formatIndianCurrency(rate) : '-', { x: colX[5] + 5, y, size: 8, font, color: black })
      page.drawText(amount > 0 ? formatIndianCurrency(amount) : '-', { x: colX[6] + 5, y, size: 8, font: fontBold, color: black })

      y -= 5
    }

    // Total row
    y -= 5
    page.drawRectangle({ x: 40, y: y - 20, width: width - 80, height: 2, color: navy })
    y -= 15

    page.drawText('TOTAL', { x: colX[3], y, size: 10, font: fontBold, color: black })
    page.drawText(String(totalQty), { x: colX[4] + 15, y, size: 10, font: fontBold, color: black })
    page.drawText(formatIndianCurrency(totalAmount), { x: colX[6] + 5, y, size: 10, font: fontBold, color: black })

    y -= 35

    // Totals section (right-aligned)
    page.drawText('Total Quantity:', { x: 435, y, size: 10, font, color: black })
    page.drawText(String(totalQty), { x: 535, y, size: 10, font: fontBold, color: black })
    y -= 18

    page.drawText('Sub Total:', { x: 435, y, size: 10, font, color: black })
    page.drawText(formatIndianCurrency(totalAmount), { x: 490, y, size: 10, font: fontBold, color: black })
    y -= 5

    // Grand Total with line
    page.drawRectangle({ x: 430, y: y - 2, width: 125, height: 2, color: navy })
    y -= 20

    page.drawText('Grand Total:', { x: 435, y, size: 11, font: fontBold, color: navy })
    page.drawText('Rs. ' + formatIndianCurrency(totalAmount), { x: 490, y, size: 11, font: fontBold, color: navy })

    y -= 35

    // Amount in Words box
    if (totalAmount > 0) {
      page.drawRectangle({ x: 40, y: y - 35, width: 515, height: 35, color: lightGray })

      page.drawText('Amount in Words', { x: 50, y: y - 15, size: 8, font, color: gray })
      page.drawText(numberToWords(totalAmount), { x: 50, y: y - 28, size: 10, font: fontItalic, color: black })
    }

    y -= 60

    // Signature section
    page.drawLine({ start: { x: 50, y: y }, end: { x: 230, y }, thickness: 1, color: gray })
    page.drawLine({ start: { x: 365, y: y }, end: { x: 545, y }, thickness: 1, color: gray })

    y -= 15
    page.drawText('Received By (Consignee)', { x: 90, y, size: 9, font, color: gray })
    page.drawText('Authorized Signatory (Arsh Traders)', { x: 370, y, size: 9, font, color: gray })

    // Footer - Navy background
    page.drawRectangle({ x: 0, y: 0, width, height: 35, color: navy })

    page.drawText(`Email: ${ARSH_TRADERS_EMAIL} | Website: ${ARSH_TRADERS_WEBSITE}`, {
      x: 40,
      y: 15,
      size: 7,
      font,
      color: white,
    })
    page.drawText(ARSH_TRADERS_ADDRESS, {
      x: width - 290,
      y: 15,
      size: 7,
      font,
      color: white,
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
