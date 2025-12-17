'use client'

import { useState, useEffect } from 'react'
import { getTickets, type TicketInfo } from './actions'
import TicketDetailModal from '@/components/TicketDetailModal'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    loadTickets()
  }, [debouncedSearch, showActiveOnly])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const data = await getTickets(debouncedSearch || undefined, showActiveOnly)
      setTickets(data)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLocationBadgeColor = (kind: string | null) => {
    switch (kind) {
      case 'warehouse':
        return 'bg-green-100 text-green-800'
      case 'company':
        return 'bg-gray-100 text-gray-800'
      case 'hospital':
        return 'bg-blue-100 text-blue-800'
      case 'partner':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadge = (status: 'active' | 'returned') => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Outstanding
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Closed
      </span>
    )
  }

  const activeCount = tickets.filter((t) => t.status === 'active').length
  const returnedCount = tickets.filter((t) => t.status === 'returned').length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
        <p className="text-gray-500 mt-1">
          Track items from checkout to return. Tickets are auto-generated when items leave the warehouse.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by ticket code, material code, or delivery number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show active only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Tickets</p>
            <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-700">Outstanding (Active)</p>
            <p className="text-2xl font-bold text-amber-900">{activeCount}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">Closed</p>
            <p className="text-2xl font-bold text-green-900">{returnedCount}</p>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm
                ? 'No tickets found for this search'
                : showActiveOnly
                ? 'No active tickets found'
                : 'No tickets found'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Tickets are automatically created when items leave the warehouse to a partner or hospital
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Material Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Location
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.ticket_code}
                    onClick={() => setSelectedTicket(ticket.ticket_code)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {ticket.ticket_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.material_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {ticket.material_description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {ticket.current_location ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLocationBadgeColor(
                            ticket.current_location_kind
                          )}`}
                        >
                          {ticket.current_location}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {ticket.qty_at_location > 0 ? (
                        <span className="font-semibold">{ticket.qty_at_location}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.created_date
                        ? new Date(ticket.created_date).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">About Tickets</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Tickets are automatically generated when items leave the warehouse to a partner or hospital</li>
          <li>Each ticket tracks an item from checkout until it returns to warehouse or company</li>
          <li><strong>Outstanding (Active)</strong>: Item is currently with a partner or hospital</li>
          <li><strong>Closed</strong>: Item has been returned to warehouse or company</li>
          <li>If items move between partners/hospitals, the same ticket is carried forward</li>
          <li>Click on any ticket to view its movement history and current location</li>
        </ul>
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticketCode={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  )
}
