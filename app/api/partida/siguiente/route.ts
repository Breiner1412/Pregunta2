import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  datosInvalidos,
  esUuid,
  leerCuerpo,
  obtenerUsuarioId,
  respuestaDeError,
} from '@/lib/partida'

// Sirve la siguiente pregunta de la partida, o el resultado si terminó.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request)
  const partidaId = cuerpo?.partida_id

  if (!esUuid(partidaId)) {
    return datosInvalidos()
  }

  const usuarioId = await obtenerUsuarioId()
  const { data: paso, error } = await createAdminClient().rpc('servir_siguiente_pregunta', {
    p_partida: partidaId,
    p_usuario: usuarioId,
  })
  if (error) return respuestaDeError(error, 'siguiente-pregunta')

  return NextResponse.json(paso)
}
