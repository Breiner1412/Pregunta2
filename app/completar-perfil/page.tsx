'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function CompletarPerfilForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/jugar'

  const [cargando, setCargando] = useState(true)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function verificar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      // Si ya tiene perfil, no necesita estar aquí
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (perfil) {
        router.replace(next)
        return
      }

      setCargando(false)
    }
    verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const nombreLimpio = nombreUsuario.trim()

    if (nombreLimpio.length < 3 || nombreLimpio.length > 20) {
      setError('El nombre debe tener entre 3 y 20 caracteres.')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nombreLimpio)) {
      setError('Solo letras, números y guion bajo (_), sin espacios.')
      return
    }

    setGuardando(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    const { error: insertError } = await supabase.from('perfiles').insert({
      id: user.id,
      nombre_usuario: nombreLimpio,
    })

    setGuardando(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Ese nombre de usuario ya está en uso, elige otro.')
      } else {
        setError('Ocurrió un error al guardar tu perfil. Intenta de nuevo.')
      }
      return
    }

    router.replace(next)
  }

  if (cargando) {
    return <div className="p-6 text-center mt-10 sm:mt-20 text-ink-soft">Cargando...</div>
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-10 sm:mt-20">
      <h1 className="text-2xl font-bold mb-2 text-center">¡Casi listo! 🎮</h1>
      <p className="text-ink-soft text-center mb-6">
        Elige un nombre de usuario para el ranking global.
      </p>

      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <form onSubmit={guardarPerfil} className="space-y-4">
          <input
            type="text"
            required
            placeholder="TuNombreDeUsuario"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            className="w-full p-3 rounded-xl bg-ink border border-white/10 text-paper placeholder:text-ink-soft focus:border-accent focus:outline-none transition"
            maxLength={20}
          />
          <button
            type="submit"
            disabled={guardando}
            className="w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Continuar'}
          </button>
          {error && <p className="text-bad text-sm text-center">{error}</p>}
        </form>
      </div>
    </div>
  )
}

export default function CompletarPerfilPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-center mt-10 sm:mt-20 text-ink-soft">Cargando...</div>}
    >
      <CompletarPerfilForm />
    </Suspense>
  )
}
