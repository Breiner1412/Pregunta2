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

- **La partida vive en el servidor.** El servidor sirve una pregunta a la vez, sin el campo `respuesta_correcta` (ver `PreguntaJuego` en `types/game.ts`), mide el tiempo con su propio reloj, corrige cada respuesta una sola vez y lleva vidas y puntaje (`api/partida`). El navegador solo dice qué opción eligió.
- **El puntaje solo lo escribe el servidor.** Las funciones de partida de `supabase/schema.sql` solo las puede ejecutar la `service_role`, y cada paso es una transacción. El navegador no tiene permiso para escribir partidas, puntajes ni el ranking.

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
git clone https://github.com/Breiner1412/Pregunta2.git
cd anime-trivia
npm install
```

Cree un archivo `.env.local` en la raíz:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # solo servidor
GEMINI_API_KEY=...
```

La URL y la key de Supabase están en **Project Settings → Data API** y
**→ API Keys** de su proyecto.

### Base de datos

> Todo vive en el esquema `trivia`, porque la base y el login (auth) se
> comparten con otra app. Por eso el script no crea triggers sobre
> `auth.users`, y si un usuario se elimina desde la otra app, sus datos
> de trivia se borran en cascada.

Ejecute el contenido completo de [`supabase/schema.sql`](./supabase/schema.sql)
en el **SQL Editor** de su proyecto de Supabase — crea todas las tablas,
políticas de seguridad (RLS) y funciones necesarias.

Hágase administrador para poder generar preguntas:

```sql
insert into trivia.admins (usuario_id)
select id from auth.users where email = 'su_correo@ejemplo.com'
on conflict do nothing;
```

El rol de admin vive en la tabla `trivia.admins`, no en el usuario de auth:
nadie puede escribirla desde el navegador.

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

## 🐳 Despliegue en la VM (Docker + Caddy)

La app corre en un contenedor (`docker-compose.yml`, servicio `pregunta2`)
sin puertos publicados: Caddy la alcanza por la red externa `proxy` en
`http://pregunta2:3000` y termina el HTTPS. Supabase es self-hosted en la
misma VM y se comparte con otra app.

### URL de Supabase: la pública, también en el servidor

El navegador y el servidor usan la **misma** `NEXT_PUBLIC_SUPABASE_URL`, la
pública que sirve Caddy (por ejemplo `https://supabase.tudominio.com`), y no
la URL interna de Docker (`http://kong:8000`). `@supabase/ssr` nombra la
cookie de sesión a partir del host de esa URL (`sb-<host>-auth-token`): si el
servidor usara otro host, no encontraría la sesión que guardó el navegador.

Por eso el contenedor tiene que poder resolver y alcanzar ese dominio
público desde la propia VM. Compruébelo con:

```bash
docker exec pregunta2 wget -qO- https://supabase.tudominio.com/auth/v1/health
```

Si falla (algunas redes no permiten que la VM se llame a sí misma por su IP
pública), agregue en `docker-compose.yml` un `extra_hosts` que apunte el
dominio al host, donde escucha Caddy:

```yaml
    extra_hosts:
      - "supabase.tudominio.com:host-gateway"
```

### Supabase self-hosted: exponer el esquema `trivia`

La API REST de Supabase (PostgREST) solo ve los esquemas listados en
`PGRST_DB_SCHEMAS`. Sin `trivia` ahí, todas las llamadas de la app fallan
con `406` / "Invalid schema". En el `.env` del Supabase self-hosted
(el `docker/.env` del repositorio de Supabase), **agregue** `trivia` sin
quitar los esquemas que ya usa la otra app:

```env
PGRST_DB_SCHEMAS=public,storage,graphql_public,trivia
```

Luego aplique `supabase/schema.sql` (ver "Base de datos") y reinicie el
servicio REST para que tome el cambio:

```bash
docker compose up -d rest
```

`schema.sql` ya otorga los permisos del esquema (`USAGE`, tablas y
funciones) a `anon`, `authenticated` y `service_role`, y al final pide a
PostgREST que recargue el esquema (`notify pgrst, 'reload schema'`).

## 📁 Estructura

```
app/
  jugar/                     → pantalla de juego
  ranking/                    → ranking global por categoría
  admin/preguntas/              → generar y revisar preguntas de IA
  api/
    partida/                      → inicia la partida, sirve preguntas y corrige respuestas
    admin/generar-preguntas/          → llama a Gemini y guarda preguntas sin revisar
lib/supabase/                  → clientes de Supabase (navegador / servidor / service_role)
supabase/schema.sql              → tablas, políticas RLS y funciones, listo para correr
```

## 🗺️ Roadmap

- [ ] Desplegar en producción (Vercel) y enlazar la demo en vivo
- [ ] Automatizar la generación de preguntas con un cron job
- [ ] Historial de partidas por usuario

## 👤 Autor

**[Tu nombre]** — [tu portafolio] · [LinkedIn] · [GitHub]

## Licencia

[MIT](./LICENSE)
