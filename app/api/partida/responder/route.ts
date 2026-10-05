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

const CANTIDAD_OPCIONES = 4

// null significa que se acabó el tiempo sin responder.
function esRespuestaValida(valor: unknown): valor is number | null {
  return (
    valor === null ||
    (Number.isInteger(valor) && (valor as number) >= 0 && (valor as number) < CANTIDAD_OPCIONES)
  )
}

// Corrige la respuesta a la pregunta en juego. El servidor mide el tiempo
// y lleva vidas y puntaje: el navegador solo dice qué opción eligió.
export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request)
  const partidaId = cuerpo?.partida_id
  const preguntaId = cuerpo?.pregunta_id
  const respuestaDada = cuerpo?.respuesta_dada ?? null

  if (!esUuid(partidaId) || !esUuid(preguntaId) || !esRespuestaValida(respuestaDada)) {
    return datosInvalidos()
  }

  const usuarioId = await obtenerUsuarioId()
  const limitado = limitarTasa(request, usuarioId, 'jugar')
  if (limitado) return limitado

  const { data: resultado, error } = await createAdminClient().rpc('responder_pregunta', {
    p_partida: partidaId,
    p_usuario: usuarioId,
    p_pregunta: preguntaId,
    p_respuesta: respuestaDada,
  })
  if (error) return respuestaDeError(error, 'responder-pregunta')

  return NextResponse.json(resultado)
}
