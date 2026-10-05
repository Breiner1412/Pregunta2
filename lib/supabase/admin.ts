import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { ESQUEMA_DB } from './esquema'

// Cliente con la service_role: ignora RLS, así que solo debe usarse en el
// servidor (rutas de app/api) y nunca con datos sin validar. El import de
// 'server-only' hace fallar el build si algún componente de cliente lo importa.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient<Database>(url, serviceRoleKey, {
    db: { schema: ESQUEMA_DB },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
