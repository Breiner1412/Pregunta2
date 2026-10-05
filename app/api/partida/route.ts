import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  datosInvalidos,
  esUuid,
  leerCuerpo,
  limitarTasa,
  obtenerUsuarioId,
  respuestaDeError,
} from '@/lib/partida'

// Crea una partida y devuelve su primera pregunta.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request)
  const categoriaId = cuerpo?.categoria_id ?? null

  if (!cuerpo || (categoriaId !== null && !esUuid(categoriaId))) {
    return datosInvalidos()
  }

  const usuarioId = await obtenerUsuarioId()
  const limitado = limitarTasa(request, usuarioId, 'iniciar')
  if (limitado) return limitado

  const admin = createAdminClient()

  const { data: partidaId, error } = await admin.rpc('iniciar_partida', {
    p_usuario: usuarioId,
    p_categoria: categoriaId,
  })
  if (error) return respuestaDeError(error, 'iniciar-partida')

  const { data: paso, error: errorPaso } = await admin.rpc('servir_siguiente_pregunta', {
    p_partida: partidaId,
    p_usuario: usuarioId,
  })
  if (errorPaso) return respuestaDeError(errorPaso, 'iniciar-partida')

  return NextResponse.json({ partida_id: partidaId, ...paso })
}
