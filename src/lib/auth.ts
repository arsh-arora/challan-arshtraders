import { User } from '@supabase/supabase-js'
import { getAppConfig } from './config'
import { createServerSupabaseClient } from './supabase/server'

export class AuthorizationError extends Error {
  status = 403

  constructor(message = 'You are not authorized to use this system') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export function isUserAllowed(user: User | null): boolean {
  const email = user?.email?.toLowerCase()
  if (!email) return false

  const {
    auth: { allowedEmails, allowedDomains, requireAllowlist },
  } = getAppConfig()

  if (allowedEmails.length === 0 && allowedDomains.length === 0) {
    return !requireAllowlist
  }

  if (allowedEmails.includes(email)) return true

  const domain = email.split('@')[1]
  return Boolean(domain && allowedDomains.includes(domain))
}

export async function requireAllowedUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthorizationError('Please sign in to continue')
  }

  if (!isUserAllowed(user)) {
    throw new AuthorizationError()
  }

  return user
}
