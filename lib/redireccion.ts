const ORIGEN_FICTICIO = 'http://interno.invalid'

// Devuelve `valor` solo si es una ruta interna de la app (por ejemplo
// "/jugar?x=1"); si no, devuelve `porDefecto`. Evita redirecciones abiertas
// con valores como "//evil.com", "/\evil.com", "@evil.com" o "https://...".
export function rutaInternaSegura(valor: string | null | undefined, porDefecto = '/jugar'): string {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) {
    return porDefecto
  }
  // Sin caracteres de control (tabs o saltos de línea que el navegador ignora).
  if (/[\u0000-\u001f\u007f]/.test(valor)) return porDefecto

  try {
    const url = new URL(valor, ORIGEN_FICTICIO)
    if (url.origin !== ORIGEN_FICTICIO) return porDefecto
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return porDefecto
  }
}
