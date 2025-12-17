export interface Location {
  id: string
  name: string
  kind: 'warehouse' | 'company' | 'partner' | 'hospital'
  is_active: boolean
  gstin: string | null
  address: string | null
  contact: string | null
}

export interface Item {
  id: string
  material_code: string
  description: string | null
  uom: string
}

export interface CompanyChallan {
  id: string
  supplier_name: string
  delivery_number: string
  delivery_date: string | null
  raw_doc_ref: string | null
}

export interface CompanyChallanLine {
  id: string
  challan_id: string
  item_id: string
  item_number: string | null
  hsn_code: string | null
  unit_cost: number | null
  qty_received: number
}

export interface Doc {
  id: string
  doc_no: string
  doc_type: 'in' | 'out' | 'return'
  doc_date: string
  source_location_id: string
  dest_location_id: string
  counterparty_name: string | null
  notes: string | null
  created_at: string
}

export interface DocLine {
  id: string
  doc_id: string
  challan_line_id: string
  ticket_code: string | null
  qty: number
  material_code: string | null
  material_description: string | null
  company_delivery_no: string | null
  company_delivery_date: string | null
}

export interface ExcelRow {
  'Customer Code'?: string
  'Customer Name'?: string
  'City'?: string
  'Pin Code'?: string
  'Cust. GST. No.'?: string
  'Delivery Number'?: string
  'Item Number'?: string
  'Delivery Date'?: number | string
  'Material Code'?: string
  'Material Description'?: string
  'HSN Code'?: string
  'QTY'?: number
  'GST Rate'?: number
  'Unit Cost'?: number
  'Total Value'?: number
}

export interface ColumnMapping {
  deliveryNumber: string
  deliveryDate: string
  itemNumber: string
  materialCode: string
  materialDescription: string
  hsnCode: string
  qty: string
  unitCost: string
}
