import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { numberToWords, formatIndianCurrency } from '@/lib/numberToWords'

// Arsh Traders brand colors
const BRAND_NAVY = '#1e3a5f'
const BRAND_LIGHT = '#f8fafc'

// Fixed Arsh Traders details - non-negotiable
const ARSH_TRADERS_ADDRESS = 'Plot No. 119-2A, Saket Nagar, Bhopal - 462024 (M.P.)'
const ARSH_TRADERS_GSTIN = '23AECPC0996H2ZR'
const ARSH_TRADERS_EMAIL = 'director@arshtraders.com'
const ARSH_TRADERS_WEBSITE = 'arshtraders.com'

// Logo path - use public URL for both dev and production
const ARSH_LOGO_PATH = 'https://challan.arshtraders.com/horizontal-logo.png'


const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 80,
    paddingHorizontal: 0,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  headerStripe: {
    height: 4,
    backgroundColor: BRAND_NAVY,
    marginBottom: 15,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  companySubtext: {
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 3,
    marginTop: 2,
  },
  // Content container
  content: {
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  // Title section
  titleSection: {
    textAlign: 'center',
    marginBottom: 15,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND_NAVY,
    marginBottom: 3,
  },
  docSubtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  // Details grid
  detailsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 20,
  },
  detailsColumn: {
    flex: 1,
  },
  detailsBox: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    borderLeft: `3px solid ${BRAND_NAVY}`,
  },
  detailsLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsValue: {
    fontSize: 10,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  detailsSubValue: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  // Challan info
  challanInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  challanInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challanLabel: {
    fontSize: 9,
    color: '#64748b',
    marginRight: 8,
  },
  challanValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: BRAND_NAVY,
    backgroundColor: BRAND_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  // Table
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_NAVY,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 24,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  // Column widths (without remarks - redistributed for clarity)
  colSr: { width: '5%' },
  colMaterial: { width: '18%', flexWrap: 'wrap' },
  colDesc: { width: '33%' },
  colHsn: { width: '12%' },
  colQty: { width: '8%', textAlign: 'right' },
  colRate: { width: '12%', textAlign: 'right' },
  colAmount: { width: '12%', textAlign: 'right' },
  // Totals
  totalsSection: {
    marginTop: 10,
    marginBottom: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: '#64748b',
    marginRight: 20,
    width: 120,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND_NAVY,
    width: 100,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    borderTop: `2px solid ${BRAND_NAVY}`,
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: BRAND_NAVY,
    marginRight: 20,
    width: 120,
    textAlign: 'right',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: BRAND_NAVY,
    width: 100,
    textAlign: 'right',
  },
  // Amount in words
  amountInWords: {
    backgroundColor: BRAND_LIGHT,
    padding: 10,
    borderRadius: 4,
    marginBottom: 20,
  },
  amountInWordsLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 3,
  },
  amountInWordsText: {
    fontSize: 10,
    color: '#1e293b',
    fontStyle: 'italic',
  },
  // Signature section
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderTop: '1px solid #94a3b8',
    marginBottom: 5,
    marginTop: 40,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_NAVY,
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  footerHighlight: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
})

interface ChallanLine {
  id: string
  material_code: string
  material_description: string
  qty: number
  ticket_code?: string
  company_delivery_no?: string
  hsn_code: string
  unit_cost: number
}

interface DocumentData {
  doc_no: string
  doc_date: string
  doc_type: 'in' | 'out' | 'return'
  source_location: {
    name: string
    kind: string
    gstin?: string
    address?: string
    contact?: string
  }
  dest_location: {
    name: string
    kind: string
    gstin?: string
    address?: string
    contact?: string
  }
  counterparty_name?: string
  notes?: string
}

interface DeliveryChallanPDFProps {
  doc: DocumentData
  lines: ChallanLine[]
}

