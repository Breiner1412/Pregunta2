import 'server-only'

// Límite de peticiones por ventana fija, en memoria del proceso. Alcanza para
// una sola instancia (el contenedor de la VM); se reinicia con el proceso.

export interface LimiteTasa {
  maximo: number
  ventanaMs: number
}

interface Ventana {
  expira: number
  cantidad: number
}

const MAX_CLAVES = 10_000
const ventanas = new Map<string, Ventana>()

function limpiarVencidas(ahora: number) {
  for (const [clave, ventana] of ventanas) {
    if (ventana.expira <= ahora) ventanas.delete(clave)
  }
  // Si aun así sigue lleno (posible abuso), se empieza de cero.
  if (ventanas.size >= MAX_CLAVES) ventanas.clear()
}

// Registra una petición y devuelve false si la clave superó su límite.
export function permitirPeticion(clave: string, limite: LimiteTasa, ahora = Date.now()): boolean {
  const actual = ventanas.get(clave)

  if (!actual || actual.expira <= ahora) {
    if (ventanas.size >= MAX_CLAVES) limpiarVencidas(ahora)
    ventanas.set(clave, { expira: ahora + limite.ventanaMs, cantidad: 1 })
    return true
  }

  if (actual.cantidad >= limite.maximo) return false

  ventanas.set(clave, { expira: actual.expira, cantidad: actual.cantidad + 1 })
  return true
}

// Identifica al cliente: el usuario con sesión, o la IP que reporta Caddy
// (Caddy reemplaza el X-Forwarded-For que mande un cliente no confiable).
export function identificarCliente(request: Request, usuarioId: string | null): string {
  if (usuarioId) return `usuario:${usuarioId}`
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'desconocido'
  return `ip:${ip}`
}
