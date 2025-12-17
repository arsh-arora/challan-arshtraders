'use client'

import { useState, useEffect } from 'react'
import { getTicketDetails, type TicketDetails } from '@/app/tickets/actions'

interface TicketDetailModalProps {
  ticketCode: string
  onClose: () => void
}

export default function TicketDetailModal({
  ticketCode,
  onClose,
}: TicketDetailModalProps) {
  const [details, setDetails] = useState<TicketDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDetails()
  }, [ticketCode])

  const loadDetails = async () => {
    setLoading(true)
    try {
      const data = await getTicketDetails(ticketCode)
      setDetails(data)
    } catch (error) {
      console.error('Failed to load ticket details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLocationBadgeColor = (kind: string) => {
    switch (kind) {
      case 'warehouse':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'company':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'hospital':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'partner':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusBadge = (status: 'active' | 'returned') => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Active (Outstanding)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Closed
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Ticket Details
              </h2>
              <p className="text-lg text-blue-600 font-mono mt-1">{ticketCode}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading details...</p>
          ) : !details ? (
            <p className="text-center text-gray-500 py-8">
              Ticket not found
            </p>
          ) : (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Material Code</p>
                    <p className="font-semibold text-gray-900">
                      {details.material_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Delivery Number</p>
                    <p className="font-semibold text-gray-900">
                      {details.delivery_number}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-gray-900">
                      {details.material_description || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Current Status
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        details.status === 'active'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-green-500'
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {details.current_location || 'Unknown'}
                      </p>
                      {details.current_location_kind && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getLocationBadgeColor(
                            details.current_location_kind
                          )}`}
                        >
                          {details.current_location_kind}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(details.status)}
                    <p className="text-sm text-gray-500 mt-1">
                      Qty: {details.qty_at_location}
                    </p>
                  </div>
                </div>
              </div>

              {/* Movement History */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Movement History
                </h3>
                <div className="space-y-3">
                  {details.movements.map((movement, idx) => (
                    <div
                      key={movement.id}
                      className="relative pl-6 pb-3 border-l-2 border-gray-200 last:border-transparent"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[-5px] top-0 w-2 h-2 rounded-full ${
                          idx === details.movements.length - 1
                            ? 'bg-blue-500'
                            : 'bg-gray-400'
                        }`}
                      />

                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {movement.doc_no}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(movement.doc_date).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium border ${getLocationBadgeColor(
                              movement.from_location_kind
                            )}`}
                          >
                            {movement.from_location}
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium border ${getLocationBadgeColor(
                              movement.to_location_kind
                            )}`}
                          >
                            {movement.to_location}
                          </span>
                          <span className="ml-auto text-gray-600">
                            Qty: {movement.qty}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
