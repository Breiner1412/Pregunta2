'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Categoria, Pregunta } from '@/types/game'
import type { Database } from '@/types/database'
import { esquemaOpciones } from '@/lib/validacion'

type FilaPendiente = Pick<
  Database['trivia']['Tables']['preguntas']['Row'],
  'id' | 'categoria_id' | 'pregunta' | 'opciones' | 'respuesta_correcta' | 'dificultad'
>

// opciones llega como jsonb: solo se muestran las filas con 4 textos.
function aPreguntas(filas: FilaPendiente[] | null): Pregunta[] {
  return (filas ?? []).flatMap((fila) => {
    const opciones = esquemaOpciones.safeParse(fila.opciones)
    return opciones.success ? [{ ...fila, opciones: opciones.data }] : []
  })
}

async function consultarPendientes(supabase: ReturnType<typeof createClient>): Promise<Pregunta[]> {
  const { data } = await supabase
    .from('preguntas')
    .select('id, categoria_id, pregunta, opciones, respuesta_correcta, dificultad')
    .eq('revisada', false)
    .order('created_at', { ascending: false })
  return aPreguntas(data)
}

// El acceso se verifica en el servidor (app/admin/layout.tsx): si esta
// página se renderiza, la sesión es de un admin.
export default function AdminPreguntasPage() {
  // useState mantiene el mismo cliente entre renders (identidad estable para los efectos).
  const [supabase] = useState(createClient)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [cantidad, setCantidad] = useState(10)
  const [dificultad, setDificultad] = useState('') // '' = todas

  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [pendientes, setPendientes] = useState<Pregunta[]>([])
  const [errorRevision, setErrorRevision] = useState('')
  const [cargandoPendientes, setCargandoPendientes] = useState(true)

  useEffect(() => {
    async function cargarCategorias() {
      const { data } = await supabase
        .from('categorias')
        .select('id, nombre, slug, grupo')
        .eq('activa', true)
        .order('orden')
      if (data) {
        setCategorias(data)
        if (data.length > 0) setCategoriaId(data[0].id)
      }
    }
    cargarCategorias()
  }, [supabase])

  // Recarga la lista después de generar preguntas nuevas.
  const cargarPendientes = useCallback(async () => {
    setPendientes(await consultarPendientes(supabase))
    setCargandoPendientes(false)
  }, [supabase])

  useEffect(() => {
    let cancelado = false
    consultarPendientes(supabase).then((lista) => {
      if (cancelado) return
      setPendientes(lista)
      setCargandoPendientes(false)
    })
    return () => {
      cancelado = true
    }
  }, [supabase])

  async function generar() {
    if (!categoriaId) return
    setGenerando(true)
    setMensaje('')

    try {
      const res = await fetch('/api/admin/generar-preguntas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categoria_id: categoriaId,
          cantidad,
          dificultad: dificultad ? Number(dificultad) : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensaje(`Error: ${data.error ?? 'desconocido'}`)
      } else {
        setMensaje(`Se generaron ${data.insertadas} preguntas nuevas para revisar.`)
        cargarPendientes()
      }
    } catch {
      setMensaje('Error de red al generar preguntas.')
    } finally {
      setGenerando(false)
    }
  }

  // Aprobar y rechazar pasan por el servidor, que vuelve a verificar el rol.
  // La pregunta solo se quita de la lista si el servidor confirmó el cambio.
  async function revisar(id: string, metodo: 'PATCH' | 'DELETE') {
    const accion = metodo === 'PATCH' ? 'aprobar' : 'rechazar'
    setErrorRevision('')
    try {
      const res = await fetch(`/api/admin/preguntas/${id}`, { method: metodo })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrorRevision(`No se pudo ${accion} la pregunta: ${data?.error ?? `error ${res.status}`}`)
        return
      }
      setPendientes((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setErrorRevision(`Error de red al ${accion} la pregunta.`)
    }
  }

  const aprobar = (id: string) => revisar(id, 'PATCH')
  const rechazar = (id: string) => revisar(id, 'DELETE')

  function nombreCategoria(id: string | null) {
    return categorias.find((c) => c.id === id)?.nombre ?? '???'
  }


  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🤖 Generar preguntas con IA</h1>
        <Link href="/jugar" className="text-accent hover:underline text-sm">
          ← Jugar
        </Link>
      </div>

      <div className="p-4 rounded-2xl bg-surface border border-white/5 mb-8 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-ink-soft">Categoría</label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full p-2 rounded-xl bg-ink border border-white/10 text-paper focus:border-accent focus:outline-none transition"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-ink-soft">Cantidad</label>
            <input
              type="number"
              min={1}
              max={25}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full p-2 rounded-xl bg-ink border border-white/10 text-paper focus:border-accent focus:outline-none transition"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-ink-soft">Dificultad</label>
            <select
              value={dificultad}
              onChange={(e) => setDificultad(e.target.value)}
              className="w-full p-2 rounded-xl bg-ink border border-white/10 text-paper focus:border-accent focus:outline-none transition"
            >
              <option value="">Todas (repartidas)</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={generar}
          disabled={generando || !categoriaId}
          className="w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
        >
          {generando ? 'Generando... (puede tardar hasta 30-40s)' : 'Generar preguntas'}
        </button>

        {mensaje && <p className="text-sm text-ink-soft">{mensaje}</p>}
      </div>

      <h2 className="text-xl font-bold mb-4">
        Pendientes de revisión {pendientes.length > 0 && `(${pendientes.length})`}
      </h2>

      {errorRevision && <p className="text-sm text-bad mb-4">{errorRevision}</p>}

      {cargandoPendientes ? (
        <p className="text-ink-soft">Cargando...</p>
      ) : pendientes.length === 0 ? (
        <p className="text-ink-soft">No hay preguntas pendientes de revisión.</p>
      ) : (
        <div className="space-y-4">
          {pendientes.map((p) => (
            <div key={p.id} className="p-4 rounded-2xl bg-surface border border-white/5">
              <p className="text-xs text-ink-soft mb-2 font-mono">
                {nombreCategoria(p.categoria_id)} · dif. {p.dificultad}
              </p>
              <p className="font-medium mb-3">{p.pregunta}</p>
              <div className="grid gap-1 mb-3">
                {p.opciones.map((o, idx) => (
                  <div
                    key={idx}
                    className={`text-sm p-2 rounded-lg ${
                      idx === p.respuesta_correcta
                        ? 'bg-ok/15 text-ok font-medium border border-ok/30'
                        : 'bg-ink text-ink-soft'
                    }`}
                  >
                    {o}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => aprobar(p.id)}
                  className="flex-1 p-2 rounded-xl bg-ok text-ink text-sm font-semibold hover:brightness-110 transition"
                >
                  ✓ Aprobar
                </button>
                <button
                  onClick={() => rechazar(p.id)}
                  className="flex-1 p-2 rounded-xl bg-bad text-ink text-sm font-semibold hover:brightness-110 transition"
                >
                  ✕ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
