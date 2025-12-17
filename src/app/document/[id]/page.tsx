import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DownloadButtons from '@/components/DownloadButtons'

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseAdmin()

  // Fetch document with location details
  const { data: doc, error } = await supabase
    .from('docs')
    .select(
      `
      *,
      source:locations!docs_source_location_id_fkey(id, name, kind),
      destination:locations!docs_dest_location_id_fkey(id, name, kind)
    `
    )
    .eq('id', id)
    .single()

  if (error || !doc) {
    notFound()
  }

  // Fetch document lines
  const { data: lines } = await supabase
    .from('doc_lines')
    .select('*')
    .eq('doc_id', id)
    .order('material_code')

  const typeSuffix = doc.doc_type === 'in' ? 'Inbound' : doc.doc_type === 'out' ? 'Outbound' : 'Return'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document {doc.doc_no}</h1>
          <p className="text-gray-500 mt-1">Type: {typeSuffix}</p>
        </div>
        <DownloadButtons docId={id} docNo={doc.doc_no} />
      </div>

      {/* Document Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Document No:</span>
            <p className="text-gray-900">{doc.doc_no}</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Document Type:</span>
            <p className="text-gray-900 capitalize">{typeSuffix}</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Document Date:</span>
            <p className="text-gray-900">{doc.doc_date}</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Source Location:</span>
            <p className="text-gray-900">
              {(doc.source as any).name} <span className="text-gray-500 text-sm">({(doc.source as any).kind})</span>
            </p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Destination Location:</span>
            <p className="text-gray-900">
              {(doc.destination as any).name} <span className="text-gray-500 text-sm">({(doc.destination as any).kind})</span>
            </p>
          </div>

          {doc.counterparty_name && (
            <div>
              <span className="text-sm font-medium text-gray-500">Counterparty:</span>
              <p className="text-gray-900">{doc.counterparty_name}</p>
            </div>
          )}

          {doc.notes && (
            <div className="md:col-span-2">
              <span className="text-sm font-medium text-gray-500">Notes:</span>
              <p className="text-gray-900">{doc.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Document Lines */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Line Items</h2>
        </div>

        {!lines || lines.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No line items</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Material Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {line.company_delivery_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {line.material_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {line.material_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {line.qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {line.ticket_code || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
