import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // Refresca la sesión si es necesario. Si Supabase no responde, la página
  // se sirve igual (sin refrescar la sesión) en vez de devolver un 500:
  // cada página y ruta vuelve a verificar la sesión por su cuenta.
  try {
    const { error } = await supabase.auth.getUser()
    if (error && error.status !== 401 && error.name !== 'AuthSessionMissingError') {
      console.error('[proxy] no se pudo refrescar la sesión:', error.message)
    }
  } catch (error) {
    console.error('[proxy] Supabase no respondió:', error instanceof Error ? error.message : error)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Sin estáticos ni /api/health (el healthcheck no necesita sesión).
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
