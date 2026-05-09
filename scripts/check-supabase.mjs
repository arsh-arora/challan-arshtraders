import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_TABLES = [
  'locations',
  'items',
  'company_challans',
  'company_challan_lines',
  'docs',
  'doc_lines',
]

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {}

  return Object.fromEntries(
    fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

const fileEnv = {
  ...readEnvFile('.env'),
  ...readEnvFile('.env.local'),
}

const env = {
  ...fileEnv,
  ...process.env,
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const warehouseName = env.WAREHOUSE_LOCATION_NAME || 'Arsh Traders'

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function assertRelation(name) {
  const { error } = await supabase
    .from(name)
    .select('*', { head: true, count: 'exact' })

  if (error) {
    throw new Error(`${name}: ${error.message}`)
  }
}

async function main() {
  for (const table of REQUIRED_TABLES) {
    await assertRelation(table)
  }

  await assertRelation('v_outstanding_to_company')

  const { data: warehouse, error } = await supabase
    .from('locations')
    .select('name, kind, gstin')
    .eq('name', warehouseName)
    .single()

  if (error) {
    throw new Error(`Warehouse seed: ${error.message}`)
  }

  if (warehouse.kind !== 'warehouse') {
    throw new Error(`Warehouse seed has unexpected kind: ${warehouse.kind}`)
  }

  console.log(`Supabase OK: ${warehouse.name} warehouse is present.`)
}

main().catch((error) => {
  console.error(`Supabase check failed: ${error.message}`)
  process.exit(1)
})
