import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
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
      .select(
        `
        *,
        challan_line:company_challan_lines(hsn_code, unit_cost)
      `
      )
      .eq('doc_id', id)
      .order('material_code')

    const items = lines || []

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // Colors tuned to match the “new system”
    const COLORS = {
      navy: rgb(0.09, 0.22, 0.37),
      slate: rgb(0.42, 0.49, 0.57),
      text: rgb(0.08, 0.1, 0.12),
      lightBox: rgb(0.96, 0.97, 0.99),
      rowAlt: rgb(0.98, 0.985, 0.995),
      line: rgb(0.86, 0.89, 0.93),
      white: rgb(1, 1, 1),
    }

    // Load logo (white logo recommended for dark header bar)
    // Keep this filename if that’s what you have in /public
    const logoPath = join(process.cwd(), 'public', 'horizontal-logo.png')
    let logoImage: any = null
    let logoDims: { width: number; height: number } | null = null
    try {
      const logoBytes = await readFile(logoPath)
      logoImage = await pdfDoc.embedPng(logoBytes)
      // Scale so it sits cleanly inside the top bar (no clipping)
      logoDims = logoImage.scale(0.01)
    } catch {
      // If logo missing, we just skip drawing it (PDF still generates)
    }

    const { width, height } = page.getSize()
    const M = 40
    const CONTENT_W = width - 2 * M

    // ---------- HEADER BAR ----------
    const headerH = 70
    drawRect(page, 0, height - headerH, width, headerH, COLORS.navy)

    if (logoImage && logoDims) {
      const padX = M
      const yLogo = height - headerH + (headerH - logoDims.height) / 2
      page.drawImage(logoImage, {
        x: padX,
        y: yLogo,
        width: logoDims.width,
        height: logoDims.height,
      })
    }

    // ---------- TITLE ----------
    let y = height - headerH - 28

    drawTextCenter(page, 'DELIVERY CHALLAN', width / 2, y, {
      font: fontBold,
      size: 18,
      color: COLORS.navy,
    })
    y -= 16
    drawTextCenter(page, 'Goods Movement - Returnable Basis', width / 2, y, {
      font,
      size: 9.5,
      color: COLORS.slate,
    })
    y -= 22

    // ---------- INFO ROW (with “pills”) ----------
    const ksiChallanNos = [...new Set(items.map(l => l.company_delivery_no).filter(Boolean))].join(', ')
    const infoRowY = y

    drawLabelValuePill(page, {
      label: 'Challan No:',
      value: String(doc.doc_no || ''),
      x: M,
      y: infoRowY,
      maxPillW: 170,
      font,
      fontBold,
      colors: COLORS,
    })

    drawLabelValuePill(page, {
      label: 'Date:',
      value: formatDate(doc.doc_date),
      x: M + 230,
      y: infoRowY,
      maxPillW: 110,
      font,
      fontBold,
      colors: COLORS,
    })

    if (ksiChallanNos) {
      drawLabelValuePill(page, {
        label: 'Ref (KSI):',
        value: ksiChallanNos,
        x: M + 380,
        y: infoRowY,
        maxPillW: 150,
        font,
        fontBold,
        colors: COLORS,
      })
    }

    y -= 28

    // ---------- SHIP FROM / SHIP TO CARDS ----------
    const cardGap = 15
    const cardW = (CONTENT_W - cardGap) / 2
    const cardH = 92

    drawCard(page, {
      x: M,
      y: y - cardH,
      w: cardW,
      h: cardH,
      title: 'SHIP FROM (CONSIGNOR)',
      name: doc.source?.name || 'N/A',
      lines:
        (doc.source?.name || '') === 'Arsh Traders'
          ? [
              ARSH_TRADERS_ADDRESS,
              `GSTIN: ${ARSH_TRADERS_GSTIN}`,
              `Email: ${ARSH_TRADERS_EMAIL}`,
            ]
          : compactLines([
              doc.source?.address ? doc.source.address : '',
              doc.source?.gstin ? `GSTIN: ${doc.source.gstin}` : '',
              doc.source?.contact ? `Contact: ${doc.source.contact}` : '',
            ]),
      font,
      fontBold,
      colors: COLORS,
    })

    drawCard(page, {
      x: M + cardW + cardGap,
      y: y - cardH,
      w: cardW,
      h: cardH,
      title: 'SHIP TO (CONSIGNEE)',
      name: doc.destination?.name || 'N/A',
      lines: compactLines([
        doc.destination?.address ? doc.destination.address : '',
        doc.destination?.gstin ? `GSTIN: ${doc.destination.gstin}` : '',
        doc.destination?.contact ? `Contact: ${doc.destination.contact}` : '',
      ]),
      font,
      fontBold,
      colors: COLORS,
    })

    y -= cardH + 18

    // ---------- ITEMS TABLE ----------
    const tableX = M
    const tableW = CONTENT_W

    // Column widths sum to tableW
    const COL = {
      sr: 30,
      code: 85,
      desc: 190,
      hsn: 70,
      qty: 40,
      rate: 55,
      amt: 55,
    }
    const X = {
      sr: tableX,
      code: tableX + COL.sr,
      desc: tableX + COL.sr + COL.code,
      hsn: tableX + COL.sr + COL.code + COL.desc,
      qty: tableX + COL.sr + COL.code + COL.desc + COL.hsn,
      rate: tableX + COL.sr + COL.code + COL.desc + COL.hsn + COL.qty,
      amt: tableX + COL.sr + COL.code + COL.desc + COL.hsn + COL.qty + COL.rate,
      right: tableX + tableW,
    }

    const th = 22
    drawRect(page, tableX, y - th, tableW, th, COLORS.navy)

    const headerY = y - 15
    drawText(page, 'SR.', X.sr + 8, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'MATERIAL CODE', X.code + 8, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'DESCRIPTION', X.desc + 8, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'HSN', X.hsn + 8, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'QTY', X.qty + 10, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'RATE (1)', X.rate + 8, headerY, { font: fontBold, size: 8.5, color: COLORS.white })
    drawText(page, 'AMOUNT (1)', X.amt + 6, headerY, { font: fontBold, size: 8.5, color: COLORS.white })

    y -= th

    let totalQty = 0
    let totalAmount = 0

    const rowPadY = 6
    const baseRowH = 22

    if (items.length === 0) {
      const emptyH = 34
      drawRect(page, tableX, y - emptyH, tableW, emptyH, COLORS.rowAlt)
      drawText(page, 'No items', tableX + 10, y - 22, { font, size: 9, color: COLORS.slate })
      y -= emptyH
    } else {
      for (let i = 0; i < items.length; i++) {
        const line = items[i]
        const qty = Number(line.qty) || 0
        const rate = Number(line.challan_line?.unit_cost) || 0
        const amount = qty * rate
        const hsn = String(line.challan_line?.hsn_code || '')

        totalQty += qty
        totalAmount += amount

        // Wrap description to max 2 lines like the “new system”
        const descLines = wrapText(String(line.material_description || ''), font, 9, COL.desc - 16, 2)
        const rowH = Math.max(baseRowH, rowPadY * 2 + descLines.length * 10)

        // Row background (very subtle)
        if (i % 2 === 1) drawRect(page, tableX, y - rowH, tableW, rowH, COLORS.rowAlt)

        // Bottom grid line
        drawLine(page, tableX, y - rowH, tableX + tableW, y - rowH, 0.75, COLORS.line)

        // Text positions
        const ty = y - rowPadY - 10

        drawText(page, String(i + 1), X.sr + 10, ty, { font, size: 9, color: COLORS.text })
        drawText(page, String(line.material_code || ''), X.code + 8, ty, {
          font: fontBold,
          size: 9,
          color: COLORS.text,
        })

        for (let li = 0; li < descLines.length; li++) {
          drawText(page, descLines[li], X.desc + 8, ty - li * 10, {
            font,
            size: 9,
            color: COLORS.text,
          })
        }

        drawText(page, hsn, X.hsn + 8, ty, { font, size: 9, color: COLORS.text })

        drawTextRight(page, String(qty), X.qty + COL.qty - 8, ty, { font: fontBold, size: 9, color: COLORS.text })
        drawTextRight(
          page,
          rate > 0 ? formatIndianCurrency(rate) : '-',
          X.rate + COL.rate - 8,
          ty,
          { font, size: 9, color: COLORS.text }
        )
        drawTextRight(
          page,
          amount > 0 ? formatIndianCurrency(amount) : '-',
          X.amt + COL.amt - 8,
          ty,
          { font: fontBold, size: 9, color: COLORS.text }
        )

        y -= rowH
      }
    }

    // TOTAL row (like new system)
    const totalRowH = 26
    drawLine(page, tableX, y, tableX + tableW, y, 2, COLORS.navy)
    drawRect(page, tableX, y - totalRowH, tableW, totalRowH, COLORS.lightBox)

    drawTextCenter(page, 'TOTAL', tableX + tableW / 2, y - 18, {
      font: fontBold,
      size: 10,
      color: COLORS.text,
    })
    drawTextRight(page, String(totalQty), X.qty + COL.qty - 8, y - 18, {
      font: fontBold,
      size: 10,
      color: COLORS.text,
    })
    drawTextRight(page, formatIndianCurrency(totalAmount), X.amt + COL.amt - 8, y - 18, {
      font: fontBold,
      size: 10,
      color: COLORS.text,
    })

    y -= totalRowH + 18

    // Divider line under table (matches new system)
    drawLine(page, tableX, y, tableX + tableW, y, 2, COLORS.navy)
    y -= 22

    // ---------- TOTALS BLOCK (right aligned) ----------
    const totalsX = tableX + tableW - 170
    const totalsRight = tableX + tableW

    drawText(page, 'Total Quantity:', totalsX, y, { font, size: 9.5, color: COLORS.slate })
    drawTextRight(page, String(totalQty), totalsRight, y, { font: fontBold, size: 9.5, color: COLORS.text })
    y -= 16

    drawText(page, 'Sub Total:', totalsX, y, { font, size: 9.5, color: COLORS.slate })
    drawTextRight(page, formatIndianCurrency(totalAmount), totalsRight, y, {
      font: fontBold,
      size: 9.5,
      color: COLORS.text,
    })
    y -= 10

    // line above grand total
    drawLine(page, totalsX, y, totalsRight, y, 2, COLORS.navy)
    y -= 20

    drawText(page, 'Grand Total:', totalsX, y, { font: fontBold, size: 10.5, color: COLORS.navy })
    drawTextRight(page, formatIndianCurrency(totalAmount), totalsRight, y, {
      font: fontBold,
      size: 10.5,
      color: COLORS.navy,
    })
    y -= 28

    // ---------- AMOUNT IN WORDS ----------
    const wordsH = 40
    drawRect(page, M, y - wordsH, CONTENT_W, wordsH, COLORS.lightBox)
    drawText(page, 'Amount in Words', M + 10, y - 16, { font, size: 8, color: COLORS.slate })
    drawText(page, numberToWords(totalAmount), M + 10, y - 30, { font: fontItalic, size: 9.5, color: COLORS.text })

    y -= wordsH + 42

    // ---------- SIGNATURE LINES ----------
    const lineY = y
    drawLine(page, M + 10, lineY, M + 230, lineY, 1, COLORS.line)
    drawLine(page, M + CONTENT_W - 230, lineY, M + CONTENT_W - 10, lineY, 1, COLORS.line)

    y -= 14
    drawTextCenter(page, 'Received By (Consignee)', M + 120, y, { font, size: 8.5, color: COLORS.slate })
    drawTextCenter(page, 'Authorized Signatory (Arsh Traders)', M + CONTENT_W - 120, y, {
      font,
      size: 8.5,
      color: COLORS.slate,
    })

    // ---------- FOOTER BAR ----------
    const footerH = 32
    drawRect(page, 0, 0, width, footerH, COLORS.navy)

    drawText(page, `Email: ${ARSH_TRADERS_EMAIL} | Website: ${ARSH_TRADERS_WEBSITE}`, M, 12, {
      font,
      size: 7,
      color: COLORS.white,
    })
    drawTextRight(page, ARSH_TRADERS_ADDRESS, width - M, 12, { font, size: 7, color: COLORS.white })

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

