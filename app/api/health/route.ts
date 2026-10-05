import { NextResponse } from 'next/server'

// Chequeo de vida para Docker/Caddy: solo confirma que el servidor responde.
// No consulta Supabase, para que una caída de la base no haga reiniciar la app.
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } })
}
