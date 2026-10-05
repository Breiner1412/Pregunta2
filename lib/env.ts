import 'server-only'
import { z } from 'zod'

// Variables de entorno del servidor, validadas una vez al arrancar
// (instrumentation.ts) para fallar enseguida con un mensaje claro en vez
// de con errores confusos a mitad de una petición.

const esProduccion = process.env.NODE_ENV === 'production'

const esquemaEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // En desarrollo los redirects pueden usar el origen de la petición.
  NEXT_PUBLIC_SITE_URL: esProduccion ? z.url() : z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // Código del modelo, tal como aparece en la API (models/<código>).
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-z0-9.-]+$/, 'código de modelo inválido')
    .default('gemini-3.6-flash'),
  // Generaciones con IA por admin y por día.
  IA_LIMITE_DIARIO: z.coerce.number().int().positive().default(10),
})

export type Env = z.infer<typeof esquemaEnv>

let envValidado: Env | null = null

// Devuelve las variables validadas; lanza un error con los nombres (nunca
// los valores) de las que faltan o son inválidas.
export function env(): Env {
  if (envValidado) return envValidado

  // Una variable vacía (VAR=) cuenta como no definida.
  const definidas = Object.fromEntries(
    Object.entries(process.env).filter(([, valor]) => valor !== undefined && valor.trim() !== '')
  )
  const resultado = esquemaEnv.safeParse(definidas)
  if (!resultado.success) {
    const nombres = [...new Set(resultado.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(`Variables de entorno faltantes o inválidas: ${nombres.join(', ')}`)
  }

  envValidado = resultado.data
  return envValidado
}
