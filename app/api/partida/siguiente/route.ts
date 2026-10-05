import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { datosInvalidos, limitarTasa, obtenerUsuarioId, respuestaDeError } from '@/lib/partida'
import { esquemaSiguientePregunta, leerCuerpoValidado } from '@/lib/validacion'

// Sirve la siguiente pregunta de la partida, o el resultado si terminó.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpoValidado(request, esquemaSiguientePregunta)
  if (!cuerpo) return datosInvalidos()

  const usuarioId = await obtenerUsuarioId()
  const limitado = limitarTasa(request, usuarioId, 'jugar')
  if (limitado) return limitado

  const { data: paso, error } = await createAdminClient().rpc('servir_siguiente_pregunta', {
    p_partida: cuerpo.partida_id,
    p_usuario: usuarioId ?? undefined,
  })
  if (error) return respuestaDeError(error, 'siguiente-pregunta')

  return NextResponse.json(paso)
}
