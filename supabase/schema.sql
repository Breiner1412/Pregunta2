-- ============================================================
-- Migración de la base de datos de Anime Trivia.
--
-- Todo vive en el esquema "trivia" (no en public), porque la base
-- se comparte con otra app. El script es idempotente: se puede
-- correr más de una vez sin romper nada ni duplicar datos.
--
-- Después de correrlo, agregue "trivia" a PGRST_DB_SCHEMAS en el
-- Supabase self-hosted para que la API REST lo exponga.
--
-- Auth compartido: auth.users es común a esta app y a la otra.
--   * No se crea NINGÚN trigger sobre auth.users: se dispararía con
--     cada registro de la otra app. El perfil de trivia lo crea el
--     propio usuario al entrar por primera vez (completar-perfil).
--   * trivia.perfiles referencia auth.users con on delete cascade: si
--     un usuario se elimina desde la otra app, también se borran su
--     perfil, sus partidas y su ranking aquí.
-- ============================================================

create schema if not exists trivia;


-- ============================================
-- Tablas
-- ============================================

create table if not exists trivia.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique not null,
  grupo text not null default 'general',
  activa boolean default true,
  orden integer default 0,
  created_at timestamptz default now()
);

create table if not exists trivia.preguntas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references trivia.categorias(id) on delete cascade,
  pregunta text not null,
  opciones jsonb not null,
  respuesta_correcta integer not null,
  dificultad integer not null default 1 check (dificultad between 1 and 5),
  generada_por_ia boolean default false,
  revisada boolean default true,
  veces_usada integer default 0,
  activa boolean default true,
  created_at timestamptz default now()
);

create table if not exists trivia.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_usuario text unique not null,
  avatar_url text,
  puntaje_total integer default 0,
  partidas_jugadas integer default 0,
  created_at timestamptz default now()
);

-- El rol de admin NO sale de auth (que es compartido con la otra app),
-- sino de esta tabla. Nadie puede escribirla desde el navegador: los
-- admins se agregan a mano con SQL (ver el final del archivo).
create table if not exists trivia.admins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists trivia.partidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references trivia.perfiles(id) on delete set null,
  modo text not null default 'mixto',
  categoria_id uuid references trivia.categorias(id) on delete set null,
  puntaje integer not null default 0,
  preguntas_correctas integer default 0,
  preguntas_totales integer default 0,
  finalizada boolean default false,
  created_at timestamptz default now()
);

create table if not exists trivia.respuestas_partida (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references trivia.partidas(id) on delete cascade,
  pregunta_id uuid references trivia.preguntas(id) on delete set null,
  respuesta_dada integer,
  correcta boolean not null,
  tiempo_respuesta_ms integer,
  dificultad_en_momento integer not null,
  created_at timestamptz default now()
);

-- categoria_id = null representa el modo "Mezclado". Se usa un índice
-- único con coalesce porque en SQL, NULL nunca es "igual" a otro NULL,
-- así que un unique(usuario_id, categoria_id) normal NO evitaría filas
-- duplicadas para el modo Mezclado.
create table if not exists trivia.mejores_puntajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references trivia.perfiles(id) on delete cascade,
  categoria_id uuid references trivia.categorias(id) on delete cascade,
  mejor_puntaje integer not null default 0,
  partidas_jugadas integer not null default 0,
  updated_at timestamptz default now()
);


-- ============================================
-- Índices
-- ============================================

create index if not exists idx_preguntas_categoria_dificultad
  on trivia.preguntas (categoria_id, dificultad) where activa = true;
create index if not exists idx_perfiles_puntaje on trivia.perfiles (puntaje_total desc);
create index if not exists idx_partidas_usuario on trivia.partidas (usuario_id);

create unique index if not exists idx_mejores_puntajes_usuario_categoria
  on trivia.mejores_puntajes (usuario_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_mejores_puntajes_ranking
  on trivia.mejores_puntajes (categoria_id, mejor_puntaje desc);

-- Evita duplicar preguntas (y hace que las semillas sean idempotentes).
create unique index if not exists idx_preguntas_categoria_texto
  on trivia.preguntas (categoria_id, pregunta);


-- ============================================
-- Funciones
-- ============================================
-- Todas fijan search_path vacío y califican cada nombre, para que no
-- dependan del search_path de quien las llama.

-- ¿El usuario de la sesión actual es admin de trivia? Es security definer
-- para poder usarse dentro de las políticas sin abrir la tabla admins.
create or replace function trivia.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from trivia.admins where usuario_id = (select auth.uid())
  );
$$;

