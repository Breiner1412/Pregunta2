'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Categoria, Pregunta } from '@/types/game'

export default function AdminPreguntasPage() {
  const supabase = createClient()
  const router = useRouter()

  const [verificando, setVerificando] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [cantidad, setCantidad] = useState(10)
  const [dificultad, setDificultad] = useState('') // '' = todas

  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [pendientes, setPendientes] = useState<Pregunta[]>([])
  const [cargandoPendientes, setCargandoPendientes] = useState(true)

  useEffect(() => {
    async function verificar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfil?.es_admin) {
        router.replace('/jugar')
        return
      }

      setEsAdmin(true)
      setVerificando(false)
    }
    verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarPendientes = useCallback(async () => {
    const { data } = await supabase
      .from('preguntas')
      .select('id, categoria_id, pregunta, opciones, respuesta_correcta, dificultad')
      .eq('revisada', false)
      .order('created_at', { ascending: false })
    setPendientes(data ?? [])
    setCargandoPendientes(false)
  }, [supabase])

  useEffect(() => {
    if (!esAdmin) return

    async function cargarInicial() {
      const { data } = await supabase
        .from('preguntas')
        .select('id, categoria_id, pregunta, opciones, respuesta_correcta, dificultad')
        .eq('revisada', false)
        .order('created_at', { ascending: false })
      setPendientes(data ?? [])
      setCargandoPendientes(false)
    }
    cargarInicial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin])

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
        const detalle = data.detalle
          ? typeof data.detalle === 'string'
            ? data.detalle
            : JSON.stringify(data.detalle)
          : ''
        setMensaje(`Error: ${data.error ?? 'desconocido'}${detalle ? ` — ${detalle}` : ''}`)
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

  async function aprobar(id: string) {
    await supabase.from('preguntas').update({ revisada: true }).eq('id', id)
    setPendientes((prev) => prev.filter((p) => p.id !== id))
  }

  async function rechazar(id: string) {
    await supabase.from('preguntas').delete().eq('id', id)
    setPendientes((prev) => prev.filter((p) => p.id !== id))
  }

  function nombreCategoria(id: string) {
    return categorias.find((c) => c.id === id)?.nombre ?? '???'
  }

  if (verificando || !esAdmin) {
    return <div className="p-6 text-center mt-10 sm:mt-20 text-ink-soft">Verificando acceso...</div>
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
