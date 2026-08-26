'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Categoria, PreguntaJuego, EstadoJuego, RespuestaUsuario } from '@/types/game'

const DURACION_PREGUNTA_MS = 15000
const VIDAS_INICIALES = 3

type EstadoGuardado = 'idle' | 'guardando' | 'guardado' | 'error'
type MotivoFin = 'vidas' | 'preguntas' | null

function Corazon({ activo }: { activo: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-5 h-5 transition-colors ${activo ? 'text-brand' : 'text-white/15'}`}
      fill="currentColor"
    >
      <path d="M12 21s-6.7-4.35-9.33-8.2C.86 10.1 1.3 6.9 3.9 5.2 6.02 3.8 8.6 4.4 10 6.1L12 8.3l2-2.2c1.4-1.7 3.98-2.3 6.1-.9 2.6 1.7 3.04 4.9 1.23 7.6C18.7 16.65 12 21 12 21z" />
    </svg>
  )
}

function AnilloTiempo({ tiempoRestante, segundos }: { tiempoRestante: number; segundos: number }) {
  const radio = 26
  const circunferencia = 2 * Math.PI * radio
  const progreso = Math.max(0, Math.min(1, tiempoRestante / DURACION_PREGUNTA_MS))
  const offset = circunferencia * (1 - progreso)
  const urgente = segundos <= 5

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={radio} fill="none" strokeWidth="5" className="stroke-white/10" />
        <circle
          cx="32"
          cy="32"
          r={radio}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className={urgente ? 'stroke-bad' : 'stroke-accent'}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono font-bold text-lg ${
          urgente ? 'text-bad' : 'text-paper'
        }`}
      >
        {segundos}
      </span>
    </div>
  )
}