-- Registra el puntaje solo si es un nuevo récord para esa categoría
-- (o modo Mezclado si p_categoria es null), y siempre suma la partida jugada.
create or replace function trivia.registrar_mejor_puntaje(p_usuario uuid, p_categoria uuid, p_puntaje int)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into trivia.mejores_puntajes (usuario_id, categoria_id, mejor_puntaje, partidas_jugadas)
  values (p_usuario, p_categoria, p_puntaje, 1)
  on conflict (usuario_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set
    mejor_puntaje = greatest(trivia.mejores_puntajes.mejor_puntaje, excluded.mejor_puntaje),
    partidas_jugadas = trivia.mejores_puntajes.partidas_jugadas + 1,
    updated_at = now();
$$;

-- Posición exacta de un usuario dentro de una categoría (o Mezclado)
create or replace function trivia.obtener_posicion_categoria(p_usuario uuid, p_categoria uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select (count(*) + 1)::int
  from trivia.mejores_puntajes
  where coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
    and mejor_puntaje > (
      select mejor_puntaje from trivia.mejores_puntajes
      where usuario_id = p_usuario
        and coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
    );
$$;


-- ============================================
-- Row Level Security
-- ============================================

alter table trivia.categorias enable row level security;

drop policy if exists "Categorías son públicas para lectura" on trivia.categorias;
create policy "Categorías son públicas para lectura"
on trivia.categorias for select
using (true);

alter table trivia.admins enable row level security;

drop policy if exists "Cada usuario ve solo su propia fila de admin" on trivia.admins;
create policy "Cada usuario ve solo su propia fila de admin"
on trivia.admins for select
using ((select auth.uid()) = usuario_id);

alter table trivia.perfiles enable row level security;

drop policy if exists "Perfiles son públicos para lectura" on trivia.perfiles;
create policy "Perfiles son públicos para lectura"
on trivia.perfiles for select
using (true);

drop policy if exists "Usuarios pueden crear su propio perfil" on trivia.perfiles;
create policy "Usuarios pueden crear su propio perfil"
on trivia.perfiles for insert
with check ((select auth.uid()) = id);

drop policy if exists "Usuarios pueden actualizar su propio perfil" on trivia.perfiles;
create policy "Usuarios pueden actualizar su propio perfil"
on trivia.perfiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

alter table trivia.partidas enable row level security;

drop policy if exists "Cada usuario ve solo sus partidas" on trivia.partidas;
create policy "Cada usuario ve solo sus partidas"
on trivia.partidas for select
using ((select auth.uid()) = usuario_id);

alter table trivia.respuestas_partida enable row level security;

drop policy if exists "Cada usuario ve solo las respuestas de sus partidas" on trivia.respuestas_partida;
create policy "Cada usuario ve solo las respuestas de sus partidas"
on trivia.respuestas_partida for select
using (
  exists (
    select 1 from trivia.partidas p
    where p.id = partida_id and p.usuario_id = (select auth.uid())
  )
);

alter table trivia.mejores_puntajes enable row level security;

drop policy if exists "Mejores puntajes son públicos para lectura" on trivia.mejores_puntajes;
create policy "Mejores puntajes son públicos para lectura"
on trivia.mejores_puntajes for select
using (true);

drop policy if exists "Usuarios pueden insertar su propio mejor puntaje" on trivia.mejores_puntajes;
create policy "Usuarios pueden insertar su propio mejor puntaje"
on trivia.mejores_puntajes for insert
with check ((select auth.uid()) = usuario_id);

drop policy if exists "Usuarios pueden actualizar su propio mejor puntaje" on trivia.mejores_puntajes;
create policy "Usuarios pueden actualizar su propio mejor puntaje"
on trivia.mejores_puntajes for update
using ((select auth.uid()) = usuario_id);

alter table trivia.preguntas enable row level security;

drop policy if exists "Preguntas son públicas para lectura" on trivia.preguntas;
create policy "Preguntas son públicas para lectura"
on trivia.preguntas for select
using (true);

drop policy if exists "Solo administradores pueden insertar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden insertar preguntas"
on trivia.preguntas for insert
with check (
  (select trivia.es_admin())
);

drop policy if exists "Solo administradores pueden actualizar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden actualizar preguntas"
on trivia.preguntas for update
using (
  (select trivia.es_admin())
);

drop policy if exists "Solo administradores pueden eliminar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden eliminar preguntas"
on trivia.preguntas for delete
using (
  (select trivia.es_admin())
);


-- ============================================
-- Permisos
-- ============================================
-- Un esquema nuevo no hereda los permisos por defecto que Supabase da
-- en public, así que se otorgan de forma explícita.

grant usage on schema trivia to anon, authenticated, service_role;

grant all on all tables in schema trivia to anon, authenticated, service_role;
grant execute on all functions in schema trivia to anon, authenticated, service_role;

-- La lista de admins nunca se escribe desde el navegador.
revoke insert, update, delete, truncate on trivia.admins from anon, authenticated;

-- Del perfil, el usuario solo puede escribir sus datos públicos. Los
-- contadores (puntaje_total, partidas_jugadas) los mueve el servidor.
revoke insert, update, delete, truncate on trivia.perfiles from anon, authenticated;
grant insert (id, nombre_usuario, avatar_url) on trivia.perfiles to authenticated;
grant update (nombre_usuario, avatar_url) on trivia.perfiles to authenticated;

-- Las categorías solo se leen desde el navegador.
revoke insert, update, delete, truncate on trivia.categorias from anon, authenticated;

-- Las partidas y sus respuestas solo las escribe el servidor (service_role).
revoke insert, update, delete, truncate on trivia.partidas, trivia.respuestas_partida
  from anon, authenticated;


-- ============================================
-- Datos iniciales
-- ============================================

insert into trivia.categorias (nombre, slug, grupo, orden) values
  ('Cultura General', 'cultura-general', 'general', 1),
  ('Ciencia', 'ciencia', 'general', 2),
  ('Deportes', 'deportes', 'general', 3),
  ('Música', 'musica', 'general', 4),
  ('Anime y Manga', 'anime-manga', 'geek', 5),
  ('Películas', 'peliculas', 'geek', 6),
  ('Cómics', 'comics', 'geek', 7),
  ('Series', 'series', 'geek', 8)
on conflict (slug) do nothing;

insert into trivia.preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select c.id, v.pregunta, v.opciones::jsonb, v.respuesta_correcta, v.dificultad
from (values
  ('cultura-general', '¿Cuál es la capital de Australia?', '["Sídney", "Melbourne", "Canberra", "Perth"]', 2, 1),
  ('cultura-general', '¿En qué año cayó el Muro de Berlín?', '["1987", "1989", "1991", "1993"]', 1, 2),
  ('cultura-general', '¿Cuál es el río más largo del mundo?', '["Nilo", "Amazonas", "Yangtsé", "Misisipi"]', 1, 3),
  ('ciencia', '¿Cuál es el planeta más cercano al Sol?', '["Venus", "Mercurio", "Marte", "Tierra"]', 1, 1),
  ('ciencia', '¿Cuál es el símbolo químico del oro?', '["Go", "Au", "Ag", "Or"]', 1, 2),
  ('ciencia', '¿Qué partícula subatómica tiene carga negativa?', '["Protón", "Neutrón", "Electrón", "Fotón"]', 2, 3),
  ('deportes', '¿Cada cuántos años se celebran los Juegos Olímpicos de verano?', '["2", "3", "4", "5"]', 2, 1),
  ('deportes', '¿Qué país ha ganado más Copas del Mundo de fútbol?', '["Alemania", "Argentina", "Brasil", "Italia"]', 2, 2),
  ('musica', '¿Qué banda interpretó "Bohemian Rhapsody"?', '["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"]', 1, 1),
  ('musica', '¿Cuántas cuerdas tiene una guitarra estándar?', '["4", "5", "6", "7"]', 2, 1),
  ('anime-manga', '¿Cómo se llama el protagonista de "Naruto"?', '["Sasuke", "Naruto Uzumaki", "Kakashi", "Itachi"]', 1, 1),
  ('anime-manga', '¿Quién es el autor del manga "One Piece"?', '["Akira Toriyama", "Eiichiro Oda", "Masashi Kishimoto", "Tite Kubo"]', 1, 2),
  ('anime-manga', '¿En qué estudio se animó "Attack on Titan" (temporadas iniciales)?', '["Madhouse", "Bones", "Wit Studio", "MAPPA"]', 2, 4),
  ('peliculas', '¿Quién dirigió "Jurassic Park"?', '["James Cameron", "Steven Spielberg", "George Lucas", "Ridley Scott"]', 1, 1),
  ('comics', '¿Cuál es la identidad secreta de Batman?', '["Tony Stark", "Bruce Wayne", "Clark Kent", "Peter Parker"]', 1, 1),
  ('series', '¿En qué ciudad se ambienta principalmente "Breaking Bad"?', '["Los Ángeles", "Albuquerque", "Denver", "Phoenix"]', 1, 2)
) as v(slug, pregunta, opciones, respuesta_correcta, dificultad)
join trivia.categorias c on c.slug = v.slug
on conflict (categoria_id, pregunta) do nothing;


-- Columna de una versión anterior: el rol de admin ya no vive en perfiles.
alter table trivia.perfiles drop column if exists es_admin;

-- Hágase admin usted mismo (reemplace por su correo):
-- insert into trivia.admins (usuario_id)
-- select id from auth.users where email = 'SU_CORREO_AQUI'
-- on conflict do nothing;

-- Pide a PostgREST que recargue el esquema.
notify pgrst, 'reload schema';
