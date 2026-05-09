import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAppConfig } from '@/lib/config'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function safeTokenEquals(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  )
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const [scheme, token] = header.split(' ')

  return scheme?.toLowerCase() === 'bearer' ? token : undefined
}

export async function GET(request: NextRequest) {
  const config = getAppConfig()
  const expectedToken = config.keepalive.token
  const providedToken = getBearerToken(request)

  if (!expectedToken) {
    return NextResponse.json(
      { ok: false, error: 'Keepalive is not configured' },
      { status: 503 }
    )
  }

  if (!providedToken || !safeTokenEquals(expectedToken, providedToken)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerSupabaseAdmin()
  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('name', config.locations.warehouseName)
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Warehouse seed was not found' },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() })
}
