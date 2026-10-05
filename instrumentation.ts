// Next.js llama a register() una vez al iniciar el servidor, antes de
// atender peticiones. La validación de variables de entorno solo corre en
// el runtime de Node (lib/arranque.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/arranque')
  }
}
