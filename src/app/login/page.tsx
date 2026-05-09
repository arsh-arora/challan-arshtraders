'use client'

import { useState, Suspense, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const [loadingAction, setLoadingAction] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const searchParams = useSearchParams()
  const authError = searchParams.get('error')
  const isUnauthorized = authError === 'unauthorized'

  const getAuthCallbackUrl = () =>
    `${(process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')}/auth/callback`

  const handleGoogleLogin = async () => {
    setLoadingAction('google')
    setError(null)
    setEmailSent(false)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthCallbackUrl(),
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        setError(
          error.message.includes('Unsupported provider')
            ? 'Google sign-in is not enabled yet. Use an email sign-in link below, or enable Google in Supabase Auth.'
            : error.message
        )
        setLoadingAction(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoadingAction(null)
    }
  }

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address.')
      return
    }

    setLoadingAction('email')
    setError(null)
    setEmailSent(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          shouldCreateUser: true,
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Challan Tracker</h1>
          <p className="text-slate-400">Manage your inventory and documents</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-6">
            Sign in to continue
          </h2>

          {/* Error Messages */}
          {(error || authError) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {error || (authError === 'auth_callback_error'
                  ? 'Authentication failed. Please try again.'
                  : authError === 'unauthorized'
                  ? 'Your account is not authorized for this internal tool.'
                  : 'An error occurred during sign in.')}
              </p>
            </div>
          )}

          {/* Google Sign In Button */}
          {isUnauthorized ? (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-700 font-medium">Sign out and use another account</span>
            </button>
          ) : (
            <div className="space-y-5">
              <button
                onClick={handleGoogleLogin}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'google' ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span className="text-gray-700 font-medium">
                  {loadingAction === 'google' ? 'Signing in...' : 'Continue with Google'}
                </span>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  or
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email sign-in link
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={loadingAction !== null}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={loadingAction !== null}
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingAction === 'email' ? 'Sending link...' : 'Send sign-in link'}
                </button>
                {emailSent && (
                  <p className="text-sm text-emerald-700">
                    Check your email for the sign-in link.
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Terms notice */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Arsh Traders &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Wrap with Suspense for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  )
}
