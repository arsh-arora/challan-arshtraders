'use client'

import { useState } from 'react'
import ExcelJS from 'exceljs'
import { importChallan } from './actions'
import { ColumnMapping } from '@/types/database'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [supplierName, setSupplierName] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping>({
    deliveryNumber: 'Delivery Number',
    deliveryDate: 'Delivery Date',
    itemNumber: 'Item Number',
    materialCode: 'Material Code',
    materialDescription: 'Material Description',
    hsnCode: 'HSN Code',
    qty: 'QTY',
    unitCost: 'Unit Cost',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)

      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        alert('No worksheet found in file')
        return
      }

      // Get headers from first row
      const headerRow = worksheet.getRow(1)
      const headers: string[] = []
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `Column${colNumber}`)
      })

      // Convert rows to JSON objects
      const jsonData: Record<string, unknown>[] = []
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return // Skip header row

        const rowData: Record<string, unknown> = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1]
          if (header) {
            // Handle cell values - ExcelJS returns rich objects for some types
            let value = cell.value
            if (value && typeof value === 'object' && 'result' in value) {
              value = value.result // Formula result
            }
            rowData[header] = value
          }
        })

        // Only add rows that have some data
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData)
        }
      })

      if (jsonData.length > 0) {
        const validHeaders = headers.filter(Boolean)
        setColumns(validHeaders)
        setRows(jsonData)

        // Auto-detect supplier name from Customer Name if available
        const firstRow = jsonData[0]
        if (firstRow['Customer Name']) {
          setSupplierName(String(firstRow['Customer Name']))
        }

        // Auto-match column mappings based on common variations
        const findColumn = (patterns: string[]): string => {
          const lowerHeaders = validHeaders.map((h) => h.toLowerCase())
          for (const pattern of patterns) {
            const idx = lowerHeaders.findIndex(
              (h) => h.includes(pattern.toLowerCase())
            )
            if (idx !== -1) return validHeaders[idx]
          }
          return validHeaders[0] // fallback to first column
        }

        setMapping({
          deliveryNumber: findColumn(['delivery number', 'delivery no', 'dn', 'challan']),
          deliveryDate: findColumn(['delivery date', 'date', 'challan date']),
          itemNumber: findColumn(['item number', 'item no', 'sr', 'sno', 'line']),
          materialCode: findColumn(['material code', 'material', 'code', 'sku', 'part']),
          materialDescription: findColumn(['description', 'desc', 'material desc', 'name']),
          hsnCode: findColumn(['hsn', 'hsn code', 'sac']),
          qty: findColumn(['qty', 'quantity', 'units', 'pcs']),
          unitCost: findColumn(['unit cost', 'cost', 'rate', 'price', 'unit price']),
        })
      }
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Failed to read file')
    }
  }

  const handleImport = async () => {
    if (!supplierName.trim()) {
      alert('Please enter supplier name')
      return
    }

    if (rows.length === 0) {
      alert('No data to import')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // Convert rows to plain objects to avoid serialization issues
      const plainRows = JSON.parse(JSON.stringify(rows))
      const response = await importChallan(supplierName, plainRows, mapping)
      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Challan</h1>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Excel File
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {file.name} ({rows.length} rows)
          </p>
        )}
      </div>

      {/* Column Mapping */}
      {columns.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Column Mapping</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier name"
                />
              </div>

              {/* Delivery Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Number
                </label>
                <select
                  value={mapping.deliveryNumber}
                  onChange={(e) => setMapping({ ...mapping, deliveryNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <select
                  value={mapping.deliveryDate}
                  onChange={(e) => setMapping({ ...mapping, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Item Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Number
                </label>
                <select
                  value={mapping.itemNumber}
                  onChange={(e) => setMapping({ ...mapping, itemNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Material Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Code *
                </label>
                <select
                  value={mapping.materialCode}
                  onChange={(e) => setMapping({ ...mapping, materialCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Material Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Description
                </label>
                <select
                  value={mapping.materialDescription}
                  onChange={(e) => setMapping({ ...mapping, materialDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HSN Code
                </label>
                <select
                  value={mapping.hsnCode}
                  onChange={(e) => setMapping({ ...mapping, hsnCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <select
                  value={mapping.qty}
                  onChange={(e) => setMapping({ ...mapping, qty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Unit Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost
                </label>
                <select
                  value={mapping.unitCost}
                  onChange={(e) => setMapping({ ...mapping, unitCost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Preview (First 3 rows)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material Code</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">QTY</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-4 text-sm text-gray-900">{String(row[mapping.materialCode] ?? '')}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{String(row[mapping.materialDescription] ?? '')}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{String(row[mapping.qty] ?? '')}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{String(row[mapping.unitCost] ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Button */}
          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Import Challan'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              <p className="font-medium">{result.message}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
