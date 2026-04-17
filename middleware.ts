import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DOCTOR_ROUTES = ['/diagnostic', '/results', '/records', '/report', '/profile']
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

  // Logged-in user visiting /login → redirect to their home
  if (pathname === '/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return NextResponse.redirect(
      new URL(profile?.role === 'admin' ? '/admin' : '/diagnostic', request.url)
    )
  }

  const isDoctorRoute = DOCTOR_ROUTES.some((r) => pathname.startsWith(r))
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r))

  // Unauthenticated → /login
  if ((isDoctorRoute || isAdminRoute) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // For admin routes, verify role from profiles table (user_metadata is client-writable)
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/diagnostic', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
