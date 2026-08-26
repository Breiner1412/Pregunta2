'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Modo = 'magic' | 'password'

const inputClass =
  'w-full p-3 rounded-xl bg-ink border border-white/10 text-paper placeholder:text-ink-soft focus:border-accent focus:outline-none transition'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [modo, setModo] = useState<Modo>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function enviarMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setCargando(false)
    if (error) {
      setError('No se pudo enviar el link. Intenta de nuevo.')
    } else {
      setEnviado(true)
    }
  }

  async function entrarConContrasena(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { error, data } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      setCargando(false)
      setError(
        'Correo o contraseña incorrectos. Si aún no configuraste una contraseña, usa "Link mágico".'
      )
      return
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    setCargando(false)
    router.replace(perfil ? '/jugar' : '/completar-perfil')
    router.refresh()
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto p-6 text-center mt-10 sm:mt-20">
        <div className="bg-surface border border-white/5 rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-4">📧 Revisa tu correo</h1>
          <p className="text-ink-soft">
            Te enviamos un link mágico a <strong className="text-paper">{email}</strong>. Ábrelo
            desde este mismo dispositivo para iniciar sesión.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-10 sm:mt-20">
      <h1 className="text-2xl font-bold mb-6 text-center">Iniciar sesión</h1>

      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
          <button
            onClick={() => {
              setModo('magic')
              setError('')
            }}
            className={`flex-1 p-2 text-sm font-medium transition ${
              modo === 'magic' ? 'bg-brand text-paper' : 'text-ink-soft hover:text-paper'
            }`}
          >
            Link mágico
          </button>
          <button
            onClick={() => {
              setModo('password')
              setError('')
            }}
            className={`flex-1 p-2 text-sm font-medium transition ${
              modo === 'password' ? 'bg-brand text-paper' : 'text-ink-soft hover:text-paper'
            }`}
          >
            Contraseña
          </button>
        </div>

        {modo === 'magic' ? (
          <>
            <p className="text-ink-soft text-center mb-6 text-sm">
              Te enviamos un link a tu correo, sin contraseña.
            </p>
            <form onSubmit={enviarMagicLink} className="space-y-4">
              <input
                type="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={cargando}
                className="w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                {cargando ? 'Enviando...' : 'Enviar link mágico'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-ink-soft text-center mb-6 text-sm">
              Entra directo, sin esperar el correo.
            </p>
            <form onSubmit={entrarConContrasena} className="space-y-4">
              <input
                type="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                required
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={cargando}
                className="w-full p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                {cargando ? 'Entrando...' : 'Iniciar sesión'}
              </button>
            </form>
            <p className="text-xs text-ink-soft text-center mt-3">
              ¿No configuraste contraseña todavía? Entra con &quot;Link mágico&quot; y configúrala
              luego en tu cuenta.
            </p>
          </>
        )}

        {error && <p className="text-bad text-sm text-center mt-4">{error}</p>}
      </div>

      <p className="text-center mt-6">
        <Link href="/jugar" className="text-accent hover:underline">
          Jugar sin cuenta →
        </Link>
      </p>
    </div>
  )
}
