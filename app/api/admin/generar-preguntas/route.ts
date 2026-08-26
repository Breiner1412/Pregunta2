import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Generar hasta 25 preguntas puede tardar más que el límite corto por
// defecto de las funciones serverless en Vercel, así que se sube el máximo.
export const maxDuration = 60

const NIVEL_DESCRIPCION: Record<number, string> = {
  1: 'muy fácil, la mayoría de la gente lo sabe',
  2: 'fácil, conocimiento común',
  3: 'intermedio, para gente con interés en el tema',
  4: 'difícil, para fans dedicados',
  5: 'muy difícil, conocimiento de nicho o experto',
}

interface PreguntaGenerada {
  pregunta: string
  opciones: string[]
  respuesta_correcta: number
  dificultad: number
}

function esPreguntaValida(p: PreguntaGenerada): boolean {
  return (
    typeof p.pregunta === 'string' &&
    p.pregunta.trim().length > 0 &&
    Array.isArray(p.opciones) &&
    p.opciones.length === 4 &&
    p.opciones.every((o) => typeof o === 'string' && o.trim().length > 0) &&
    Number.isInteger(p.respuesta_correcta) &&
    p.respuesta_correcta >= 0 &&
    p.respuesta_correcta <= 3 &&
    Number.isInteger(p.dificultad) &&
    p.dificultad >= 1 &&
    p.dificultad <= 5
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const categoriaId: string | undefined = body.categoria_id
  const cantidad = Math.min(Math.max(Number(body.cantidad) || 10, 1), 25)
  const dificultad: number | undefined = body.dificultad ? Number(body.dificultad) : undefined

  if (!categoriaId) {
    return NextResponse.json({ error: 'Falta categoria_id' }, { status: 400 })
  }

  const { data: categoria } = await supabase
    .from('categorias')
    .select('nombre')
    .eq('id', categoriaId)
    .maybeSingle()

  if (!categoria) {
    return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
  }

  const { data: existentes } = await supabase
    .from('preguntas')
    .select('pregunta')
    .eq('categoria_id', categoriaId)
    .order('created_at', { ascending: false })
    .limit(40)

  const listaExistentes = (existentes ?? []).map((p) => p.pregunta)

  const instruccionDificultad =
    dificultad && NIVEL_DESCRIPCION[dificultad]
      ? `Todas las preguntas deben ser de dificultad ${dificultad} (${NIVEL_DESCRIPCION[dificultad]}).`
      : 'Distribuye las preguntas de forma pareja entre los 5 niveles de dificultad.'

  const prompt = `Genera exactamente ${cantidad} preguntas de trivia en español sobre "${categoria.nombre}" para un juego de trivias.

Reglas:
- Español neutro, preguntas claras y sin ambigüedad.
- Cada pregunta tiene exactamente 4 opciones, solo una correcta.
- Las opciones incorrectas deben ser creíbles, no absurdas ni obviamente falsas.
- Los datos deben ser correctos y verificables. Si no estás seguro de un dato, no lo uses.
- Escala de dificultad (1 a 5): 1=${NIVEL_DESCRIPCION[1]}, 2=${NIVEL_DESCRIPCION[2]}, 3=${NIVEL_DESCRIPCION[3]}, 4=${NIVEL_DESCRIPCION[4]}, 5=${NIVEL_DESCRIPCION[5]}.
- ${instruccionDificultad}
- No repitas ninguna de estas preguntas ya existentes en la categoría:
${listaExistentes.map((p) => `  - ${p}`).join('\n') || '  (ninguna todavía)'}`

  const schema = {
    type: 'object',
    properties: {
      preguntas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pregunta: { type: 'string' },
            opciones: { type: 'array', items: { type: 'string' } },
            respuesta_correcta: { type: 'integer' },
            dificultad: { type: 'integer' },
          },
          required: ['pregunta', 'opciones', 'respuesta_correcta', 'dificultad'],
        },
      },
    },
    required: ['preguntas'],
  }

  let iaResponse: Response
  try {
    iaResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            maxOutputTokens: 8192,
          },
        }),
      }
    )
  } catch {
    return NextResponse.json({ error: 'No se pudo contactar a la IA' }, { status: 502 })
  }

  if (!iaResponse.ok) {
    const detalle = await iaResponse.text()
    return NextResponse.json({ error: 'Error de la IA', detalle }, { status: 502 })
  }

  const iaData = await iaResponse.json()
  const textoJson = iaData.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textoJson) {
    return NextResponse.json(
      { error: 'La IA no devolvió contenido', detalle: iaData },
      { status: 502 }
    )
  }

  let parseado: { preguntas: PreguntaGenerada[] }
  try {
    parseado = JSON.parse(textoJson)
  } catch {
    return NextResponse.json({ error: 'La IA devolvió JSON inválido' }, { status: 502 })
  }

  const generadas = parseado.preguntas ?? []
  const validas = generadas.filter(esPreguntaValida)

  if (validas.length === 0) {
    return NextResponse.json(
      { error: 'Ninguna pregunta generada pasó la validación' },
      { status: 502 }
    )
  }

  const filas = validas.map((p) => ({
    categoria_id: categoriaId,
    pregunta: p.pregunta.trim(),
    opciones: p.opciones,
    respuesta_correcta: p.respuesta_correcta,
    dificultad: p.dificultad,
    generada_por_ia: true,
    revisada: false,
    activa: true,
  }))

  const { error: errorInsert } = await supabase.from('preguntas').insert(filas)

  if (errorInsert) {
    return NextResponse.json({ error: errorInsert.message }, { status: 500 })
  }

  return NextResponse.json({
    insertadas: filas.length,
    descartadas: generadas.length - validas.length,
  })
}
