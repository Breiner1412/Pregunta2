import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rutaInternaSegura } from '@/lib/redireccion'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
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
