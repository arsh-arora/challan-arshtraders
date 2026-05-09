import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function csvLowerList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isEmailAllowed(email: string | undefined) {
  if (!email) return false

  const allowedEmails = csvLowerList(process.env.AUTH_ALLOWED_EMAILS)
  const allowedDomains = csvLowerList(process.env.AUTH_ALLOWED_DOMAINS).map(
    (domain) => domain.replace(/^@/, '')
  )
  const requireAllowlist =
    process.env.AUTH_REQUIRE_ALLOWLIST === 'true' ||
    (process.env.AUTH_REQUIRE_ALLOWLIST !== 'false' &&
      process.env.NODE_ENV === 'production')

  if (allowedEmails.length === 0 && allowedDomains.length === 0) {
    return !requireAllowlist
  }

  const normalizedEmail = email.toLowerCase()
  if (allowedEmails.includes(normalizedEmail)) return true

  const domain = normalizedEmail.split('@')[1]
  return Boolean(domain && allowedDomains.includes(domain))
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/health/supabase')

  // If user is not signed in and the current path is not public, redirect to /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const allowedUser = user ? isEmailAllowed(user.email) : false

  if (user && !allowedUser && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  // If user is signed in and tries to access /login, redirect to home
  if (user && allowedUser && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
