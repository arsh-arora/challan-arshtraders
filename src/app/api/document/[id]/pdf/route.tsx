import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer'
import React, { ReactElement } from 'react'
import DeliveryChallanPDF from '@/components/DeliveryChallanPDF'

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

    // Fetch lines with HSN and unit_cost from challan_lines
    const { data: lines } = await supabase
      .from('doc_lines')
      .select(`
        *,
        challan_line:company_challan_lines(hsn_code, unit_cost)
      `)
      .eq('doc_id', id)
      .order('material_code')

    // Flatten nested objects for React PDF (can't handle nested objects)
    const flatDoc = {
      ...doc,
      source_location: doc.source,
      dest_location: doc.destination,
    }
    delete flatDoc.source
    delete flatDoc.destination

    const flatLines = (lines || []).map(line => ({
      ...line,
      hsn_code: line.challan_line?.hsn_code,
      unit_cost: line.challan_line?.unit_cost,
    }))

    // Generate PDF using the new professional DeliveryChallanPDF
    const pdfElement = React.createElement(DeliveryChallanPDF, { doc: flatDoc, lines: flatLines })
    const buffer = await renderToBuffer(pdfElement as unknown as ReactElement<DocumentProps>)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.doc_no}.pdf"`,
      },
    })
  } catch (error) {
    // Log detailed error information
    console.error('=== PDF GENERATION ERROR ===')
    console.error('Error:', error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Document data:', JSON.stringify(doc, null, 2))
    console.error('Lines count:', lines?.length || 0)
    if (lines && lines.length > 0) {
      console.error('First line sample:', JSON.stringify(lines[0], null, 2))
    }
    console.error('===========================')

    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        docId: id
      },
      { status: 500 }
    )
  }
}
