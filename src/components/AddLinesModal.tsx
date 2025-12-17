'use client'

import { useState, useEffect } from 'react'
import { getAvailableItems } from '@/app/document/actions'
import { AvailableItem } from '@/lib/availability'

interface DestinationInfo {
  id: string
  name: string
  kind: string
}

interface AddLinesModalProps {
  sourceLocationId: string
  destinationInfo?: DestinationInfo | null
  onClose: () => void
  onAddLines: (lines: any[]) => void
}

interface SelectedLine {
  challan_line_id: string
  qty: number
  ticket_code?: string
  material_code: string
  material_description: string | null
  delivery_number: string
  available_qty: number
}

export default function AddLinesModal({
  sourceLocationId,
  destinationInfo,
  onClose,
  onAddLines,
}: AddLinesModalProps) {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([])
  const [filter, setFilter] = useState('')

  // Check if this is a return to company - if so, filter by supplier
  const isReturnToCompany = destinationInfo?.kind === 'company'
  // Location names have "Company:" prefix, but supplier_name in DB doesn't
  // e.g., location "Company:Karl Storz" → supplier_name "Karl Storz"
  const returnToSupplierName = isReturnToCompany
    ? destinationInfo?.name?.replace(/^Company:/i, '') || null
    : null

  useEffect(() => {
    loadAvailableItems()
  }, [sourceLocationId])

  const loadAvailableItems = async () => {
    setLoading(true)
    try {
      const items = await getAvailableItems(sourceLocationId)
      setAvailableItems(items)
    } catch (error) {
      console.error('Failed to load available items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQtyChange = (item: AvailableItem, qty: number) => {
    const existing = selectedLines.find((l) => l.challan_line_id === item.challan_line_id)

    if (qty <= 0) {
      // Remove line
      setSelectedLines(selectedLines.filter((l) => l.challan_line_id !== item.challan_line_id))
    } else if (qty > item.available_qty) {
      // Don't allow exceeding available
      alert(`Maximum available: ${item.available_qty}`)
    } else if (existing) {
      // Update existing
      setSelectedLines(
        selectedLines.map((l) =>
          l.challan_line_id === item.challan_line_id ? { ...l, qty } : l
        )
      )
    } else {
      // Add new
      setSelectedLines([
        ...selectedLines,
        {
          challan_line_id: item.challan_line_id,
          qty,
          material_code: item.material_code,
          material_description: item.material_description,
          delivery_number: item.delivery_number,
          available_qty: item.available_qty,
        },
      ])
    }
  }

  const handleTicketChange = (challanLineId: string, ticketCode: string) => {
    setSelectedLines(
      selectedLines.map((l) =>
        l.challan_line_id === challanLineId ? { ...l, ticket_code: ticketCode } : l
      )
    )
  }

  const handleSelectAllForDelivery = (deliveryNumber: string) => {
    const itemsInDelivery = groupedItems[deliveryNumber] || []

    // Add all items from this delivery with their available qty
    const newSelections = itemsInDelivery.map(item => ({
      challan_line_id: item.challan_line_id,
      qty: item.available_qty,
      material_code: item.material_code,
      material_description: item.material_description,
      delivery_number: item.delivery_number,
      available_qty: item.available_qty,
    }))

    // Remove any existing selections from this delivery first, then add new ones
    const otherSelections = selectedLines.filter(
      line => line.delivery_number !== deliveryNumber
    )
    setSelectedLines([...otherSelections, ...newSelections])
  }

  const handleAdd = () => {
    if (selectedLines.length === 0) {
      alert('Please select at least one item')
      return
    }
    onAddLines(selectedLines)
  }

  // Filter by search term and supplier (when returning to company)
  const filteredItems = availableItems.filter((item) => {
    // If returning to a company, only show items from that supplier
    if (returnToSupplierName && item.supplier_name !== returnToSupplierName) {
      return false
    }

    // Text search filter
    const searchMatch =
      !filter ||
      item.material_code.toLowerCase().includes(filter.toLowerCase()) ||
      item.material_description?.toLowerCase().includes(filter.toLowerCase()) ||
      item.delivery_number.toLowerCase().includes(filter.toLowerCase())

    return searchMatch
  })

  // Group by delivery number
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.delivery_number]) {
      acc[item.delivery_number] = []
    }
    acc[item.delivery_number].push(item)
    return acc
  }, {} as Record<string, AvailableItem[]>)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Add Lines</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Supplier filter notice for returns */}
          {isReturnToCompany && returnToSupplierName && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <p className="text-sm text-purple-800">
                <span className="font-medium">Returning to {returnToSupplierName}:</span>{' '}
                Only items originally received from this supplier are shown.
              </p>
            </div>
          )}

          {/* Filter */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Filter by material code, description, or delivery number..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading available items...</p>
          ) : availableItems.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No items available at this location
            </p>
          ) : filteredItems.length === 0 && isReturnToCompany ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">
                No items available from <span className="font-medium">{returnToSupplierName}</span>
              </p>
              <p className="text-sm text-gray-400">
                Items can only be returned to their original supplier.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([deliveryNumber, items]) => (
                <div key={deliveryNumber} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">
                      Delivery: {deliveryNumber}
                      <span className="ml-2 text-sm text-gray-500">
                        ({items[0].delivery_date || 'N/A'})
                      </span>
                    </h3>
                    <button
                      onClick={() => handleSelectAllForDelivery(deliveryNumber)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    >
                      Select All
                    </button>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {items.map((item) => {
                      const selected = selectedLines.find(
                        (l) => l.challan_line_id === item.challan_line_id
                      )

                      return (
                        <div
                          key={item.challan_line_id}
                          className={`p-4 transition-all duration-200 ${
                            selected
                              ? 'bg-green-50 border-l-4 border-l-green-500'
                              : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-3">
                              <div className="flex items-center gap-2">
                                {selected && (
                                  <span className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                )}
                                <div className="font-medium text-gray-900">{item.material_code}</div>
                              </div>
                              {item.hsn_code && (
                                <div className={`text-xs text-gray-500 ${selected ? 'ml-7' : ''}`}>HSN: {item.hsn_code}</div>
                              )}
                            </div>

                            <div className="col-span-4">
                              <div className="text-sm text-gray-700">
                                {item.material_description || '-'}
                              </div>
                            </div>

                            <div className="col-span-2 text-center">
                              <div className="text-sm text-gray-500">Available</div>
                              <div className="font-semibold text-gray-900">
                                {item.available_qty}
                              </div>
                            </div>

                            <div className="col-span-1">
                              <input
                                type="number"
                                min="0"
                                max={item.available_qty}
                                step="1"
                                value={selected?.qty || ''}
                                onChange={(e) =>
                                  handleQtyChange(item, Number(e.target.value))
                                }
                                placeholder="Qty"
                                className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                                  selected
                                    ? 'border-green-500 bg-green-100 ring-2 ring-green-200 font-semibold text-green-800'
                                    : 'border-gray-300 focus:ring-blue-500'
                                }`}
                              />
                            </div>

                            <div className="col-span-2">
                              <input
                                type="text"
                                value={selected?.ticket_code || ''}
                                onChange={(e) =>
                                  handleTicketChange(item.challan_line_id, e.target.value)
                                }
                                placeholder="Ticket (opt)"
                                disabled={!selected}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedLines.length > 0 ? (
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {selectedLines.length} item(s)
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="font-medium text-green-700">
                    Total qty: {selectedLines.reduce((sum, l) => sum + l.qty, 0)}
                  </span>
                </span>
              ) : (
                'No items selected'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={selectedLines.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Selected Lines
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
