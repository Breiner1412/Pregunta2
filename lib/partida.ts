import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { identificarCliente, permitirPeticion, type LimiteTasa } from '@/lib/rate-limit'

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_UUID.test(valor)
}

// Devuelve el cuerpo JSON si es un objeto, o null si no se pudo leer.
export async function leerCuerpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await request.json()
    if (cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) {
      return cuerpo as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

// Id del usuario con sesión, o null si juega como invitado.
export async function obtenerUsuarioId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Una partida normal hace una petición cada pocos segundos; esto solo frena
// scripts que inician partidas o responden en ráfaga.
const LIMITES: Record<'iniciar' | 'jugar', LimiteTasa> = {
  iniciar: { maximo: 20, ventanaMs: 10 * 60 * 1000 },
  jugar: { maximo: 60, ventanaMs: 60 * 1000 },
}

// Devuelve una respuesta 429 si el cliente superó el límite, o null si puede seguir.
export function limitarTasa(
  request: Request,
  usuarioId: string | null,
  accion: keyof typeof LIMITES
): NextResponse | null {
  const clave = `${accion}:${identificarCliente(request, usuarioId)}`
  if (permitirPeticion(clave, LIMITES[accion])) return null
  return NextResponse.json(
    { error: 'Demasiadas peticiones, espera un momento' },
    { status: 429 }
  )
}

export function datosInvalidos() {
  return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
}

// Errores que las funciones de partida lanzan a propósito (raise exception).
const ERRORES_CONOCIDOS: Record<string, { status: number; mensaje: string }> = {
  partida_no_encontrada: { status: 404, mensaje: 'Partida no encontrada' },
  categoria_no_encontrada: { status: 404, mensaje: 'Categoría no encontrada' },
  partida_finalizada: { status: 409, mensaje: 'La partida ya terminó' },
  pregunta_no_vigente: { status: 409, mensaje: 'Esa pregunta ya no está en juego' },
}

// Traduce un error de la base a una respuesta sin detalles internos.
export function respuestaDeError(error: { message: string }, contexto: string) {
  const conocido = ERRORES_CONOCIDOS[error.message]
  if (conocido) {
    return NextResponse.json({ error: conocido.mensaje }, { status: conocido.status })
  }
  console.error(`[${contexto}]`, error)
  return NextResponse.json({ error: 'Error interno' }, { status: 500 })
}
