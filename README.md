# 🎮 Anime Trivia

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Gemini](https://img.shields.io/badge/Gemini%20API-Structured%20Output-8E75B2?logo=googlegemini)

Juego de trivias en modo supervivencia con preguntas generadas por IA —
construido para explorar cómo integrar un modelo de lenguaje en un producto
pequeño de forma responsable: sin exponer respuestas al cliente, sin confiar
en el navegador para el puntaje, y con revisión humana antes de publicar
contenido generado.

<!-- Agregue aquí 2-3 capturas de pantalla o un GIF corto del juego.
     Recomendado: la selección de categorías, una pregunta en juego
     mostrando el anillo de tiempo, y el panel de revisión de IA. -->

🔗 **Demo en vivo:** _(agregar cuando esté desplegado en Vercel)_

## 🕹️ Qué es esto

Anime Trivia es un juego de preguntas con categorías de cultura general,
ciencia, deportes, música y temas geek (anime, manga, películas, cómics,
series). No tiene un número fijo de preguntas: se juega en **modo
supervivencia** con 3 vidas y dificultad progresiva, hasta equivocarse tres
veces o agotar las preguntas disponibles en esa categoría.

Lo construí como proyecto de portafolio para mostrar un caso de uso pequeño
y concreto de IA en producción — no un chatbot, sino un **generador de
contenido estructurado** integrado en un flujo real con revisión humana
antes de publicar.

## ✨ Características

- **Modo supervivencia**: 3 vidas, dificultad progresiva, sin límite fijo de preguntas.
- **15 segundos por pregunta**, con temporizador visual en forma de anillo.
- **8 categorías**, jugables por separado o mezcladas.
- **Generación de preguntas con IA** (Gemini): un panel de administrador genera lotes de preguntas por categoría y dificultad, pendientes de aprobación antes de entrar al juego.
- **Ranking global por categoría**: mejor puntaje individual, no acumulado — mide qué tan bien juegas, no cuánto has jugado.
- **Login opcional**: Magic Link o contraseña, o jugar como invitado.
- **Seguridad real, no aparente**: el navegador nunca recibe la respuesta correcta antes de responder, y el servidor recalcula el puntaje final de forma independiente.

## 🤖 Cómo funciona la generación de preguntas con IA

Esta es la parte que más quise cuidar:

1. Un administrador elige categoría, cantidad y (opcionalmente) dificultad desde `/admin/preguntas`.
2. El servidor arma un prompt con reglas explícitas — 4 opciones, evitar datos ambiguos, no repetir preguntas ya existentes en esa categoría — y lo envía a la API de Gemini pidiendo salida JSON con un **schema estricto** (`response_schema`). No se depende de que el modelo "prometa" devolver JSON válido: la API lo garantiza estructuralmente.
3. Cada pregunta generada se vuelve a validar en el servidor (4 opciones no vacías, índice de respuesta correcta dentro de rango, dificultad entre 1 y 5) antes de guardarse.
4. Las preguntas entran a la base marcadas `revisada: false` — **no son jugables todavía**.
5. El administrador las aprueba o rechaza una por una en el mismo panel. Solo las aprobadas entran a la rotación del juego.

Decidí **no generar preguntas en vivo durante la partida**, sino en lotes y
en segundo plano con revisión humana, por dos razones: evitar
latencia/costo en el momento de jugar, y — más importante — el riesgo real
de que un modelo alucine datos específicos (fechas, estudios de animación,
etc.) sin que nadie lo note antes de publicarse.

## 🔐 Decisiones de seguridad

Dos cosas que muchos tutoriales de "trivia con Next.js + Supabase" pasan
por alto:

- **La respuesta correcta nunca viaja al cliente antes de responder.** Las preguntas se sirven sin el campo `respuesta_correcta` (ver `PreguntaJuego` en `types/game.ts`); cada respuesta se valida contra la base de datos en `api/responder`, el único lugar que conoce la respuesta correcta — y se la revela al cliente *después* de que responde.
- **El puntaje final se recalcula por completo en el servidor** (`api/guardar-partida`) a partir de las respuestas crudas y los datos reales de la base — el cliente puede reportar lo que quiera, el servidor lo ignora y calcula la verdad desde cero antes de guardar nada.

## 🛠️ Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4** — sistema de diseño con tokens definidos en `@theme`
- **Supabase** — Postgres, Auth (Magic Link + contraseña), Row Level Security
- **Gemini API** (Google AI Studio) — generación de preguntas con salida JSON estructurada
- Desplegable en **Vercel**

## 🚀 Cómo correrlo localmente

### Requisitos

- Node.js 20.9+
- Una cuenta de [Supabase](https://supabase.com) (gratis)
- Una API key de [Google AI Studio](https://aistudio.google.com) (gratis, sin tarjeta — solo necesaria para generar preguntas nuevas)

### Instalación

```bash
git clone <url-de-este-repo>
cd anime-trivia
npm install
```

Cree un archivo `.env.local` en la raíz:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
GEMINI_API_KEY=...
```

La URL y la key de Supabase están en **Project Settings → Data API** y
**→ API Keys** de su proyecto.

### Base de datos

Ejecute el contenido completo de [`supabase/schema.sql`](./supabase/schema.sql)
en el **SQL Editor** de su proyecto de Supabase — crea todas las tablas,
políticas de seguridad (RLS) y funciones necesarias.

Hágase administrador para poder generar preguntas:

```sql
update perfiles set es_admin = true where nombre_usuario = 'su_usuario';
```

Configure en Supabase → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### Correr

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

> El servicio de correo por defecto de Supabase está limitado a 2 correos
> por hora — suficiente para probar, pero para uso real conviene configurar
> un SMTP propio en **Authentication → Emails**.

## 📁 Estructura

```
app/
  jugar/                     → pantalla de juego
  ranking/                    → ranking global por categoría
  admin/preguntas/              → generar y revisar preguntas de IA
  api/
    responder/                    → valida cada respuesta contra la base de datos
    guardar-partida/                → recalcula el puntaje final en el servidor
    admin/generar-preguntas/          → llama a Gemini y guarda preguntas sin revisar
lib/supabase/                  → clientes de Supabase (navegador / servidor)
supabase/schema.sql              → tablas, políticas RLS y funciones, listo para correr
```

## 🗺️ Roadmap

- [ ] PWA para instalación en móvil
- [ ] Automatizar la generación de preguntas con un cron job
- [ ] Historial de partidas por usuario

## 👤 Autor

**[Tu nombre]** — [tu portafolio] · [LinkedIn] · [GitHub]

## Licencia

[MIT](./LICENSE)
