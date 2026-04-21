import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTHED_ROUTES = [
  '/diagnostic',
  '/results',
  '/records',
  '/report',
  '/settings',
  '/doctor-dashboard',
  '/admin',
  '/dashboard',
]
const ADMIN_ROUTES = ['/admin', '/dashboard']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this getUser() call
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Fetch profile once per request for any checks that need role/suspended.
  let profile: { role: string | null; suspended: boolean | null } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, suspended')
      .eq('id', user.id)
      .single()
    profile = data ?? null
  }

  // Suspended users: sign out and redirect to /login?suspended=1.
  if (user && profile?.suspended) {
    await supabase.auth.signOut()
    if (pathname !== '/login') {
      const url = new URL('/login', request.url)
      url.searchParams.set('suspended', '1')
      return NextResponse.redirect(url)
    }
  }

  // Logged-in user visiting /login → redirect to their home dashboard.
  if (pathname === '/login' && user && !profile?.suspended) {
    return NextResponse.redirect(
      new URL(profile?.role === 'admin' ? '/dashboard' : '/doctor-dashboard', request.url)
    )
  }

  const isAuthedRoute = AUTHED_ROUTES.some((r) => pathname.startsWith(r))
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r))

  // Unauthenticated → /login
  if (isAuthedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // For admin routes, verify role from profiles table (user_metadata is client-writable).
  if (isAdminRoute && user && profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/doctor-dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
