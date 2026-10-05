import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// Cuántas generaciones puede lanzar cada admin por día (cuesta cuota de Gemini).
const LIMITE_DIARIO_IA_POR_DEFECTO = 10

function limiteDiarioIa(): number {
  const valor = Number(process.env.IA_LIMITE_DIARIO)
  return Number.isInteger(valor) && valor > 0 ? valor : LIMITE_DIARIO_IA_POR_DEFECTO
}

const ERRORES_CUOTA: Record<string, { status: number; mensaje: string }> = {
  cuota_ia_agotada: { status: 429, mensaje: 'Llegaste al límite diario de generaciones con IA' },
  generacion_en_curso: { status: 409, mensaje: 'Ya hay una generación en curso para esta categoría' },
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>

interface ResultadoGeneracion {
  insertadas: number
  respuesta: NextResponse
}

function fallo(cuerpo: Record<string, unknown>, status: number): ResultadoGeneracion {
  return { insertadas: 0, respuesta: NextResponse.json(cuerpo, { status }) }
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

  const { data: esAdmin } = await supabase.rpc('es_admin')

  if (esAdmin !== true) {
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

  // Reserva la cuota antes de llamar a la IA; se cierra pase lo que pase.
  const admin = createAdminClient()
  const { data: usoId, error: errorCuota } = await admin.rpc('reservar_uso_ia', {
    p_usuario: user.id,
    p_categoria: categoriaId,
    p_cantidad: cantidad,
    p_limite_diario: limiteDiarioIa(),
  })

  if (errorCuota) {
    const conocido = ERRORES_CUOTA[errorCuota.message]
    if (conocido) {
      return NextResponse.json({ error: conocido.mensaje }, { status: conocido.status })
    }
    console.error('[generar-preguntas] reservar_uso_ia', errorCuota)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  let insertadas = 0
  try {
    const resultado = await generarYGuardar(supabase, categoriaId, categoria.nombre, cantidad, dificultad)
    insertadas = resultado.insertadas
    return resultado.respuesta
  } finally {
    const { error: errorCierre } = await admin.rpc('cerrar_uso_ia', {
      p_uso: usoId,
      p_insertadas: insertadas,
    })
    if (errorCierre) console.error('[generar-preguntas] cerrar_uso_ia', errorCierre)
  }
}

async function generarYGuardar(
  supabase: ClienteSupabase,
  categoriaId: string,
  nombreCategoria: string,
  cantidad: number,
  dificultad: number | undefined
): Promise<ResultadoGeneracion> {
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

  const prompt = `Genera exactamente ${cantidad} preguntas de trivia en español sobre "${nombreCategoria}" para un juego de trivias.

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
    return fallo({ error: 'No se pudo contactar a la IA' }, 502)
  }

  if (!iaResponse.ok) {
    const detalle = await iaResponse.text()
    return fallo({ error: 'Error de la IA', detalle }, 502)
  }

  const iaData = await iaResponse.json()
  const textoJson = iaData.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textoJson) {
    return fallo(
      { error: 'La IA no devolvió contenido', detalle: iaData },
      502
    )
  }

  let parseado: { preguntas: PreguntaGenerada[] }
  try {
    parseado = JSON.parse(textoJson)
  } catch {
    return fallo({ error: 'La IA devolvió JSON inválido' }, 502)
  }

  const generadas = parseado.preguntas ?? []
  const validas = generadas.filter(esPreguntaValida)

  if (validas.length === 0) {
    return fallo(
      { error: 'Ninguna pregunta generada pasó la validación' },
      502
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
    return fallo({ error: errorInsert.message }, 500)
  }

  return {
    insertadas: filas.length,
    respuesta: NextResponse.json({
      insertadas: filas.length,
      descartadas: generadas.length - validas.length,
    }),
  }
}
