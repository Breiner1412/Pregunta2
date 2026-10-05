import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { datosInvalidos, limitarTasa, obtenerUsuarioId, respuestaDeError } from '@/lib/partida'
import { esquemaResponderPregunta, leerCuerpoValidado } from '@/lib/validacion'

// Corrige la respuesta a la pregunta en juego. El servidor mide el tiempo
// y lleva vidas y puntaje: el navegador solo dice qué opción eligió.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpoValidado(request, esquemaResponderPregunta)
  if (!cuerpo) return datosInvalidos()

  const usuarioId = await obtenerUsuarioId()
  const limitado = limitarTasa(request, usuarioId, 'jugar')
  if (limitado) return limitado

  // undefined = parámetro omitido: null en SQL (invitado / tiempo agotado).
  const { data: resultado, error } = await createAdminClient().rpc('responder_pregunta', {
    p_partida: cuerpo.partida_id,
    p_pregunta: cuerpo.pregunta_id,
    p_usuario: usuarioId ?? undefined,
    p_respuesta: cuerpo.respuesta_dada ?? undefined,
  })
  if (error) return respuestaDeError(error, 'responder-pregunta')

  return NextResponse.json(resultado)
}