/* ---------------- Helpers ---------------- */

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function compactLines(lines: string[]) {
  return (lines || [])
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .map(s => (s.length > 70 ? s.slice(0, 68) + '..' : s))
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: any) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness: number, color: any) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  opts: { font: PDFFont; size: number; color: any }
) {
  page.drawText(String(text || ''), { x, y, font: opts.font, size: opts.size, color: opts.color })
}

function drawTextRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  opts: { font: PDFFont; size: number; color: any }
) {
  const t = String(text || '')
  const w = opts.font.widthOfTextAtSize(t, opts.size)
  page.drawText(t, { x: xRight - w, y, font: opts.font, size: opts.size, color: opts.color })
}

function drawTextCenter(
  page: PDFPage,
  text: string,
  xCenter: number,
  y: number,
  opts: { font: PDFFont; size: number; color: any }
) {
  const t = String(text || '')
  const w = opts.font.widthOfTextAtSize(t, opts.size)
  page.drawText(t, { x: xCenter - w / 2, y, font: opts.font, size: opts.size, color: opts.color })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']

  const words = raw.split(' ')
  const lines: string[] = []
  let cur = ''

  const pushLine = (s: string) => lines.push(s.trim())

  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w
    const trialW = font.widthOfTextAtSize(trial, size)
    if (trialW <= maxWidth) {
      cur = trial
      continue
    }

    if (cur) pushLine(cur)
    cur = w

    if (lines.length === maxLines - 1) break
  }

  if (lines.length < maxLines && cur) pushLine(cur)

  // Ellipsize if we still have remaining words
  const used = lines.join(' ').split(' ').length
  if (used < words.length) {
    const lastIdx = Math.min(lines.length, maxLines) - 1
    let last = lines[lastIdx] || ''
    while (font.widthOfTextAtSize(last + '…', size) > maxWidth && last.length > 1) {
      last = last.slice(0, -1)
    }
    lines[lastIdx] = last.trim() + '…'
  }

  return lines.slice(0, maxLines)
}

