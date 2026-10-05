'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type {
  Categoria,
  PreguntaJuego,
  EstadoJuego,
  PasoPartida,
  PartidaIniciada,
  RespuestaVerificada,
  ResultadoPartida,
} from '@/types/game'

const DURACION_PREGUNTA_MS = 15000
const VIDAS_INICIALES = 3

type MotivoFin = 'vidas' | 'preguntas' | null

async function postJson<T>(url: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

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

  // La partida vive en el servidor: aquí solo se refleja lo que él responde.
  const [partidaId, setPartidaId] = useState<string | null>(null)
  const [pregunta, setPregunta] = useState<PreguntaJuego | null>(null)
  const [numeroPregunta, setNumeroPregunta] = useState(1)
  const [vidas, setVidas] = useState(VIDAS_INICIALES)
  const [puntaje, setPuntaje] = useState(0)
  const [motivoFin, setMotivoFin] = useState<MotivoFin>(null)
  const [resultadoFinal, setResultadoFinal] = useState<ResultadoPartida | null>(null)
  const [resultadoPendiente, setResultadoPendiente] = useState<ResultadoPartida | null>(null)

  const [tiempoRestante, setTiempoRestante] = useState(DURACION_PREGUNTA_MS)
  const [inicioPregunta, setInicioPregunta] = useState<number>(0)
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState<number | null>(null)
  const [respuestaCorrectaRevelada, setRespuestaCorrectaRevelada] = useState<number | null>(null)
  const [mostrandoResultadoPregunta, setMostrandoResultadoPregunta] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errorJuego, setErrorJuego] = useState('')
  const respondiendoRef = useRef(false)
  const tiempoAgotadoEnviadoRef = useRef(false)

  const [usuario, setUsuario] = useState<{ id: string; nombreUsuario: string; esAdmin: boolean } | null>(
    null
  )
  const [cargandoSesion, setCargandoSesion] = useState(true)
  // Sesión iniciada pero sin perfil de trivia (por ejemplo, alguien que viene
  // de la otra app): juega como invitado hasta que complete su perfil.
  const [sinPerfil, setSinPerfil] = useState(false)

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
        const [{ data: perfil }, { data: esAdmin }] = await Promise.all([
          supabase.from('perfiles').select('nombre_usuario').eq('id', user.id).maybeSingle(),
          supabase.rpc('es_admin'),
        ])

        if (perfil) {
          setUsuario({ id: user.id, nombreUsuario: perfil.nombre_usuario, esAdmin: esAdmin === true })
        } else {
          setSinPerfil(true)
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
    setSinPerfil(false)
  }

  function finalizar(resultado: ResultadoPartida, motivo: MotivoFin) {
    setResultadoFinal(resultado)
    setMotivoFin(motivo)
    setEstado('resultado')
  }

  function aplicarPaso(paso: PasoPartida) {
    if (paso.terminada) {
      // Sin ninguna respuesta: la categoría no tenía preguntas.
      if (paso.resultado.total_respondidas === 0) {
        setPregunta(null)
        return
      }
      finalizar(paso.resultado, 'preguntas')
      return
    }

    setPregunta(paso.pregunta)
    setNumeroPregunta(paso.numero)
    setVidas(paso.vidas)
    setPuntaje(paso.puntaje)
    setInicioPregunta(Date.now())
    setTiempoRestante(DURACION_PREGUNTA_MS)
    setRespuestaSeleccionada(null)
    setRespuestaCorrectaRevelada(null)
    setMostrandoResultadoPregunta(false)
    tiempoAgotadoEnviadoRef.current = false
  }

  async function iniciarPartida(categoriaId: string | null) {
    if (cargando) return
    setCargando(true)
    setErrorJuego('')

    try {
      const partida = await postJson<PartidaIniciada>('/api/partida', { categoria_id: categoriaId })
      setPartidaId(partida.partida_id)
      setMotivoFin(null)
      setResultadoFinal(null)
      setResultadoPendiente(null)
      setEstado('jugando')
      aplicarPaso(partida)
    } catch {
      setErrorJuego('No se pudo iniciar la partida. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const registrarRespuesta = useCallback(
    async (indiceRespuesta: number | null) => {
      if (!pregunta || !partidaId || mostrandoResultadoPregunta || respondiendoRef.current) return
      respondiendoRef.current = true
      setVerificando(true)
      setErrorJuego('')

      try {
        const verificada = await postJson<RespuestaVerificada>('/api/partida/responder', {
          partida_id: partidaId,
          pregunta_id: pregunta.id,
          respuesta_dada: indiceRespuesta,
        })
        setVidas(verificada.vidas)
        setPuntaje(verificada.puntaje)
        setRespuestaCorrectaRevelada(verificada.respuesta_correcta)
        setRespuestaSeleccionada(indiceRespuesta)
        setResultadoPendiente(verificada.terminada ? verificada.resultado : null)
        setMostrandoResultadoPregunta(true)
      } catch {
        // No se descuenta ninguna vida: la pregunta sigue en juego en el servidor.
        setErrorJuego('No se pudo verificar tu respuesta. Toca una opción para reintentar.')
      } finally {
        setVerificando(false)
        respondiendoRef.current = false
      }
    },
    [pregunta, partidaId, mostrandoResultadoPregunta]
  )

  useEffect(() => {
    if (estado !== 'jugando' || !pregunta || mostrandoResultadoPregunta) return

    const intervalo = setInterval(() => {
      const restante = DURACION_PREGUNTA_MS - (Date.now() - inicioPregunta)
      if (restante > 0) {
        setTiempoRestante(restante)
        return
      }
      setTiempoRestante(0)
      // Se avisa al servidor una sola vez; si falla, el jugador reintenta tocando una opción.
      if (!tiempoAgotadoEnviadoRef.current) {
        tiempoAgotadoEnviadoRef.current = true
        registrarRespuesta(null)
      }
    }, 100)

    return () => clearInterval(intervalo)
  }, [estado, pregunta, inicioPregunta, mostrandoResultadoPregunta, registrarRespuesta])

  async function siguientePregunta() {
    if (resultadoPendiente) {
      finalizar(resultadoPendiente, 'vidas')
      return
    }
    if (!partidaId || cargando) return

    setCargando(true)
    setErrorJuego('')
    try {
      aplicarPaso(await postJson<PasoPartida>('/api/partida/siguiente', { partida_id: partidaId }))
    } catch {
      setErrorJuego('No se pudo cargar la siguiente pregunta. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
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
            ) : sinPerfil ? (
              <Link href="/completar-perfil" className="text-accent hover:underline">
                Completa tu perfil para guardar tu ranking →
              </Link>
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
        {errorJuego && <p className="text-sm text-bad mb-4">{errorJuego}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => iniciarPartida(null)}
            disabled={cargando}
            className="col-span-2 p-4 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition shadow-[0_0_25px_-10px_rgba(255,61,113,0.6)] disabled:opacity-50"
          >
            🎲 Mezclado (todas las categorías)
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => iniciarPartida(c.id)}
              disabled={cargando}
              className="p-4 rounded-xl bg-surface border border-white/5 text-paper font-medium hover:border-accent/50 transition text-left disabled:opacity-50"
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (estado === 'jugando') {
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
              Pregunta {numeroPregunta} · Dif. {String(pregunta.dificultad).padStart(2, '0')} · {puntaje} pts
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

        {errorJuego && <p className="text-center text-sm text-bad mt-4">{errorJuego}</p>}

        {mostrandoResultadoPregunta && (
          <button
            onClick={siguientePregunta}
            disabled={cargando}
            className="mt-6 w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
          >
            {resultadoPendiente ? 'Ver resultados' : 'Siguiente pregunta'}
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
        {resultadoFinal && (
          <>
            <p className="text-ink-soft mb-2">
              {resultadoFinal.correctas} correctas de {resultadoFinal.total_respondidas} respondidas
            </p>
            <p className="font-mono text-5xl font-bold text-brand [text-shadow:0_0_30px_rgba(255,61,113,0.4)]">
              {resultadoFinal.puntaje}
            </p>
            <p className="text-xs text-ink-soft uppercase tracking-wide mt-1">puntos</p>
          </>
        )}

        <p className="text-sm text-ink-soft mt-4 min-h-[20px]">
          {usuario
            ? 'Guardado en tu cuenta ✓'
            : sinPerfil
              ? 'Sin perfil de trivia: esta partida no suma al ranking'
              : 'Partida de invitado (no suma al ranking)'}
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
