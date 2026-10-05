# 🎮 Anime Trivia

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)
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

🔗 **Demo en vivo:** _(agregar cuando esté desplegado)_

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
- **La partida vive en el servidor**: el navegador nunca recibe la respuesta correcta antes de responder y no puede escribir puntajes; el servidor mide el tiempo y lleva vidas y puntaje.

## 🤖 Cómo funciona la generación de preguntas con IA

Esta es la parte que más quise cuidar:

1. Un administrador elige categoría, cantidad y (opcionalmente) dificultad desde `/admin/preguntas`. El servidor verifica que sea admin y reserva su cuota diaria (`IA_LIMITE_DIARIO`); solo puede haber una generación en curso por categoría.
2. El servidor arma un prompt con reglas explícitas — 4 opciones, evitar datos ambiguos, no repetir preguntas ya existentes en esa categoría — y lo envía a la API de Gemini (`GEMINI_MODEL`, con un timeout de 45 s) pidiendo salida JSON con un **schema estricto** (`response_schema`). No se depende de que el modelo "prometa" devolver JSON válido: la API lo garantiza estructuralmente.
3. Cada pregunta generada se vuelve a validar en el servidor con zod (4 opciones distintas y no vacías, textos de largo acotado, índice de respuesta correcta dentro de rango, dificultad entre 1 y 5) antes de guardarse. Si Gemini corta o bloquea la respuesta, el panel lo dice; las preguntas repetidas se ignoran.
4. Las preguntas entran a la base marcadas `revisada: false` — **no son jugables todavía**.
5. El administrador las aprueba o rechaza una por una en el mismo panel. Solo las aprobadas entran a la rotación del juego.

Decidí **no generar preguntas en vivo durante la partida**, sino en lotes y
en segundo plano con revisión humana, por dos razones: evitar
latencia/costo en el momento de jugar, y — más importante — el riesgo real
de que un modelo alucine datos específicos (fechas, estudios de animación,
etc.) sin que nadie lo note antes de publicarse.

## 🔐 Seguridad

La regla de fondo: **el navegador no es de confiar**. La anon key de Supabase
es pública, así que todo lo que importa se protege en la base (RLS y
permisos) o en el servidor, nunca solo en la interfaz.

### Partida y puntaje

- **La partida vive en el servidor** (`app/api/partida`). El servidor:
  - sirve una pregunta a la vez, sin el campo `respuesta_correcta` (ver `PreguntaJuego` en `types/game.ts`);
  - mide el tiempo con su propio reloj, con un margen para la latencia;
  - corrige cada respuesta una sola vez, solo si es la pregunta en juego;
  - lleva vidas y puntaje.

  El navegador solo dice qué opción eligió.
- **Solo el servidor escribe partidas, puntajes y ranking.** Las funciones
  que lo hacen (`iniciar_partida`, `servir_siguiente_pregunta`,
  `responder_pregunta`) solo las puede ejecutar la `service_role`, y cada
  paso es una transacción. Los roles `anon` y `authenticated` no tienen
  permiso de escritura sobre esas tablas.
- **Las respuestas correctas no se pueden leer** desde el navegador: la
  tabla `preguntas` solo es legible por admins.

### Admin

- El rol vive en la tabla **`trivia.admins`**, no en el usuario de auth
  (compartido con otra app). Nadie puede escribirla desde el navegador: los
  admins se agregan con SQL.
- `/admin` se verifica **en el servidor** (`app/admin/layout.tsx`).
  Generar, aprobar y rechazar preguntas pasan por rutas que vuelven a
  verificar el rol.

### Base compartida

- Todo vive en el esquema **`trivia`**. `schema.sql` revoca todos los
  permisos de `anon` y `authenticated` y otorga solo lo necesario:
  - lectura pública de categorías, perfiles y ranking;
  - escritura del propio perfil, y solo de columnas concretas;
  - lectura de las propias partidas.
- Un usuario de la otra app llega como `authenticated`. Lo más que puede
  hacer aquí es crearse un perfil y jugar: no puede tocar puntajes ni
  hacerse admin.
- No hay triggers sobre `auth.users`.