export default function JugarPage() {
  const supabase = createClient()

  const [estado, setEstado] = useState<EstadoJuego>('seleccion')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)

  const [preguntas, setPreguntas] = useState<PreguntaJuego[]>([])
  const [indiceActual, setIndiceActual] = useState(0)
  const [respuestas, setRespuestas] = useState<RespuestaUsuario[]>([])
  const [vidas, setVidas] = useState(VIDAS_INICIALES)
  const [motivoFin, setMotivoFin] = useState<MotivoFin>(null)

  const [tiempoRestante, setTiempoRestante] = useState(DURACION_PREGUNTA_MS)
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState<number | null>(null)
  const [respuestaCorrectaRevelada, setRespuestaCorrectaRevelada] = useState<number | null>(null)
  const [mostrandoResultadoPregunta, setMostrandoResultadoPregunta] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const respondiendoRef = useRef(false)

  const [inicioPregunta, setInicioPregunta] = useState<number>(0)
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle')
  const [resultadoFinal, setResultadoFinal] = useState<{ correctas: number; puntaje: number } | null>(
    null
  )

  const [usuario, setUsuario] = useState<{ id: string; nombreUsuario: string; esAdmin: boolean } | null>(
    null
  )
  const [cargandoSesion, setCargandoSesion] = useState(true)

  useEffect(() => {
    async function cargarCategorias() {
      const { data } = await supabase
        .from('categorias')
        .select('id, nombre, slug, grupo')
        .eq('activa', true)
        .order('orden')
      if (data) setCategorias(data)
    }
    cargarCategorias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function cargarSesion() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('nombre_usuario, es_admin')
          .eq('id', user.id)
          .maybeSingle()

        if (perfil) {
          setUsuario({ id: user.id, nombreUsuario: perfil.nombre_usuario, esAdmin: perfil.es_admin })
        }
      }
      setCargandoSesion(false)
    }
    cargarSesion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null)
  }

  async function guardarPartida(respuestasFinal: RespuestaUsuario[], categoriaId: string | null) {
    if (respuestasFinal.length === 0) return

    setEstadoGuardado('guardando')

    try {
      const res = await fetch('/api/guardar-partida', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          categoria_id: categoriaId,
          respuestas: respuestasFinal.map((r) => ({
            pregunta_id: r.pregunta_id,
            respuesta_dada: r.respuesta_dada,
            tiempo_respuesta_ms: r.tiempo_respuesta_ms,
          })),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setEstadoGuardado('error')
        return
      }

      setResultadoFinal({ correctas: data.correctas, puntaje: data.puntaje })
      setEstadoGuardado('guardado')
    } catch {
      setEstadoGuardado('error')
    }
  }

  async function iniciarPartida(categoriaId: string | null) {
    // Nunca se pide respuesta_correcta aquí: el navegador no debe conocerla
    // hasta después de responder cada pregunta.
    let query = supabase
      .from('preguntas')
      .select('id, categoria_id, pregunta, opciones, dificultad')
      .eq('activa', true)
      .eq('revisada', true)

    if (categoriaId) query = query.eq('categoria_id', categoriaId)

    const { data, error } = await query
    if (error || !data) return

    const porDificultad: Record<number, PreguntaJuego[]> = {}
    data.forEach((p) => {
      porDificultad[p.dificultad] = porDificultad[p.dificultad] || []
      porDificultad[p.dificultad].push(p)
    })

    const nivelesOrdenados = Object.keys(porDificultad)
      .map(Number)
      .sort((a, b) => a - b)

    const seleccionadas: PreguntaJuego[] = []
    let nivelIdx = 0
    let intentosSinExito = 0

    while (seleccionadas.length < data.length && nivelesOrdenados.length > 0) {
      const nivel = nivelesOrdenados[nivelIdx % nivelesOrdenados.length]
      const disponibles = porDificultad[nivel].filter(
        (p) => !seleccionadas.some((s) => s.id === p.id)
      )
      if (disponibles.length > 0) {
        const azar = disponibles[Math.floor(Math.random() * disponibles.length)]
        seleccionadas.push(azar)
        intentosSinExito = 0
      } else {
        intentosSinExito++
      }
      nivelIdx++
      if (intentosSinExito > nivelesOrdenados.length) break
    }

    setPreguntas(seleccionadas)
    setCategoriaSeleccionada(categoriaId)
    setIndiceActual(0)
    setRespuestas([])
    setVidas(VIDAS_INICIALES)
    setMotivoFin(null)
    setResultadoFinal(null)
    setEstadoGuardado('idle')
    setEstado('jugando')
    setInicioPregunta(Date.now())
    setTiempoRestante(DURACION_PREGUNTA_MS)
    setRespuestaSeleccionada(null)
    setRespuestaCorrectaRevelada(null)
    setMostrandoResultadoPregunta(false)
  }

  const registrarRespuesta = useCallback(
    async (indiceRespuesta: number | null) => {
      const preguntaActual = preguntas[indiceActual]
      if (!preguntaActual || mostrandoResultadoPregunta || respondiendoRef.current) return
      respondiendoRef.current = true
      setVerificando(true)

      const tiempoTranscurrido = Date.now() - inicioPregunta

      let esCorrecta = false
      let respuestaCorrectaServidor: number | null = null

      try {
        const res = await fetch('/api/responder', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pregunta_id: preguntaActual.id,
            respuesta_dada: indiceRespuesta,
          }),
        })
        const data = await res.json()
        esCorrecta = Boolean(data.correcta)
        respuestaCorrectaServidor = typeof data.respuesta_correcta === 'number' ? data.respuesta_correcta : null
      } catch {
        esCorrecta = false
      }

      setRespuestas((prev) => [
        ...prev,
        {
          pregunta_id: preguntaActual.id,
          respuesta_dada: indiceRespuesta,
          correcta: esCorrecta,
          tiempo_respuesta_ms: tiempoTranscurrido,
          dificultad_en_momento: preguntaActual.dificultad,
        },
      ])

      if (!esCorrecta) {
        setVidas((v) => v - 1)
      }

      setRespuestaCorrectaRevelada(respuestaCorrectaServidor)
      setRespuestaSeleccionada(indiceRespuesta)
      setMostrandoResultadoPregunta(true)
      setVerificando(false)
      respondiendoRef.current = false
    },
    [preguntas, indiceActual, inicioPregunta, mostrandoResultadoPregunta]
  )

  useEffect(() => {
    if (estado !== 'jugando' || mostrandoResultadoPregunta) return

    const intervalo = setInterval(() => {
      const restante = DURACION_PREGUNTA_MS - (Date.now() - inicioPregunta)
      if (restante <= 0) {
        setTiempoRestante(0)
        registrarRespuesta(null)
      } else {
        setTiempoRestante(restante)
      }
    }, 100)

    return () => clearInterval(intervalo)
  }, [estado, inicioPregunta, mostrandoResultadoPregunta, registrarRespuesta])

  function siguientePregunta() {
    if (vidas <= 0) {
      setMotivoFin('vidas')
      setEstado('resultado')
      guardarPartida(respuestas, categoriaSeleccionada)
      return
    }
    if (indiceActual + 1 >= preguntas.length) {
      setMotivoFin('preguntas')
      setEstado('resultado')
      guardarPartida(respuestas, categoriaSeleccionada)
      return
    }
    setIndiceActual((i) => i + 1)
    setInicioPregunta(Date.now())
    setTiempoRestante(DURACION_PREGUNTA_MS)
    setRespuestaSeleccionada(null)
    setRespuestaCorrectaRevelada(null)
    setMostrandoResultadoPregunta(false)
  }

  if (estado === 'seleccion') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6 text-sm">
          <Link href="/ranking" className="text-accent hover:underline">
            🏆 Ver ranking
          </Link>
          {!cargandoSesion &&
            (usuario ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
                {usuario.esAdmin && (
                  <Link href="/admin/preguntas" className="text-accent hover:underline">
                    ⚙️ Admin
                  </Link>
                )}
                <strong className="text-paper">{usuario.nombreUsuario}</strong>
                <Link href="/cuenta" className="text-accent hover:underline">
                  Cuenta
                </Link>
                <button onClick={cerrarSesion} className="text-accent hover:underline">
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-accent hover:underline">
                Iniciar sesión para guardar tu ranking →
              </Link>
            ))}
        </div>
        <h1 className="text-3xl font-bold mb-2">Elige una categoría</h1>
        <p className="text-sm text-ink-soft mb-6">
          Tienes {VIDAS_INICIALES} vidas — la partida sigue hasta que te equivoques{' '}
          {VIDAS_INICIALES} veces o se acaben las preguntas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => iniciarPartida(null)}
            className="col-span-2 p-4 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition shadow-[0_0_25px_-10px_rgba(255,61,113,0.6)]"
          >
            🎲 Mezclado (todas las categorías)
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => iniciarPartida(c.id)}
              className="p-4 rounded-xl bg-surface border border-white/5 text-paper font-medium hover:border-accent/50 transition text-left"
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (estado === 'jugando') {
    const pregunta = preguntas[indiceActual]

    if (!pregunta) {
      return (
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-ink-soft">Esta categoría todavía no tiene preguntas cargadas.</p>
          <button
            onClick={() => setEstado('seleccion')}
            className="mt-4 px-6 py-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition"
          >
            Volver
          </button>
        </div>
      )
    }

    const segundos = Math.ceil(tiempoRestante / 1000)

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="font-mono text-xs text-ink-soft uppercase tracking-wide mb-1">
              Pregunta {indiceActual + 1} · Dif. {String(pregunta.dificultad).padStart(2, '0')}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: VIDAS_INICIALES }).map((_, i) => (
                <Corazon key={i} activo={i < vidas} />
              ))}
            </div>
          </div>
          <AnilloTiempo tiempoRestante={tiempoRestante} segundos={segundos} />
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-6 mb-4">
          <h2 className="text-xl font-semibold">{pregunta.pregunta}</h2>
        </div>

        <div className="grid gap-3">
          {pregunta.opciones.map((opcion, idx) => {
            let estilo = 'bg-surface border border-white/5 hover:border-accent/50 text-paper'
            if (mostrandoResultadoPregunta) {
              if (idx === respuestaCorrectaRevelada) estilo = 'bg-ok text-ink font-semibold'
              else if (idx === respuestaSeleccionada) estilo = 'bg-bad text-ink font-semibold'
              else estilo = 'bg-surface border border-white/5 text-ink-soft opacity-50'
            }
            return (
              <button
                key={idx}
                disabled={mostrandoResultadoPregunta || verificando}
                onClick={() => registrarRespuesta(idx)}
                className={`p-4 rounded-xl text-left font-medium transition-colors ${estilo}`}
              >
                {opcion}
              </button>
            )
          })}
        </div>

        {verificando && !mostrandoResultadoPregunta && (
          <p className="text-center text-sm text-ink-soft mt-4 font-mono">verificando...</p>
        )}

        {mostrandoResultadoPregunta && (
          <button
            onClick={siguientePregunta}
            className="mt-6 w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition"
          >
            {vidas <= 0 || indiceActual + 1 >= preguntas.length
              ? 'Ver resultados'
              : 'Siguiente pregunta'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-bold mb-2">
        {motivoFin === 'preguntas' ? '¡Te acabaste todas las preguntas! 🎉' : '¡Partida terminada!'}
      </h1>
      <p className="text-ink-soft mb-6">
        {motivoFin === 'vidas'
          ? 'Te quedaste sin vidas.'
          : 'No quedan más preguntas en esta categoría por ahora.'}
      </p>

      <div className="bg-surface border border-white/5 rounded-2xl p-8 mb-6">
        {estadoGuardado === 'guardando' || !resultadoFinal ? (
          <p className="text-ink-soft font-mono">calculando resultado...</p>
        ) : (
          <>
            <p className="text-ink-soft mb-2">
              {resultadoFinal.correctas} correctas de {respuestas.length} respondidas
            </p>
            <p className="font-mono text-5xl font-bold text-brand [text-shadow:0_0_30px_rgba(255,61,113,0.4)]">
              {resultadoFinal.puntaje}
            </p>
            <p className="text-xs text-ink-soft uppercase tracking-wide mt-1">puntos</p>
          </>
        )}

        <p className="text-sm text-ink-soft mt-4 min-h-[20px]">
          {estadoGuardado === 'guardado' &&
            (usuario
              ? 'Guardado en tu cuenta ✓'
              : 'Partida guardada como invitado (no suma al ranking)')}
          {estadoGuardado === 'error' && 'No se pudo guardar la partida, pero puedes seguir jugando.'}
        </p>
      </div>

      <button
        onClick={() => setEstado('seleccion')}
        className="px-6 py-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition"
      >
        Jugar de nuevo
      </button>
    </div>
  )
}