function drawLabelValuePill(page: PDFPage, args: {
  label: string
  value: string
  x: number
  y: number
  maxPillW: number
  font: PDFFont
  fontBold: PDFFont
  colors: any
}) {
  const { label, value, x, y, maxPillW, font, fontBold, colors } = args

  drawText(page, label, x, y, { font, size: 9, color: colors.slate })

  const pillPadX = 8
  const pillH = 16
  const textSize = 9.5
  const textW = fontBold.widthOfTextAtSize(value, textSize)
  const pillW = Math.min(maxPillW, textW + pillPadX * 2)

  const pillX = x + font.widthOfTextAtSize(label, 9) + 8
  const pillY = y - 4

  drawRect(page, pillX, pillY, pillW, pillH, colors.lightBox)
  drawText(page, value, pillX + pillPadX, pillY + 4, { font: fontBold, size: textSize, color: colors.text })
}

function drawCard(page: PDFPage, args: {
  x: number
  y: number
  w: number
  h: number
  title: string
  name: string
  lines: string[]
  font: PDFFont
  fontBold: PDFFont
  colors: any
}) {
  const { x, y, w, h, title, name, lines, font, fontBold, colors } = args

  // main box
  drawRect(page, x, y, w, h, colors.lightBox)
  // left accent bar
  drawRect(page, x, y, 3, h, colors.navy)

  drawText(page, title, x + 12, y + h - 16, { font, size: 8.5, color: colors.slate })
  drawText(page, name, x + 12, y + h - 32, { font: fontBold, size: 10.5, color: colors.text })

  let ty = y + h - 46
  for (const line of lines.slice(0, 3)) {
    drawText(page, line, x + 12, ty, { font, size: 8.2, color: colors.text })
    ty -= 11
  }
}