### Secretos y límites

- La `service_role` y la llave de Gemini solo existen en el servidor: van en
  variables sin `NEXT_PUBLIC_`, y el cliente de servicio
  (`lib/supabase/admin.ts`) está marcado `server-only`, así que el build
  falla si un componente de cliente lo importa.
- Las variables de entorno se validan al arrancar: si falta alguna, el
  proceso termina con la lista de las que faltan.
- **Límites de uso:**
  - cuota diaria de generaciones con IA por admin y lock por categoría (`trivia.uso_ia`);
  - rate limit en las rutas de partida;
  - limpieza automática de partidas abandonadas y de invitado.

### Entradas, errores y navegador

- Todo lo que entra a las rutas se valida con **zod**, igual que la
  respuesta de Gemini.
- Los errores internos (de Postgres o de Gemini) se registran en el
  servidor y al navegador llega un mensaje genérico.
- Los redirects del login solo aceptan rutas internas, y se arman con
  `NEXT_PUBLIC_SITE_URL` (detrás de Caddy, el host de la petición no es
  el público).
- Cabeceras de seguridad en todas las rutas: CSP, `X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS en producción.

### Límites conocidos

- El rate limit vive en memoria: vale por instancia y se reinicia con el
  contenedor. Alcanza para una sola VM; con varias réplicas haría falta un
  almacén compartido.
- La CSP permite scripts inline (`'unsafe-inline'`), que Next.js necesita
  para hidratar. Evitarlo exigiría nonces y render dinámico en todas las
  páginas.
- Jugando se ven las respuestas correctas *después* de responder (es parte
  del juego). Alguien con muchas partidas podría ir juntándolas; el rate
  limit lo frena, pero no lo impide.

## 🛠️ Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Tailwind CSS v4** — sistema de diseño con tokens definidos en `@theme`
- **Supabase** — Postgres, Auth (Magic Link + contraseña), Row Level Security
- **Gemini API** (Google AI Studio) — generación de preguntas con salida JSON estructurada
- **Docker** (imagen `standalone` de Next.js) detrás de **Caddy**, con Supabase self-hosted

## 🚀 Cómo correrlo localmente

### Requisitos

- Node.js 20.9+ (la imagen de Docker usa Node 22)
- Una cuenta de [Supabase](https://supabase.com) (gratis)
- Una API key de [Google AI Studio](https://aistudio.google.com) (gratis, sin tarjeta — solo necesaria para generar preguntas nuevas)

### Instalación

```bash
git clone https://github.com/Breiner1412/Pregunta2.git
cd Pregunta2
npm install
```

Copie [`.env.example`](./.env.example) como `.env.local` y complete los
valores (ahí está explicada cada variable). En desarrollo use
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Si falta alguna variable
obligatoria, el servidor no arranca y lista cuáles faltan.

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

Configure en Supabase → **Authentication → URL Configuration** (en el
Supabase self-hosted de la VM, vea "URLs de redirección del login"):

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### Tipos de la base

`types/database.ts` se genera a partir del esquema `trivia`. Si cambia
`supabase/schema.sql`, regenérelo contra cualquier Postgres donde lo haya
aplicado:

```bash
npx supabase gen types typescript --schema trivia \
  --db-url "postgresql://postgres:CLAVE@localhost:5432/postgres?sslmode=disable" \
  > types/database.ts
