import { NextResponse } from 'next/server'
import { verificarAdmin } from '@/lib/admin'
import { esquemaUuid } from '@/lib/validacion'

type Contexto = { params: Promise<{ id: string }> }

async function leerId(contexto: Contexto): Promise<string | null> {
  const { id } = await contexto.params
  return esquemaUuid.safeParse(id).success ? id : null
}

// Aprueba una pregunta pendiente: pasa a la rotación del juego.
export async function PATCH(_request: Request, contexto: Contexto) {
  const admin = await verificarAdmin()
  if (!admin.ok) return admin.respuesta

  const id = await leerId(contexto)
  if (!id) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const { data, error } = await admin.supabase
    .from('preguntas')
    .update({ revisada: true })
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[aprobar-pregunta]', error)
    return NextResponse.json({ error: 'No se pudo aprobar la pregunta' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

// Rechaza (borra) una pregunta.
export async function DELETE(_request: Request, contexto: Contexto) {
  const admin = await verificarAdmin()
  if (!admin.ok) return admin.respuesta

  const id = await leerId(contexto)
  if (!id) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const { data, error } = await admin.supabase.from('preguntas').delete().eq('id', id).select('id')

  if (error) {
    console.error('[rechazar-pregunta]', error)
    return NextResponse.json({ error: 'No se pudo rechazar la pregunta' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
