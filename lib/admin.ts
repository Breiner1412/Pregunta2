import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>

export type VerificacionAdmin =
  | { ok: true; supabase: ClienteSupabase; usuarioId: string }
  | { ok: false; respuesta: NextResponse }

// Comprueba en el servidor que la sesión sea de un admin de trivia.admins.
// El rol nunca sale del usuario de auth (compartido con otra app).
export async function verificarAdmin(): Promise<VerificacionAdmin> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: esAdmin } = await supabase.rpc('es_admin')
  if (esAdmin !== true) {
    return { ok: false, respuesta: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }

  return { ok: true, supabase, usuarioId: user.id }
}
