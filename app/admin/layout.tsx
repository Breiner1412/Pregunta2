import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Todo lo que cuelga de /admin se protege aquí, en el servidor: sin sesión
// se va al login, y sin fila en trivia.admins se vuelve al juego.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: esAdmin } = await supabase.rpc('es_admin')
  if (esAdmin !== true) redirect('/jugar')

  return children
}