```

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

### Variables de entorno

| Variable | Dónde se usa | Cuándo |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador y servidor | build (arg) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | build (arg) |
| `NEXT_PUBLIC_SITE_URL` | redirects del login | build (arg) |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor | runtime |
| `GEMINI_API_KEY` | solo servidor | runtime |
| `GEMINI_MODEL` | solo servidor (opcional) | runtime |
| `IA_LIMITE_DIARIO` | solo servidor (opcional) | runtime |

Las `NEXT_PUBLIC_*` se incrustan en el JavaScript al compilar: si cambian,
reconstruya la imagen. Las demás se leen al arrancar el contenedor.

### Levantar la app

```bash
cp .env.example .env            # y complete los valores
docker network create proxy     # una sola vez, si Caddy aún no la creó
docker compose up -d --build
docker compose logs -f pregunta2
```

En el `Caddyfile`, apunte el dominio de la app al contenedor:

```caddy
trivia.tudominio.com {
	reverse_proxy pregunta2:3000
}
```

El contenedor tiene un healthcheck sobre `/api/health`.

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

### Supabase self-hosted: URLs de redirección del login

El auth (GoTrue) es compartido con la otra app, así que su `SITE_URL` puede
seguir siendo la de esa app. Lo que hace falta es que GoTrue **acepte** el
callback de esta: el magic link pide volver a
`NEXT_PUBLIC_SITE_URL/auth/callback`, y si esa URL no está permitida GoTrue
la ignora y manda al usuario al `SITE_URL` (la otra app). En el `.env` del
Supabase self-hosted, agréguela a la lista (separada por comas):

```env
ADDITIONAL_REDIRECT_URLS=https://otra-app.tudominio.com/**,https://trivia.tudominio.com/auth/callback
```

Reinicie el servicio de auth:

```bash
docker compose up -d auth
```

Para enviar los magic links también hace falta un SMTP propio en ese mismo
`.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`).

### Migrar los datos desde Supabase en la nube

[`scripts/migracion/migrar-datos.sh`](./scripts/migracion/migrar-datos.sh)
exporta con `pg_dump` las tablas del esquema `public` del proyecto en la
nube y las importa al esquema `trivia` del Supabase de la VM. Solo necesita
Docker (corre `pg_dump` y `psql` en un contenedor `postgres:17-alpine`).

1. Aplique antes `supabase/schema.sql` en el destino.
2. Consiga las dos conexiones:
   - **Origen (nube):** en el dashboard, **Connect → Session pooler**
     (sirve por IPv4), por ejemplo
     `postgresql://postgres.<ref>:<clave>@aws-0-<región>.pooler.supabase.com:5432/postgres`.
   - **Destino (VM):** el Postgres del Supabase self-hosted, por ejemplo
     `postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres`.
     Si su puerto 5432 pasa por Supavisor, el usuario es
     `postgres.<POOLER_TENANT_ID>`.
3. Ejecútelo desde la raíz del repo, en la VM:

```bash
ORIGEN_DB_URL='postgresql://...nube...' \
DESTINO_DB_URL='postgresql://...vm...' \
bash scripts/migracion/migrar-datos.sh
```

Qué hace:

- **Categorías:** se emparejan por `slug` con las que ya creó
  `schema.sql`, y se actualizan.
- **Preguntas:** conservan su id y su estado. Las generadas por IA sin
  revisar siguen pendientes en `/admin/preguntas`.
  - Se saltan las que no cumplen las restricciones (4 opciones, respuesta
    0–3, dificultad 1–5) y las que ya existen.
  - Al final muestra un resumen con cuántas había y cuántas entraron.
- **Una sola transacción:** si algo falla, el destino no cambia.
- **Idempotente:** se puede volver a correr sin duplicar nada.

Con `--con-perfiles` también migra perfiles, mejores puntajes y admins
(`es_admin` pasa a `trivia.admins`), pero **solo** de usuarios que ya
existan con el mismo id en el `auth.users` del Supabase nuevo; el resto
tendrá que volver a crear su perfil al entrar. El historial de partidas
no se migra.

Si el `localhost` de la VM no llega a la base (por ejemplo, porque Postgres
solo escucha en la red de Docker de Supabase), use
`DOCKER_RED=<red-de-supabase>` y el nombre del contenedor como host.

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
scripts/migracion/               → migración de datos desde Supabase en la nube
Dockerfile, docker-compose.yml   → imagen standalone y servicio detrás de Caddy
```

## 🗺️ Roadmap

- [ ] Desplegar en producción (VM con Docker + Caddy) y enlazar la demo en vivo
- [ ] Automatizar la generación de preguntas con un cron job
- [ ] Historial de partidas por usuario

## 👤 Autor

**[Tu nombre]** — [tu portafolio] · [LinkedIn] · [GitHub]

## Licencia

[MIT](./LICENSE)
