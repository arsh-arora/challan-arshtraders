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

  if (!requireAllowlist) return true

  if (allowedEmails.length === 0 && allowedDomains.length === 0) {
    return false
  }

  const normalizedEmail = email.toLowerCase()
  if (allowedEmails.includes(normalizedEmail)) return true

  const domain = normalizedEmail.split('@')[1]
  return Boolean(domain && allowedDomains.includes(domain))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')
  const isApiRoute = pathname.startsWith('/api/')

  // These handlers perform their own authentication. Keep session refresh from
  // blocking the OAuth exchange or the independent health check.
  if (pathname.startsWith('/auth/') || pathname === '/api/health/supabase') {
    return supabaseResponse
  }

  const withCookies = (response: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Refresh session if expired - required for Server Components
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error && (
      error.name === 'AuthRetryableFetchError' ||
      (error.status !== undefined && error.status >= 500)
    )) {
      throw error
    }

    // If user is not signed in and the current path is not public, redirect to /login
    if (!user && !isLoginRoute) {
      if (isApiRoute) {
        return withCookies(NextResponse.json(
          { error: 'Your session has expired. Please sign in again.' },
          { status: 401 }
        ))
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return withCookies(NextResponse.redirect(url))
    }

    const allowedUser = user ? isEmailAllowed(user.email) : false

    if (user && !allowedUser && !isLoginRoute) {
      if (isApiRoute) {
        return withCookies(NextResponse.json(
          { error: 'Your account is not authorized for this internal tool.' },
          { status: 403 }
        ))
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized')
      return withCookies(NextResponse.redirect(url))
    }

    // If user is signed in and tries to access /login, redirect to home
    if (user && allowedUser && isLoginRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return withCookies(NextResponse.redirect(url))
    }

    return supabaseResponse
  } catch (error) {
    console.error('Authentication middleware failed:', error)

    // The sign-in page remains accessible during an outage, while protected
    // requests fail closed instead of crashing the edge function.
    if (isLoginRoute) return supabaseResponse

    const message = 'Sign-in is temporarily unavailable. Please try again later.'
    return withCookies(isApiRoute
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
