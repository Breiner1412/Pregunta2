import { z } from 'zod'

// Esquemas de lo que entra desde el navegador y desde la base. Todo lo
// externo se valida aquí antes de usarse.

export const CANTIDAD_OPCIONES = 4

export const esquemaUuid = z.uuid()

// Las opciones de una pregunta se guardan como jsonb: siempre 4 textos.
export const esquemaOpciones = z.array(z.string()).length(CANTIDAD_OPCIONES)

export const esquemaIniciarPartida = z.object({
  // null = modo Mezclado.
  categoria_id: esquemaUuid.nullable().default(null),
})

export const esquemaSiguientePregunta = z.object({
  partida_id: esquemaUuid,
})

export const esquemaResponderPregunta = z.object({
  partida_id: esquemaUuid,
  pregunta_id: esquemaUuid,
  // null = se acabó el tiempo sin responder.
  respuesta_dada: z
    .int()
    .min(0)
    .max(CANTIDAD_OPCIONES - 1)
    .nullable()
    .default(null),
})

// Lee el cuerpo JSON y lo valida contra `esquema`. Devuelve null si no es
// JSON o no cumple el esquema.
export async function leerCuerpoValidado<T extends z.ZodType>(
  request: Request,
  esquema: T
): Promise<z.infer<T> | null> {
  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return null
  }
  const resultado = esquema.safeParse(cuerpo)
  return resultado.success ? resultado.data : null
}
