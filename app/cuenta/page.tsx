'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full p-3 rounded-xl bg-ink border border-white/10 text-paper placeholder:text-ink-soft focus:border-accent focus:outline-none transition'

export default function CuentaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [email, setEmail] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? '')

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('nombre_usuario')
        .eq('id', user.id)
        .maybeSingle()

      if (perfil) setNombreUsuario(perfil.nombre_usuario)
      setCargando(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardarPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    const { error: errorUpdate } = await supabase.auth.updateUser({ password })
    setGuardando(false)

    if (errorUpdate) {
      setError(`No se pudo guardar la contraseña: ${errorUpdate.message}`)
      return
    }

    setMensaje('Contraseña guardada. La próxima vez puedes entrar sin esperar el correo.')
    setPassword('')
    setPassword2('')
  }

  if (cargando) {
    return <div className="p-6 text-center mt-10 sm:mt-20 text-ink-soft">Cargando...</div>
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-10 sm:mt-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tu cuenta</h1>
        <Link href="/jugar" className="text-accent hover:underline text-sm">
          ← Jugar
        </Link>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="mb-6 text-sm text-ink-soft space-y-1 font-mono">
          <p>
            usuario: <span className="text-paper">{nombreUsuario}</span>
          </p>
          <p>
            correo: <span className="text-paper">{email}</span>
          </p>
        </div>

        <h2 className="text-lg font-semibold mb-2">Configurar contraseña</h2>
        <p className="text-sm text-ink-soft mb-4">
          Con una contraseña puedes entrar directo la próxima vez, sin esperar el correo.
        </p>

        <form onSubmit={guardarPassword} className="space-y-3">
          <input
            type="password"
            required
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            placeholder="Confirma la contraseña"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={guardando}
            className="w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
          {error && <p className="text-bad text-sm text-center">{error}</p>}
          {mensaje && <p className="text-ok text-sm text-center">{mensaje}</p>}
        </form>
      </div>
    </div>
  )
}
