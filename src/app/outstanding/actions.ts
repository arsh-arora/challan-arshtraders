'use server'

import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export interface OutstandingItem {
  challan_line_id: string
  material_code: string
  description: string | null
  delivery_number: string
  supplier_name: string
  initial_qty: number
  returned_qty: number
  outstanding_qty: number
}

export async function getOutstanding(deliveryNumberFilter?: string) {
  const supabase = await createServerSupabaseAdmin()

  let query = supabase
    .from('v_outstanding_to_company')
    .select('*')
    .order('delivery_number')
    .order('material_code')

  if (deliveryNumberFilter) {
    query = query.ilike('delivery_number', `%${deliveryNumberFilter}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch outstanding:', error)
    return []
  }

  // Filter out fully returned items (outstanding_qty <= 0)
  const outstanding = (data || []).filter(
    (item: OutstandingItem) => item.outstanding_qty > 0
  )

  return outstanding as OutstandingItem[]
}
