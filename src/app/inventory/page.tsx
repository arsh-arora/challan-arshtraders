'use client'

import { useState, useEffect, useMemo } from 'react'
import { getInventory, type InventoryItem } from './actions'

type SortField = 'delivery_number' | 'supplier_name' | 'material_code' | 'qty_received' | 'outstanding'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'all' | 'warehouse' | 'out' | 'returned' | 'outstanding'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('delivery_number')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    loadInventory()
  }, [debouncedSearch])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const data = await getInventory(debouncedSearch || undefined)
      setInventory(data)
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique suppliers for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const suppliers = [...new Set(inventory.map(i => i.supplier_name))].sort()
    return suppliers
  }, [inventory])

  // Filter and sort inventory
  const filteredAndSortedInventory = useMemo(() => {
    let result = [...inventory]

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(item => {
        switch (statusFilter) {
          case 'warehouse':
            return item.qty_at_warehouse > 0
          case 'out':
            return item.qty_out > 0
          case 'returned':
            return item.qty_returned > 0
          case 'outstanding':
            return item.outstanding > 0
          default:
            return true
        }
      })
    }

    // Apply supplier filter
    if (supplierFilter !== 'all') {
      result = result.filter(item => item.supplier_name === supplierFilter)
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number = a[sortField]
      let bVal: string | number = b[sortField]

      // Handle null/undefined
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''

      // Compare
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return result
  }, [inventory, statusFilter, supplierFilter, sortField, sortDirection])

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-300">↕</span>
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Inventory</h1>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by delivery number, material code, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="warehouse">At Warehouse</option>
              <option value="out">Out</option>
              <option value="returned">Returned</option>
              <option value="outstanding">Outstanding</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Suppliers</option>
              {uniqueSuppliers.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(statusFilter !== 'all' || supplierFilter !== 'all' || searchTerm) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-blue-600">&times;</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-green-600">&times;</button>
              </span>
            )}
            {supplierFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Supplier: {supplierFilter}
                <button onClick={() => setSupplierFilter('all')} className="ml-1 hover:text-purple-600">&times;</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setSupplierFilter('all')
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && filteredAndSortedInventory.length > 0 && (() => {
        const data = filteredAndSortedInventory
        const totalReceived = data.reduce((sum, i) => sum + i.qty_received, 0)
        const totalAtWarehouse = data.reduce((sum, i) => sum + i.qty_at_warehouse, 0)
        const totalOut = data.reduce((sum, i) => sum + i.qty_out, 0)
        const totalReturned = data.reduce((sum, i) => sum + i.qty_returned, 0)
        const totalOutstanding = totalAtWarehouse + totalOut

        return (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Received</p>
              <p className="text-2xl font-bold text-gray-900">{totalReceived}</p>
              {filteredAndSortedInventory.length !== inventory.length && (
                <p className="text-xs text-gray-400">{filteredAndSortedInventory.length} items</p>
              )}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">At Warehouse</p>
              <p className="text-2xl font-bold text-green-900">{totalAtWarehouse}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">Out</p>
              <p className="text-2xl font-bold text-blue-900">{totalOut}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Returned</p>
              <p className="text-2xl font-bold text-gray-700">{totalReturned}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-700">Outstanding</p>
              <p className="text-2xl font-bold text-amber-900">{totalOutstanding}</p>
              <p className="text-xs text-amber-600 mt-1">Warehouse + Out</p>
            </div>
          </div>
        )
      })()}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading inventory...</p>
        ) : filteredAndSortedInventory.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {inventory.length === 0 ? 'No inventory items found' : 'No items match the current filters'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('delivery_number')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    Delivery No <SortIndicator field="delivery_number" />
                  </th>
                  <th
                    onClick={() => handleSort('supplier_name')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    Supplier <SortIndicator field="supplier_name" />
                  </th>
                  <th
                    onClick={() => handleSort('material_code')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    Material Code <SortIndicator field="material_code" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th
                    onClick={() => handleSort('qty_received')}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    Received <SortIndicator field="qty_received" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th
                    onClick={() => handleSort('outstanding')}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    Outstanding <SortIndicator field="outstanding" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedInventory.map((item) => (
                  <tr key={item.challan_line_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.delivery_number}
                      {item.delivery_date && (
                        <div className="text-xs text-gray-500">{item.delivery_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {item.supplier_name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.material_code}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {item.material_description || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.qty_received}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {item.qty_at_warehouse > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Warehouse: {item.qty_at_warehouse}
                          </span>
                        )}
                        {item.qty_out > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Out: {item.qty_out}
                          </span>
                        )}
                        {item.qty_returned > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Returned: {item.qty_returned}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      {item.outstanding > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {item.outstanding}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
