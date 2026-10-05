import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/admin'
import { env } from '@/lib/env'
import { esquemaGenerarPreguntas, leerCuerpoValidado } from '@/lib/validacion'
import { NextResponse } from 'next/server'


const NIVEL_DESCRIPCION: Record<number, string> = {
  1: 'muy fácil, la mayoría de la gente lo sabe',
  2: 'fácil, conocimiento común',
  3: 'intermedio, para gente con interés en el tema',
  4: 'difícil, para fans dedicados',
  5: 'muy difícil, conocimiento de nicho o experto',
}

// Tiempo máximo de espera a Gemini. Así una llamada colgada no deja la
// petición (ni el lock de la categoría) abiertos indefinidamente.
const TIMEOUT_IA_MS = 45_000


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

// Lo que devuelve la API de Gemini: solo nos interesa el texto del primer candidato.
const esquemaRespuestaGemini = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string() })).min(1) }),
      })
    )
    .min(1),
})

// El texto es un JSON con un lote de preguntas; cada una se valida por
// separado para descartar solo las malas y no todo el lote.
const esquemaLoteGenerado = z.object({ preguntas: z.array(z.unknown()) })

const esquemaPreguntaGenerada = z.object({
  pregunta: z.string().trim().min(1).max(300),
  opciones: z.array(z.string().trim().min(1).max(150)).length(4),
  respuesta_correcta: z.int().min(0).max(3),
  dificultad: z.int().min(1).max(5),
})

type PreguntaGenerada = z.infer<typeof esquemaPreguntaGenerada>

// Devuelve las preguntas válidas del texto JSON de la IA, o null si el
// texto no es un lote reconocible.
function extraerPreguntas(textoJson: string): { generadas: number; validas: PreguntaGenerada[] } | null {
  let datos: unknown
  try {
    datos = JSON.parse(textoJson)
  } catch {
    return null
  }
  const lote = esquemaLoteGenerado.safeParse(datos)
  if (!lote.success) return null

  const validas = lote.data.preguntas.flatMap((p) => {
    const resultado = esquemaPreguntaGenerada.safeParse(p)
    return resultado.success ? [resultado.data] : []
  })
  return { generadas: lote.data.preguntas.length, validas }
}

export async function POST(request: Request) {
  const verificacion = await verificarAdmin()
  if (!verificacion.ok) return verificacion.respuesta
  const { supabase, usuarioId } = verificacion

  const cuerpo = await leerCuerpoValidado(request, esquemaGenerarPreguntas)
  if (!cuerpo) {
    return NextResponse.json(
      { error: 'Datos inválidos: categoría, cantidad (1 a 25) y dificultad (1 a 5)' },
      { status: 400 }
    )
  }
  const { categoria_id: categoriaId, cantidad, dificultad } = cuerpo

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
    p_usuario: usuarioId,
    p_categoria: categoriaId,
    p_cantidad: cantidad,
    // Cuántas generaciones puede lanzar cada admin por día (cuesta cuota de Gemini).
    p_limite_diario: env().IA_LIMITE_DIARIO,
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
      `https://generativelanguage.googleapis.com/v1beta/models/${env().GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': env().GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            maxOutputTokens: 8192,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_IA_MS),
      }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return fallo({ error: 'La IA tardó demasiado en responder, intenta de nuevo' }, 504)
    }
    return fallo({ error: 'No se pudo contactar a la IA' }, 502)
  }

  // El detalle de los errores se registra en el servidor y no se envía al
  // navegador (puede incluir datos del proyecto de Google o de la base).
  if (!iaResponse.ok) {
    console.error('[generar-preguntas] Gemini respondió', iaResponse.status, await iaResponse.text())
    const mensaje =
      iaResponse.status === 429
        ? 'Se agotó la cuota de la API de Gemini, intenta más tarde'
        : 'Error de la IA'
    return fallo({ error: mensaje }, 502)
  }

  const iaData: unknown = await iaResponse.json().catch(() => null)
  const respuestaIa = esquemaRespuestaGemini.safeParse(iaData)

  if (!respuestaIa.success) {
    console.error('[generar-preguntas] respuesta inesperada de Gemini', JSON.stringify(iaData))
    return fallo({ error: 'La IA no devolvió contenido' }, 502)
  }

  const extraidas = extraerPreguntas(respuestaIa.data.candidates[0].content.parts[0].text)
  if (!extraidas) {
    return fallo({ error: 'La IA devolvió JSON inválido' }, 502)
  }

  const { generadas, validas } = extraidas

  if (validas.length === 0) {
    return fallo(
      { error: 'Ninguna pregunta generada pasó la validación' },
      502
    )
  }

  const filas = validas.map((p) => ({
    categoria_id: categoriaId,
    pregunta: p.pregunta,
    opciones: p.opciones,
    respuesta_correcta: p.respuesta_correcta,
    dificultad: p.dificultad,
    generada_por_ia: true,
    revisada: false,
    activa: true,
  }))

  // Las preguntas que ya existen en la categoría se ignoran en vez de
  // hacer fallar todo el lote (índice único categoria_id + pregunta).
  const { data: nuevas, error: errorInsert } = await supabase
    .from('preguntas')
    .upsert(filas, { onConflict: 'categoria_id,pregunta', ignoreDuplicates: true })
    .select('id')

  if (errorInsert) {
    console.error('[generar-preguntas] insert', errorInsert)
    return fallo({ error: 'No se pudieron guardar las preguntas' }, 500)
  }

  const insertadas = nuevas?.length ?? 0

  return {
    insertadas,
    respuesta: NextResponse.json({
      insertadas,
      descartadas: generadas - insertadas,
    }),
  }
}
