'use client'

import { useState, useEffect } from 'react'
import { getOutstanding, type OutstandingItem } from './actions'
import Papa from 'papaparse'

export default function OutstandingPage() {
  const [outstanding, setOutstanding] = useState<OutstandingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter)
    }, 300)

    return () => clearTimeout(timer)
  }, [filter])

  useEffect(() => {
    loadOutstanding()
  }, [debouncedFilter])

  const loadOutstanding = async () => {
    setLoading(true)
    try {
      const data = await getOutstanding(debouncedFilter || undefined)
      setOutstanding(data)
    } catch (error) {
      console.error('Failed to load outstanding:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    const csvData = outstanding.map((item) => ({
      'Delivery Number': item.delivery_number,
      'Supplier Name': item.supplier_name,
      'Material Code': item.material_code,
      Description: item.description || '',
      'Initial Qty': item.initial_qty,
      'Returned Qty': item.returned_qty,
      'Outstanding Qty': item.outstanding_qty,
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `outstanding_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalOutstanding = outstanding.reduce((sum, item) => sum + item.outstanding_qty, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Outstanding to Company</h1>
          <p className="text-gray-500 mt-1">Items not yet returned to suppliers</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={outstanding.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <input
          type="text"
          placeholder="Filter by delivery number..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Summary Card */}
      {!loading && outstanding.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-800 font-medium">Total Outstanding Items</p>
              <p className="text-2xl font-bold text-yellow-900">{totalOutstanding}</p>
            </div>
            <div className="text-sm text-yellow-700">
              {outstanding.length} line item(s)
            </div>
          </div>
        </div>
      )}

      {/* Outstanding Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading outstanding items...</p>
        ) : outstanding.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No outstanding items found
            {filter && ' for this search'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Material Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Initial Qty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Returned Qty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding Qty
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {outstanding.map((item) => (
                  <tr key={item.challan_line_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.delivery_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.material_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.initial_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.returned_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {item.outstanding_qty}
                      </span>
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
