import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#4b5563',
  },
  value: {
    width: '70%',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e5e7eb',
    padding: 8,
  },
  col1: { width: '20%' },
  col2: { width: '20%' },
  col3: { width: '40%' },
  col4: { width: '10%' },
  col5: { width: '10%' },
})

interface DocumentPDFProps {
  doc: any
  lines: any[]
}

export default function DocumentPDF({ doc, lines }: DocumentPDFProps) {
  const typeSuffix =
    doc.doc_type === 'in' ? 'Inbound' : doc.doc_type === 'out' ? 'Outbound' : 'Return'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Document {doc.doc_no}</Text>
          <Text style={styles.subtitle}>{typeSuffix} Document</Text>
        </View>

        {/* Document Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Details</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Document No:</Text>
            <Text style={styles.value}>{doc.doc_no}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Document Type:</Text>
            <Text style={styles.value}>{typeSuffix}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Document Date:</Text>
            <Text style={styles.value}>{doc.doc_date}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Source Location:</Text>
            <Text style={styles.value}>
              {doc.source.name} ({doc.source.kind})
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Destination Location:</Text>
            <Text style={styles.value}>
              {doc.destination.name} ({doc.destination.kind})
            </Text>
          </View>

          {doc.counterparty_name && (
            <View style={styles.row}>
              <Text style={styles.label}>Counterparty:</Text>
              <Text style={styles.value}>{doc.counterparty_name}</Text>
            </View>
          )}

          {doc.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={styles.value}>{doc.notes}</Text>
            </View>
          )}
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>

          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Delivery No</Text>
              <Text style={styles.col2}>Material Code</Text>
              <Text style={styles.col3}>Description</Text>
              <Text style={styles.col4}>Quantity</Text>
              <Text style={styles.col5}>Ticket</Text>
            </View>

            {/* Table Rows */}
            {lines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={styles.col1}>{line.company_delivery_no || '-'}</Text>
                <Text style={styles.col2}>{line.material_code}</Text>
                <Text style={styles.col3}>{line.material_description}</Text>
                <Text style={styles.col4}>{line.qty}</Text>
                <Text style={styles.col5}>{line.ticket_code || '-'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 30, left: 30, right: 30 }}>
          <Text style={{ fontSize: 8, color: '#9ca3af', textAlign: 'center' }}>
            Generated on {new Date().toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
