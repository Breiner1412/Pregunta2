import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'
import { ESQUEMA_DB } from './esquema'

// Cliente con la service_role: ignora RLS, así que solo debe usarse en el
// servidor (rutas de app/api) y nunca con datos sin validar. El import de
// 'server-only' hace fallar el build si algún componente de cliente lo importa.
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env()

  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: ESQUEMA_DB },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
