import Link from 'next/link'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type DocType = 'in' | 'out' | 'return'

interface LocationSummary {
  name: string
  kind: string
}

interface DocumentLineSummary {
  qty: number | string | null
}

interface DocumentSummary {
  id: string
  doc_no: string
  doc_type: DocType
  doc_date: string
  counterparty_name: string | null
  created_at: string
  source: LocationSummary | null
  destination: LocationSummary | null
  doc_lines: DocumentLineSummary[] | null
}

interface RawDocumentSummary extends Omit<DocumentSummary, 'source' | 'destination'> {
  source: LocationSummary | LocationSummary[] | null
  destination: LocationSummary | LocationSummary[] | null
}

const DOC_TYPE_META: Record<DocType, { label: string; className: string }> = {
  in: {
    label: 'Inbound',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  out: {
    label: 'Outbound',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  return: {
    label: 'Return',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatQty(value: number) {
  return value.toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  })
}

function getLineStats(lines: DocumentLineSummary[] | null) {
  const docLines = lines || []
  const totalQty = docLines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0)

  return {
    lineCount: docLines.length,
    totalQty,
  }
}

function firstRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) return value[0] || null
  return value
}

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseAdmin()

  const { data, error } = await supabase
    .from('docs')
    .select(
      `
      id,
      doc_no,
      doc_type,
      doc_date,
      counterparty_name,
      created_at,
      source:locations!docs_source_location_id_fkey(name, kind),
      destination:locations!docs_dest_location_id_fkey(name, kind),
      doc_lines(qty)
    `
    )
    .order('doc_date', { ascending: false })
    .order('created_at', { ascending: false })

  const documents = ((data || []) as unknown as RawDocumentSummary[]).map((doc) => ({
    ...doc,
    source: firstRelation(doc.source),
    destination: firstRelation(doc.destination),
  }))
  const totals = documents.reduce(
    (summary, doc) => {
      const stats = getLineStats(doc.doc_lines)
      return {
        lines: summary.lines + stats.lineCount,
        qty: summary.qty + stats.totalQty,
      }
    },
    { lines: 0, qty: 0 }
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">Previous delivery challans and movement documents</p>
        </div>
        <Link
          href="/document/new"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          Create Document
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Total Documents</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{documents.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Total Line Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totals.lines}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Total Quantity Moved</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatQty(totals.qty)}</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-800 rounded-lg p-4">
          Failed to load documents: {error.message}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900">No documents created yet</h2>
          <p className="text-gray-500 mt-2">Created delivery challans will appear here.</p>
          <Link
            href="/document/new"
            className="inline-flex mt-5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Create First Document
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Movement
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lines
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => {
                  const typeMeta = DOC_TYPE_META[doc.doc_type]
                  const stats = getLineStats(doc.doc_lines)

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Link href={`/document/${doc.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                          {doc.doc_no}
                        </Link>
                        {doc.counterparty_name && (
                          <p className="text-xs text-gray-500 mt-1">{doc.counterparty_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeMeta.className}`}>
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(doc.doc_date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div>
                          <span className="text-gray-500">From:</span>{' '}
                          {doc.source?.name || '-'}
                          {doc.source?.kind && <span className="text-gray-400"> ({doc.source.kind})</span>}
                        </div>
                        <div className="mt-1">
                          <span className="text-gray-500">To:</span>{' '}
                          {doc.destination?.name || '-'}
                          {doc.destination?.kind && <span className="text-gray-400"> ({doc.destination.kind})</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {stats.lineCount}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatQty(stats.totalQty)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(doc.created_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/document/${doc.id}`} className="text-blue-700 hover:text-blue-900">
                            Open
                          </Link>
                          <a href={`/api/document/${doc.id}/pdf`} className="text-gray-700 hover:text-gray-900">
                            PDF
                          </a>
                          <a href={`/api/document/${doc.id}/xls`} className="text-emerald-700 hover:text-emerald-900">
                            XLS
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
