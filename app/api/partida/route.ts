import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { datosInvalidos, limitarTasa, obtenerUsuarioId, respuestaDeError } from '@/lib/partida'
import { esquemaIniciarPartida, leerCuerpoValidado } from '@/lib/validacion'
import type { PasoPartida } from '@/types/game'

// Crea una partida y devuelve su primera pregunta.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpoValidado(request, esquemaIniciarPartida)
  if (!cuerpo) return datosInvalidos()

  const usuarioId = await obtenerUsuarioId()
  const limitado = limitarTasa(request, usuarioId, 'iniciar')
  if (limitado) return limitado

  const admin = createAdminClient()

  // undefined = parámetro omitido, que en SQL vale null (invitado / Mezclado).
  const { data: partidaId, error } = await admin.rpc('iniciar_partida', {
    p_usuario: usuarioId ?? undefined,
    p_categoria: cuerpo.categoria_id ?? undefined,
  })
  if (error) return respuestaDeError(error, 'iniciar-partida')

  const { data: paso, error: errorPaso } = await admin.rpc('servir_siguiente_pregunta', {
    p_partida: partidaId,
    p_usuario: usuarioId ?? undefined,
  })
  if (errorPaso) return respuestaDeError(errorPaso, 'iniciar-partida')

  // paso es el jsonb que arma servir_siguiente_pregunta (forma PasoPartida).
  return NextResponse.json({ partida_id: partidaId, ...(paso as unknown as PasoPartida) })
}
