// URL pública de la app (por ejemplo https://trivia.tudominio.com), sin "/"
// final. Detrás de Caddy, request.url puede traer el host interno del
// contenedor (http://localhost:3000), así que los redirects se arman con
// esta variable. En desarrollo, si no está definida, se usa el origen recibido.
export function urlDelSitio(origenDeRespaldo: string): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configurada || origenDeRespaldo).replace(/\/+$/, '')
}
