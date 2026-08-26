import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const maxDuration = 30

const DURACION_PREGUNTA_MS = 15000

interface RespuestaEntrante {
  pregunta_id: string
  respuesta_dada: number | null
  tiempo_respuesta_ms: number
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = await request.json()
  const categoriaId: string | null = body.categoria_id ?? null
  const respuestas: RespuestaEntrante[] = Array.isArray(body.respuestas) ? body.respuestas : []

  if (respuestas.length === 0) {
    return NextResponse.json({ error: 'Sin respuestas' }, { status: 400 })
  }

  const preguntaIds = [...new Set(respuestas.map((r) => r.pregunta_id))]

  const { data: preguntasDb } = await supabase
    .from('preguntas')
    .select('id, respuesta_correcta, dificultad')
    .in('id', preguntaIds)

  const mapaPreguntas = new Map((preguntasDb ?? []).map((p) => [p.id, p]))

  let correctas = 0
  let puntaje = 0
  const filasRespuestas: {
    pregunta_id: string
    respuesta_dada: number | null
    correcta: boolean
    tiempo_respuesta_ms: number
    dificultad_en_momento: number
  }[] = []

  for (const r of respuestas) {
    const pregunta = mapaPreguntas.get(r.pregunta_id)
    if (!pregunta) continue // ignora ids que no existen en la base

    // El tiempo se acota al rango válido: nunca se confía en lo que
    // reporte el navegador más allá de lo físicamente posible.
    const tiempoValidado = Math.min(
      Math.max(Number(r.tiempo_respuesta_ms) || 0, 0),
      DURACION_PREGUNTA_MS
    )
    const esCorrecta = r.respuesta_dada === pregunta.respuesta_correcta

    if (esCorrecta) {
      correctas++
      const bonusVelocidad = Math.max(0, 1 - tiempoValidado / DURACION_PREGUNTA_MS)
      puntaje += Math.round(100 * pregunta.dificultad * (1 + bonusVelocidad))
    }

    filasRespuestas.push({
      pregunta_id: r.pregunta_id,
      respuesta_dada: r.respuesta_dada,
      correcta: esCorrecta,
      tiempo_respuesta_ms: tiempoValidado,
      dificultad_en_momento: pregunta.dificultad,
    })
  }

  if (filasRespuestas.length === 0) {
    return NextResponse.json({ error: 'Ninguna respuesta válida' }, { status: 400 })
  }

  const { data: partida, error: errorPartida } = await supabase
    .from('partidas')
    .insert({
      usuario_id: user?.id ?? null,
      modo: categoriaId ? 'categoria_unica' : 'mixto',
      categoria_id: categoriaId,
      puntaje,
      preguntas_correctas: correctas,
      preguntas_totales: filasRespuestas.length,
      finalizada: true,
    })
    .select('id')
    .single()

  if (errorPartida || !partida) {
    return NextResponse.json({ error: errorPartida?.message ?? 'Error al guardar' }, { status: 500 })
  }

  const filasConPartida = filasRespuestas.map((f) => ({ ...f, partida_id: partida.id }))
  const { error: errorRespuestas } = await supabase.from('respuestas_partida').insert(filasConPartida)

  if (errorRespuestas) {
    return NextResponse.json({ error: errorRespuestas.message }, { status: 500 })
  }

  if (user) {
    await supabase.rpc('incrementar_puntaje_usuario', { usuario: user.id, puntos_ganados: puntaje })
    await supabase.rpc('registrar_mejor_puntaje', {
      p_usuario: user.id,
      p_categoria: categoriaId,
      p_puntaje: puntaje,
    })
  }

  return NextResponse.json({ correctas, puntaje, totalRespondidas: filasRespuestas.length })
}
