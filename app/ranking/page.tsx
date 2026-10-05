'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Categoria, PerfilRanking } from '@/types/game'

const TOP_N = 20

// Fila de mejores_puntajes con el perfil embebido; los tipos generados de
// Supabase ya la describen, así que no hace falta castear.
interface FilaEmbebida {
  usuario_id: string
  mejor_puntaje: number
  partidas_jugadas: number
  perfiles: { nombre_usuario: string } | null
}

function aEntrada(fila: FilaEmbebida): PerfilRanking {
  return {
    usuario_id: fila.usuario_id,
    mejor_puntaje: fila.mejor_puntaje,
    partidas_jugadas: fila.partidas_jugadas,
    nombre_usuario: fila.perfiles?.nombre_usuario ?? '???',
  }
}

export default function RankingPage() {
  const [supabase] = useState(createClient)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null) // null = Mezclado
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [ranking, setRanking] = useState<PerfilRanking[]>([])
  const [cargandoRanking, setCargandoRanking] = useState(true)
  const [propio, setPropio] = useState<PerfilRanking | null>(null)
  const [posicionPropia, setPosicionPropia] = useState<number | null>(null)

  useEffect(() => {
    async function cargarInicial() {
      const { data: cats } = await supabase
        .from('categorias')
        .select('id, nombre, slug, grupo')
        .eq('activa', true)
        .order('orden')
      if (cats) setCategorias(cats)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUsuarioId(user.id)
    }
    cargarInicial()
  }, [supabase])

  useEffect(() => {
    // Si el usuario cambia de categoría antes de que termine esta carga,
    // su resultado se descarta para no pisar el de la categoría nueva.
    let cancelado = false

    async function cargarRanking() {
      setCargandoRanking(true)
      setPropio(null)
      setPosicionPropia(null)

      let query = supabase
        .from('mejores_puntajes')
        .select('usuario_id, mejor_puntaje, partidas_jugadas, perfiles(nombre_usuario)')
        .order('mejor_puntaje', { ascending: false })
        .limit(TOP_N)

      query = categoriaActiva
        ? query.eq('categoria_id', categoriaActiva)
        : query.is('categoria_id', null)

      const { data } = await query
      const entradas = (data ?? []).map(aEntrada)

      if (cancelado) return
      setRanking(entradas)

      if (usuarioId) {
        const yaEsta = entradas.find((e) => e.usuario_id === usuarioId)
        if (yaEsta) {
          setPropio(yaEsta)
        } else {
          let queryPropio = supabase
            .from('mejores_puntajes')
            .select('usuario_id, mejor_puntaje, partidas_jugadas, perfiles(nombre_usuario)')
            .eq('usuario_id', usuarioId)

          queryPropio = categoriaActiva
            ? queryPropio.eq('categoria_id', categoriaActiva)
            : queryPropio.is('categoria_id', null)

          const { data: propioData } = await queryPropio.maybeSingle()
          if (cancelado) return

          if (propioData) {
            setPropio(aEntrada(propioData))

            const { data: posicion } = await supabase.rpc('obtener_posicion_categoria', {
              p_usuario: usuarioId,
              p_categoria: categoriaActiva ?? undefined,
            })
            if (cancelado) return
            if (typeof posicion === 'number') setPosicionPropia(posicion)
          }
        }
      }

      setCargandoRanking(false)
    }
    cargarRanking()

    return () => {
      cancelado = true
    }
  }, [supabase, categoriaActiva, usuarioId])

  function medalla(posicion: number) {
    if (posicion === 1) return '🥇'
    if (posicion === 2) return '🥈'
    if (posicion === 3) return '🥉'
    return null
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">🏆 Ranking</h1>
        <Link href="/jugar" className="text-accent hover:underline text-sm">
          ← Jugar
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-6 px-6">
        <button
          onClick={() => setCategoriaActiva(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
            categoriaActiva === null
              ? 'bg-brand text-paper'
              : 'bg-surface text-ink-soft border border-white/5'
          }`}
        >
          🎲 Mezclado
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoriaActiva(c.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              categoriaActiva === c.id
                ? 'bg-brand text-paper'
                : 'bg-surface text-ink-soft border border-white/5'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {cargandoRanking ? (
        <p className="text-ink-soft text-center py-10 font-mono text-sm">cargando ranking...</p>
      ) : ranking.length === 0 ? (
        <p className="text-ink-soft text-center py-10">
          Todavía nadie tiene puntaje en esta categoría. ¡Sé el primero!
        </p>
      ) : (
        <div className="space-y-2">
          {ranking.map((p, idx) => {
            const posicion = idx + 1
            const esUsuarioActual = usuarioId === p.usuario_id
            return (
              <div
                key={p.usuario_id}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  esUsuarioActual ? 'bg-brand/10 border-brand/40' : 'bg-surface border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 shrink-0 text-center font-mono font-bold text-ink-soft">
                    {medalla(posicion) || posicion}
                  </span>
                  <span className="font-medium text-paper truncate">
                    {p.nombre_usuario}
                    {esUsuarioActual && <span className="text-accent"> (tú)</span>}
                  </span>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="font-mono font-bold text-brand">{p.mejor_puntaje} pts</div>
                  <div className="text-xs text-ink-soft">{p.partidas_jugadas} partidas</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!cargandoRanking && propio && posicionPropia && (
        <div className="mt-6 p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 shrink-0 text-center font-mono font-bold text-ink-soft">
              #{posicionPropia}
            </span>
            <span className="font-medium text-paper truncate">{propio.nombre_usuario} (tú)</span>
          </div>
          <div className="text-right shrink-0 pl-2">
            <div className="font-mono font-bold text-brand">{propio.mejor_puntaje} pts</div>
            <div className="text-xs text-ink-soft">{propio.partidas_jugadas} partidas</div>
          </div>
        </div>
      )}

      {!cargandoRanking && !usuarioId && (
        <p className="text-center text-sm text-ink-soft mt-6">
          <Link href="/login" className="text-accent hover:underline">
            Inicia sesión
          </Link>{' '}
          para aparecer en el ranking.
        </p>
      )}
    </div>
  )
}
