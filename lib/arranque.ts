import { env } from './env'

// Se importa una sola vez desde instrumentation.ts al iniciar el servidor.
// Si falta alguna variable de entorno, el proceso termina aquí con la lista
// de las que faltan: Docker lo muestra en los logs y no queda un servidor a
// medias respondiendo con errores.
try {
  env()
} catch (error) {
  console.error(`[arranque] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
