'use client'

import { useState } from 'react'

interface DownloadButtonsProps {
  docId: string
  docNo: string
}

export default function DownloadButtons({ docId, docNo }: DownloadButtonsProps) {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingXls, setLoadingXls] = useState(false)

  const handleDownloadPdf = async () => {
    setLoadingPdf(true)
    try {
      const response = await fetch(`/api/document/${docId}/pdf`)

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${docNo}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download PDF')
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleDownloadXls = async () => {
    setLoadingXls(true)
    try {
      const response = await fetch(`/api/document/${docId}/xls`)

      if (!response.ok) {
        throw new Error('Failed to generate Excel file')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${docNo}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download Excel file')
    } finally {
      setLoadingXls(false)
    }
  }

  return (
    <div className="flex gap-2">
      {/* Download XLS Button */}
      <button
        onClick={handleDownloadXls}
        disabled={loadingXls}
        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {loadingXls ? 'Generating...' : 'Download Challan (XLS)'}
      </button>

      {/* Download PDF Button */}
      <button
        onClick={handleDownloadPdf}
        disabled={loadingPdf}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        {loadingPdf ? 'Generating...' : 'Download PDF'}
      </button>
    </div>
  )
}
