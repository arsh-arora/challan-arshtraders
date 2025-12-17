'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDocument, getLocations, createLocation, updateLocation, type DocumentHeader, type DocumentLine } from '../actions'
import AddLinesModal from '@/components/AddLinesModal'

interface Location {
  id: string
  name: string
  kind: string
  gstin: string | null
  address: string | null
  contact: string | null
}

interface LineItem extends DocumentLine {
  material_code?: string
  material_description?: string
  delivery_number?: string
}

export default function NewDocumentPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Source location state
  const [sourceMode, setSourceMode] = useState<'select' | 'manual'>('select')
  const [manualSourceName, setManualSourceName] = useState('')
  const [manualSourceKind, setManualSourceKind] = useState<'hospital' | 'partner' | 'company'>('hospital')

  // Destination location state
  const [destMode, setDestMode] = useState<'select' | 'manual'>('select')
  const [manualDestName, setManualDestName] = useState('')
  const [manualDestKind, setManualDestKind] = useState<'hospital' | 'partner' | 'company'>('hospital')
  const [manualDestGstin, setManualDestGstin] = useState('')
  const [manualDestAddress, setManualDestAddress] = useState('')
  const [manualDestContact, setManualDestContact] = useState('')

  // Editing existing location details
  const [editingLocationDetails, setEditingLocationDetails] = useState(false)
  const [editGstin, setEditGstin] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editContact, setEditContact] = useState('')

  const [header, setHeader] = useState<DocumentHeader>({
    doc_no: `DOC-${Date.now()}`,
    doc_date: new Date().toISOString().split('T')[0],
    source_location_id: '',
    dest_location_id: '',
    counterparty_name: '',
    notes: '',
  })

  const [lines, setLines] = useState<LineItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    const data = await getLocations()
    setLocations(data)
    // Auto-select Arsh Traders as source if available
    const arshTraders = data.find(loc => loc.name === 'Arsh Traders')
    if (arshTraders) {
      setHeader(prev => ({ ...prev, source_location_id: arshTraders.id }))
    }
  }

  // Get the predicted document type based on destination
  const getPredictedDocType = (): { type: string; color: string; label: string } | null => {
    let destKind: string | null = null

    if (destMode === 'manual') {
      destKind = manualDestKind
    } else if (header.dest_location_id) {
      const destLoc = locations.find(l => l.id === header.dest_location_id)
      destKind = destLoc?.kind || null
    }

    if (!destKind) return null

    switch (destKind) {
      case 'warehouse':
        return { type: 'in', color: 'bg-green-100 text-green-800 border-green-200', label: 'Inbound' }
      case 'company':
        return { type: 'return', color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Return' }
      default:
        return { type: 'out', color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Outbound' }
    }
  }

  const predictedDocType = getPredictedDocType()

  const handleAddLines = (newLines: LineItem[]) => {
    setLines([...lines, ...newLines])
    setShowModal(false)
  }

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let sourceId = header.source_location_id
    let destId = header.dest_location_id

    // Handle manual source location
    if (sourceMode === 'manual') {
      if (!manualSourceName.trim()) {
        setError('Please enter a source location name')
        return
      }
      const result = await createLocation({
        name: manualSourceName.trim(),
        kind: manualSourceKind,
      })
      if (!result.success || !result.locationId) {
        setError(result.message || 'Failed to create source location')
        return
      }
      sourceId = result.locationId
    }

    // Handle manual destination location
    if (destMode === 'manual') {
      if (!manualDestName.trim()) {
        setError('Please enter a destination location name')
        return
      }
      const result = await createLocation({
        name: manualDestName.trim(),
        kind: manualDestKind,
        gstin: manualDestGstin.trim() || undefined,
        address: manualDestAddress.trim() || undefined,
        contact: manualDestContact.trim() || undefined,
      })
      if (!result.success || !result.locationId) {
        setError(result.message || 'Failed to create destination location')
        return
      }
      destId = result.locationId
    } else if (destMode === 'select' && editingLocationDetails && header.dest_location_id) {
      // Update existing location with new details
      await updateLocation(header.dest_location_id, {
        gstin: editGstin.trim() || undefined,
        address: editAddress.trim() || undefined,
        contact: editContact.trim() || undefined,
      })
    }

    if (!sourceId || !destId) {
      setError('Please select or enter source and destination locations')
      return
    }

    if (lines.length === 0) {
      setError('Please add at least one line item')
      return
    }

    setLoading(true)

    try {
      const result = await createDocument(
        { ...header, source_location_id: sourceId, dest_location_id: destId },
        lines
      )

      if (result.success && result.docId) {
        router.push(`/document/${result.docId}`)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Document</h1>

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Header</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doc No */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document No *
              </label>
              <input
                type="text"
                value={header.doc_no}
                onChange={(e) => setHeader({ ...header, doc_no: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Doc Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Date *
              </label>
              <input
                type="date"
                value={header.doc_date}
                onChange={(e) => setHeader({ ...header, doc_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Source Location */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Location *
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setSourceMode('select')}
                  className={`px-3 py-1 text-sm rounded-md ${sourceMode === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Select Existing
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('manual')}
                  className={`px-3 py-1 text-sm rounded-md ${sourceMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Enter New
                </button>
              </div>
              {sourceMode === 'select' ? (
                <select
                  value={header.source_location_id}
                  onChange={(e) => setHeader({ ...header, source_location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} [{loc.kind}]
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSourceName}
                    onChange={(e) => setManualSourceName(e.target.value)}
                    placeholder="Enter location name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={manualSourceKind}
                    onChange={(e) => setManualSourceKind(e.target.value as 'hospital' | 'partner' | 'company')}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="hospital">Hospital</option>
                    <option value="partner">Partner</option>
                    <option value="company">Company (Terminal)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Dest Location */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Location *
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setDestMode('select')}
                  className={`px-3 py-1 text-sm rounded-md ${destMode === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Select Existing
                </button>
                <button
                  type="button"
                  onClick={() => setDestMode('manual')}
                  className={`px-3 py-1 text-sm rounded-md ${destMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Enter New
                </button>
              </div>
              {destMode === 'select' ? (
                <>
                  <select
                    value={header.dest_location_id}
                    onChange={(e) => {
                      setHeader({ ...header, dest_location_id: e.target.value })
                      const loc = locations.find(l => l.id === e.target.value)
                      if (loc) {
                        setEditGstin(loc.gstin || '')
                        setEditAddress(loc.address || '')
                        setEditContact(loc.contact || '')
                      }
                      setEditingLocationDetails(false)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select destination...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} [{loc.kind}]
                      </option>
                    ))}
                  </select>
                  {/* Show/edit location details for selected location */}
                  {header.dest_location_id && (() => {
                    const selectedLoc = locations.find(l => l.id === header.dest_location_id)
                    if (!selectedLoc || selectedLoc.kind === 'warehouse') return null
                    return (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Location Details</span>
                          {!editingLocationDetails && (
                            <button
                              type="button"
                              onClick={() => setEditingLocationDetails(true)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Edit Details
                            </button>
                          )}
                        </div>
                        {editingLocationDetails ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editGstin}
                              onChange={(e) => setEditGstin(e.target.value)}
                              placeholder="GSTIN"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                            />
                            <textarea
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              placeholder="Address"
                              rows={2}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                            />
                            <input
                              type="text"
                              value={editContact}
                              onChange={(e) => setEditContact(e.target.value)}
                              placeholder="Contact Number"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 space-y-1">
                            {selectedLoc.gstin && <p><span className="font-medium">GSTIN:</span> {selectedLoc.gstin}</p>}
                            {selectedLoc.address && <p><span className="font-medium">Address:</span> {selectedLoc.address}</p>}
                            {selectedLoc.contact && <p><span className="font-medium">Contact:</span> {selectedLoc.contact}</p>}
                            {!selectedLoc.gstin && !selectedLoc.address && !selectedLoc.contact && (
                              <p className="text-gray-400 italic">No details saved. Click "Edit Details" to add.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualDestName}
                      onChange={(e) => setManualDestName(e.target.value)}
                      placeholder="Enter location name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={manualDestKind}
                      onChange={(e) => setManualDestKind(e.target.value as 'hospital' | 'partner' | 'company')}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="hospital">Hospital</option>
                      <option value="partner">Partner</option>
                      <option value="company">Company (Terminal)</option>
                    </select>
                  </div>
                  {/* Additional details for new location */}
                  {manualDestKind !== 'company' && (
                    <div className="p-3 bg-gray-50 rounded-md space-y-2">
                      <p className="text-sm font-medium text-gray-700">Location Details (optional)</p>
                      <input
                        type="text"
                        value={manualDestGstin}
                        onChange={(e) => setManualDestGstin(e.target.value)}
                        placeholder="GSTIN"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                      />
                      <textarea
                        value={manualDestAddress}
                        onChange={(e) => setManualDestAddress(e.target.value)}
                        placeholder="Address"
                        rows={2}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        value={manualDestContact}
                        onChange={(e) => setManualDestContact(e.target.value)}
                        placeholder="Contact Number"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}
              {destMode === 'manual' && manualDestKind === 'company' && (
                <p className="mt-1 text-sm text-amber-600">
                  Items sent to a Company are terminal - they will no longer be outstanding.
                </p>
              )}
              {/* Show predicted document type based on destination */}
              {predictedDocType && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Document type:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${predictedDocType.color}`}>
                    {predictedDocType.label}
                  </span>
                  {predictedDocType.type === 'return' && (
                    <span className="text-xs text-gray-500">(Items marked as returned)</span>
                  )}
                </div>
              )}
            </div>

            {/* Counterparty Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Counterparty Name
              </label>
              <input
                type="text"
                value={header.counterparty_name}
                onChange={(e) => setHeader({ ...header, counterparty_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={header.notes}
                onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Lines Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Document Lines</h2>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={!header.source_location_id}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Lines
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No lines added yet. Click "Add Lines" to select items.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Delivery No
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Material Code
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ticket
                    </th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-4 text-sm text-gray-900">{line.delivery_number}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{line.material_code}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{line.material_description}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{line.qty}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{line.ticket_code || '-'}</td>
                      <td className="px-3 py-4 text-sm text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || lines.length === 0}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Document'}
          </button>
        </div>
      </form>

      {/* Add Lines Modal */}
      {showModal && (
        <AddLinesModal
          sourceLocationId={header.source_location_id}
          destinationInfo={
            destMode === 'select' && header.dest_location_id
              ? locations.find((l) => l.id === header.dest_location_id) || null
              : destMode === 'manual' && manualDestName
              ? { id: '', name: manualDestName, kind: manualDestKind }
              : null
          }
          onClose={() => setShowModal(false)}
          onAddLines={handleAddLines}
        />
      )}
    </div>
  )
}
