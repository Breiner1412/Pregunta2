import type { NextConfig } from "next";

const esProduccion = process.env.NODE_ENV === "production";

// El navegador habla directo con Supabase (auth, ranking, categorías).
// NEXT_PUBLIC_SUPABASE_URL ya está definida al compilar (build arg).
function origenSupabase(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

// Next.js inserta scripts inline para hidratar la página, por eso
// script-src necesita 'unsafe-inline' (una CSP con nonces exigiría render
// dinámico en todas las páginas). En desarrollo, el recargado en caliente
// usa eval y websockets.
const politicaContenido = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esProduccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${origenSupabase()}${esProduccion ? "" : " ws:"}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(esProduccion ? ["upgrade-insecure-requests"] : []),
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: politicaContenido },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Solo en producción: Caddy sirve siempre por HTTPS.
  ...(esProduccion
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Genera .next/standalone con un server.js mínimo para la imagen Docker.
  output: "standalone",
  // No anunciar "X-Powered-By: Next.js".
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