export default function DeliveryChallanPDF({ doc, lines }: DeliveryChallanPDFProps) {
  // Safety helper: convert any value to a safe string/number for React-PDF
  const safeText = (value: unknown): string => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    // If it's an object, stringify it (should never happen with proper flattening)
    return JSON.stringify(value)
  }

  // Calculate totals
  let totalQty = 0
  let totalAmount = 0

  const lineData = lines.map((line, index) => {
    const qty = Number(line.qty) || 0
    const rate = Number(line.unit_cost) || 0
    const amount = qty * rate
    totalQty += qty
    totalAmount += amount

    return {
      ...line,
      sr: index + 1,
      hsn: String(line.hsn_code || ''),
      rate,
      amount,
    }
  })

  // Get unique KSI challan numbers
  const ksiChallanNos = [...new Set(lines.map(l => l.company_delivery_no).filter(Boolean))].join(', ')

  // Format dates
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Determine max rows per page to prevent overflow (roughly 15-18 rows for A4)
  const MAX_ROWS_PER_PAGE = 15

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Arsh Traders branding */}
        <View style={styles.header}>
          {/* Arsh Traders Horizontal Logo */}
          <Image
            src={ARSH_LOGO_PATH}
            style={{ width: 180, height: 50 }}
          />
        </View>
        <View style={styles.headerStripe} />

        <View style={styles.content}>
          {/* Document Title */}
          <View style={styles.titleSection}>
            <Text style={styles.docTitle}>DELIVERY CHALLAN</Text>
            <Text style={styles.docSubtitle}>Goods Movement - Returnable Basis</Text>
          </View>

          {/* Challan Info Row */}
          <View style={styles.challanInfoRow}>
            <View style={styles.challanInfoItem}>
              <Text style={styles.challanLabel}>Challan No:</Text>
              <Text style={styles.challanValue}>{safeText(doc.doc_no)}</Text>
            </View>
            <View style={styles.challanInfoItem}>
              <Text style={styles.challanLabel}>Date:</Text>
              <Text style={styles.challanValue}>{safeText(formatDate(doc.doc_date))}</Text>
            </View>
            {ksiChallanNos && (
              <View style={styles.challanInfoItem}>
                <Text style={styles.challanLabel}>Ref (KSI):</Text>
                <Text style={styles.challanValue}>{safeText(ksiChallanNos)}</Text>
              </View>
            )}
          </View>

          {/* Consignor / Consignee Details */}
          <View style={styles.detailsContainer}>
            {/* Consignor (Ship From) */}
            <View style={styles.detailsColumn}>
              <View style={styles.detailsBox}>
                <Text style={styles.detailsLabel}>Ship From (Consignor)</Text>
                <Text style={styles.detailsValue}>{safeText(doc.source_location?.name)}</Text>
                {/* Use fixed details for Arsh Traders, otherwise use stored details */}
                {doc.source_location?.name === 'Arsh Traders' ? (
                  <>
                    <Text style={styles.detailsSubValue}>{ARSH_TRADERS_ADDRESS}</Text>
                    <Text style={styles.detailsSubValue}>GSTIN: {ARSH_TRADERS_GSTIN}</Text>
                    <Text style={styles.detailsSubValue}>Email: {ARSH_TRADERS_EMAIL}</Text>
                  </>
                ) : (
                  <>
                    {doc.source_location?.address && (
                      <Text style={styles.detailsSubValue}>{safeText(doc.source_location.address)}</Text>
                    )}
                    {doc.source_location?.gstin && (
                      <Text style={styles.detailsSubValue}>GSTIN: {safeText(doc.source_location.gstin)}</Text>
                    )}
                    {doc.source_location?.contact && (
                      <Text style={styles.detailsSubValue}>Contact: {safeText(doc.source_location.contact)}</Text>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Consignee (Ship To) */}
            <View style={styles.detailsColumn}>
              <View style={styles.detailsBox}>
                <Text style={styles.detailsLabel}>Ship To (Consignee)</Text>
                <Text style={styles.detailsValue}>{safeText(doc.dest_location?.name)}</Text>
                {doc.dest_location?.address && (
                  <Text style={styles.detailsSubValue}>{safeText(doc.dest_location.address)}</Text>
                )}
                {doc.dest_location?.gstin && (
                  <Text style={styles.detailsSubValue}>GSTIN: {safeText(doc.dest_location.gstin)}</Text>
                )}
                {doc.dest_location?.contact && (
                  <Text style={styles.detailsSubValue}>Contact: {safeText(doc.dest_location.contact)}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Items Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colSr]}>Sr.</Text>
              <Text style={[styles.tableHeaderText, styles.colMaterial]}>Material Code</Text>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colHsn]}>HSN</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colRate]}>Rate (₹)</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount (₹)</Text>
            </View>

            {/* Table Rows */}
            {lineData.slice(0, MAX_ROWS_PER_PAGE).map((line, idx) => (
              <View key={line.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, styles.colSr]}>{safeText(line.sr)}</Text>
                <Text style={[styles.tableCellBold, styles.colMaterial, { fontSize: 7 }]}>{safeText(line.material_code)}</Text>
                <Text style={[styles.tableCell, styles.colDesc]}>{safeText(line.material_description)}</Text>
                <Text style={[styles.tableCell, styles.colHsn]}>{safeText(line.hsn)}</Text>
                <Text style={[styles.tableCellBold, styles.colQty]}>{safeText(line.qty)}</Text>
                <Text style={[styles.tableCell, styles.colRate]}>{line.rate > 0 ? safeText(formatIndianCurrency(line.rate)) : '-'}</Text>
                <Text style={[styles.tableCellBold, styles.colAmount, { fontSize: 10 }]}>{line.amount > 0 ? safeText(formatIndianCurrency(line.amount)) : '-'}</Text>
              </View>
            ))}

            {/* Total Row */}
            <View style={[styles.tableRow, { backgroundColor: BRAND_LIGHT, borderTop: `2px solid ${BRAND_NAVY}` }]}>
              <Text style={[styles.tableCellBold, styles.colSr]}></Text>
              <Text style={[styles.tableCellBold, styles.colMaterial]}></Text>
              <Text style={[styles.tableCellBold, styles.colDesc, { textAlign: 'right' }]}>TOTAL</Text>
              <Text style={[styles.tableCellBold, styles.colHsn]}></Text>
              <Text style={[styles.tableCellBold, styles.colQty, { fontSize: 10 }]}>{safeText(totalQty)}</Text>
              <Text style={[styles.tableCellBold, styles.colRate]}></Text>
              <Text style={[styles.tableCellBold, styles.colAmount, { fontSize: 11 }]}>{totalAmount > 0 ? safeText(formatIndianCurrency(totalAmount)) : '-'}</Text>
            </View>
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Quantity:</Text>
              <Text style={styles.totalValue}>{safeText(totalQty)}</Text>
            </View>
            {totalAmount > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Sub Total:</Text>
                  <Text style={styles.totalValue}>{safeText(formatIndianCurrency(totalAmount))}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                  <Text style={styles.grandTotalValue}>₹ {safeText(formatIndianCurrency(totalAmount))}</Text>
                </View>
              </>
            )}
          </View>

          {/* Amount in Words */}
          {totalAmount > 0 && (
            <View style={styles.amountInWords}>
              <Text style={styles.amountInWordsLabel}>Amount in Words</Text>
              <Text style={styles.amountInWordsText}>{safeText(numberToWords(totalAmount))}</Text>
            </View>
          )}

          {/* Signature Section */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Received By (Consignee)</Text>
            </View>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorized Signatory (Arsh Traders)</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerText}>
              Email: {ARSH_TRADERS_EMAIL} | Website: {ARSH_TRADERS_WEBSITE}
            </Text>
            <Text style={styles.footerText}>
              {ARSH_TRADERS_ADDRESS}
            </Text>
          </View>
        </View>
      </Page>

      {/* Additional pages for overflow items */}
      {lineData.length > MAX_ROWS_PER_PAGE && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            {/* Arsh Traders Horizontal Logo */}
            <Image
              src={ARSH_LOGO_PATH}
              style={{ width: 180, height: 50 }}
            />
          </View>
          <View style={styles.headerStripe} />

          <View style={styles.content}>
            <Text style={{ fontSize: 10, marginBottom: 10, color: '#64748b' }}>
              Continued from previous page - Challan No: {safeText(doc.doc_no)}
            </Text>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colSr]}>Sr.</Text>
                <Text style={[styles.tableHeaderText, styles.colMaterial]}>Material Code</Text>
                <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
                <Text style={[styles.tableHeaderText, styles.colHsn]}>HSN</Text>
                <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
                <Text style={[styles.tableHeaderText, styles.colRate]}>Rate (₹)</Text>
                <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount (₹)</Text>
              </View>

              {lineData.slice(MAX_ROWS_PER_PAGE).map((line, idx) => (
                <View key={line.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                  <Text style={[styles.tableCell, styles.colSr]}>{safeText(line.sr)}</Text>
                  <Text style={[styles.tableCellBold, styles.colMaterial, { fontSize: 7 }]}>{safeText(line.material_code)}</Text>
                  <Text style={[styles.tableCell, styles.colDesc]}>{safeText(line.material_description)}</Text>
                  <Text style={[styles.tableCell, styles.colHsn]}>{safeText(line.hsn)}</Text>
                  <Text style={[styles.tableCellBold, styles.colQty]}>{safeText(line.qty)}</Text>
                  <Text style={[styles.tableCell, styles.colRate]}>{line.rate > 0 ? safeText(formatIndianCurrency(line.rate)) : '-'}</Text>
                  <Text style={[styles.tableCellBold, styles.colAmount, { fontSize: 10 }]}>{line.amount > 0 ? safeText(formatIndianCurrency(line.amount)) : '-'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerContent}>
              <Text style={styles.footerText}>
                Email: {ARSH_TRADERS_EMAIL} | Website: {ARSH_TRADERS_WEBSITE}
              </Text>
              <Text style={styles.footerText}>
                {ARSH_TRADERS_ADDRESS}
              </Text>
            </View>
          </View>
        </Page>
      )}
    </Document>
  )
}
