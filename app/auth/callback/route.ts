import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rutaInternaSegura } from '@/lib/redireccion'
import { urlDelSitio } from '@/lib/sitio'

export async function GET(request: Request) {
  const { searchParams, origin: origenRecibido } = new URL(request.url)
  // Detrás de Caddy, request.url trae el host interno del contenedor.
  const origin = urlDelSitio(origenRecibido)
  const code = searchParams.get('code')
  // Solo rutas internas: ?next=@evil.com no debe sacar al usuario del sitio.
  const next = rutaInternaSegura(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!perfil) {
          return NextResponse.redirect(
            `${origin}/completar-perfil?next=${encodeURIComponent(next)}`
          )
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
