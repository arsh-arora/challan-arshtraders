import { z } from 'zod'

const csvList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const csvLowerList = (value: string | undefined) =>
  csvList(value).map((entry) => entry.toLowerCase())

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  AUTH_ALLOWED_EMAILS: z.string().optional(),
  AUTH_ALLOWED_DOMAINS: z.string().optional(),
  AUTH_REQUIRE_ALLOWLIST: z.string().optional(),
  BUSINESS_NAME: z.string().min(1).default('Arsh Traders'),
  BUSINESS_ADDRESS: z
    .string()
    .min(1)
    .default('Plot No. 119-2A, Saket Nagar, Bhopal - 462024 (M.P.)'),
  BUSINESS_GSTIN: z.string().min(1).default('23AECPC0996H2ZR'),
  BUSINESS_EMAIL: z.string().email().default('director@arshtraders.com'),
  BUSINESS_WEBSITE: z.string().min(1).default('arshtraders.com'),
  BUSINESS_LOGO_FILE: z.string().min(1).default('horizontal-logo.png'),
  WAREHOUSE_LOCATION_NAME: z.string().min(1).default('Arsh Traders'),
  COMPANY_LOCATION_PREFIX: z.string().min(1).default('Company:'),
  DOC_INBOUND_PREFIX: z.string().min(1).default('IN'),
  DOC_DEFAULT_PREFIX: z.string().min(1).default('DOC'),
  TICKET_PREFIX: z.string().min(1).default('TKT'),
  TICKET_SEQUENCE_WIDTH: z.coerce.number().int().positive().default(4),
})

export type AppConfig = ReturnType<typeof getAppConfig>

let cachedConfig: {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  publicAppUrl?: string
  auth: {
    allowedEmails: string[]
    allowedDomains: string[]
    requireAllowlist: boolean
  }
  business: {
    name: string
    address: string
    gstin: string
    email: string
    website: string
    logoFile: string
  }
  locations: {
    warehouseName: string
    companyPrefix: string
  }
  documents: {
    inboundPrefix: string
    defaultPrefix: string
  }
  tickets: {
    prefix: string
    sequenceWidth: number
  }
}

export function getAppConfig() {
  if (cachedConfig) return cachedConfig

  const env = envSchema.parse(process.env)

  cachedConfig = {
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    publicAppUrl: env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, ''),
    auth: {
      allowedEmails: csvLowerList(env.AUTH_ALLOWED_EMAILS),
      allowedDomains: csvLowerList(env.AUTH_ALLOWED_DOMAINS).map((domain) =>
        domain.replace(/^@/, '')
      ),
      requireAllowlist:
        env.AUTH_REQUIRE_ALLOWLIST === 'true' ||
        (env.AUTH_REQUIRE_ALLOWLIST !== 'false' &&
          process.env.NODE_ENV === 'production'),
    },
    business: {
      name: env.BUSINESS_NAME,
      address: env.BUSINESS_ADDRESS,
      gstin: env.BUSINESS_GSTIN,
      email: env.BUSINESS_EMAIL,
      website: env.BUSINESS_WEBSITE,
      logoFile: env.BUSINESS_LOGO_FILE,
    },
    locations: {
      warehouseName: env.WAREHOUSE_LOCATION_NAME,
      companyPrefix: env.COMPANY_LOCATION_PREFIX,
    },
    documents: {
      inboundPrefix: env.DOC_INBOUND_PREFIX,
      defaultPrefix: env.DOC_DEFAULT_PREFIX,
    },
    tickets: {
      prefix: env.TICKET_PREFIX,
      sequenceWidth: env.TICKET_SEQUENCE_WIDTH,
    },
  }

  return cachedConfig
}
