import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const preguntaId: string | undefined = body.pregunta_id
  const respuestaDada: number | null = body.respuesta_dada ?? null

  if (!preguntaId) {
    return NextResponse.json({ error: 'Falta pregunta_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: pregunta } = await supabase
    .from('preguntas')
    .select('respuesta_correcta, dificultad')
    .eq('id', preguntaId)
    .maybeSingle()

  if (!pregunta) {
    return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    correcta: respuestaDada === pregunta.respuesta_correcta,
    respuesta_correcta: pregunta.respuesta_correcta,
    dificultad: pregunta.dificultad,
  })
}
