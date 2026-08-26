-- ============================================================
-- Este archivo es una copia de referencia de todo el SQL que ya
-- se ejecutó en el SQL Editor de Supabase durante el desarrollo.
-- No hace falta volver a correrlo si su base de datos ya está
-- lista — es solo para tener respaldo y contexto en el proyecto.
-- ============================================================


-- ============================================
-- PASO 1: Estructura de base de datos
-- ============================================

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique not null,
  grupo text not null default 'general',
  activa boolean default true,
  orden integer default 0,
  created_at timestamptz default now()
);

create table if not exists preguntas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id) on delete cascade,
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

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_usuario text unique not null,
  avatar_url text,
  puntaje_total integer default 0,
  partidas_jugadas integer default 0,
  created_at timestamptz default now()
);

create table if not exists partidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references perfiles(id) on delete set null,
  modo text not null default 'mixto',
  categoria_id uuid references categorias(id),
  puntaje integer not null default 0,
  preguntas_correctas integer default 0,
  preguntas_totales integer default 0,
  finalizada boolean default false,
  created_at timestamptz default now()
);

create table if not exists respuestas_partida (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references partidas(id) on delete cascade,
  pregunta_id uuid references preguntas(id),
  respuesta_dada integer,
  correcta boolean not null,
  tiempo_respuesta_ms integer,
  dificultad_en_momento integer not null,
  created_at timestamptz default now()
);

create index if not exists idx_preguntas_categoria_dificultad on preguntas(categoria_id, dificultad) where activa = true;
create index if not exists idx_perfiles_puntaje on perfiles(puntaje_total desc);
create index if not exists idx_partidas_usuario on partidas(usuario_id);


-- ============================================
-- PASO 2: Categorías y preguntas iniciales
-- ============================================

insert into categorias (nombre, slug, grupo, orden) values
  ('Cultura General', 'cultura-general', 'general', 1),
  ('Ciencia', 'ciencia', 'general', 2),
  ('Deportes', 'deportes', 'general', 3),
  ('Música', 'musica', 'general', 4),
  ('Anime y Manga', 'anime-manga', 'geek', 5),
  ('Películas', 'peliculas', 'geek', 6),
  ('Cómics', 'comics', 'geek', 7),
  ('Series', 'series', 'geek', 8)
on conflict (slug) do nothing;

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuál es la capital de Australia?', '["Sídney", "Melbourne", "Canberra", "Perth"]'::jsonb, 2, 1
from categorias where slug = 'cultura-general';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿En qué año cayó el Muro de Berlín?', '["1987", "1989", "1991", "1993"]'::jsonb, 1, 2
from categorias where slug = 'cultura-general';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuál es el río más largo del mundo?', '["Nilo", "Amazonas", "Yangtsé", "Misisipi"]'::jsonb, 1, 3
from categorias where slug = 'cultura-general';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuál es el planeta más cercano al Sol?', '["Venus", "Mercurio", "Marte", "Tierra"]'::jsonb, 1, 1
from categorias where slug = 'ciencia';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuál es el símbolo químico del oro?', '["Go", "Au", "Ag", "Or"]'::jsonb, 1, 2
from categorias where slug = 'ciencia';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Qué partícula subatómica tiene carga negativa?', '["Protón", "Neutrón", "Electrón", "Fotón"]'::jsonb, 2, 3
from categorias where slug = 'ciencia';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cada cuántos años se celebran los Juegos Olímpicos de verano?', '["2", "3", "4", "5"]'::jsonb, 2, 1
from categorias where slug = 'deportes';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Qué país ha ganado más Copas del Mundo de fútbol?', '["Alemania", "Argentina", "Brasil", "Italia"]'::jsonb, 2, 2
from categorias where slug = 'deportes';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Qué banda interpretó "Bohemian Rhapsody"?', '["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"]'::jsonb, 1, 1
from categorias where slug = 'musica';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuántas cuerdas tiene una guitarra estándar?', '["4", "5", "6", "7"]'::jsonb, 2, 1
from categorias where slug = 'musica';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cómo se llama el protagonista de "Naruto"?', '["Sasuke", "Naruto Uzumaki", "Kakashi", "Itachi"]'::jsonb, 1, 1
from categorias where slug = 'anime-manga';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Quién es el autor del manga "One Piece"?', '["Akira Toriyama", "Eiichiro Oda", "Masashi Kishimoto", "Tite Kubo"]'::jsonb, 1, 2
from categorias where slug = 'anime-manga';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿En qué estudio se animó "Attack on Titan" (temporadas iniciales)?', '["Madhouse", "Bones", "Wit Studio", "MAPPA"]'::jsonb, 2, 4
from categorias where slug = 'anime-manga';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Quién dirigió "Jurassic Park"?', '["James Cameron", "Steven Spielberg", "George Lucas", "Ridley Scott"]'::jsonb, 1, 1
from categorias where slug = 'peliculas';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿Cuál es la identidad secreta de Batman?', '["Tony Stark", "Bruce Wayne", "Clark Kent", "Peter Parker"]'::jsonb, 1, 1
from categorias where slug = 'comics';

insert into preguntas (categoria_id, pregunta, opciones, respuesta_correcta, dificultad)
select id, '¿En qué ciudad se ambienta principalmente "Breaking Bad"?', '["Los Ángeles", "Albuquerque", "Denver", "Phoenix"]'::jsonb, 1, 2
from categorias where slug = 'series';


-- ============================================
-- PASO 3: RLS para desarrollo
-- ============================================
-- Se desactivó RLS temporalmente en categorias/preguntas para el MVP,
-- ya que hoy solo se leen y no dependen del usuario. Antes de lanzar
-- a producción, reemplace esto por políticas de solo-lectura explícitas.

alter table categorias disable row level security;
alter table preguntas disable row level security;


-- ============================================
-- PASO 4 (Parte A): RLS para perfiles
-- ============================================
-- Aquí sí es necesario RLS desde ya, porque el usuario escribe su
-- propio perfil desde el navegador.

alter table perfiles enable row level security;

drop policy if exists "Perfiles son públicos para lectura" on perfiles;
create policy "Perfiles son públicos para lectura"
on perfiles for select
using (true);

drop policy if exists "Usuarios pueden crear su propio perfil" on perfiles;
create policy "Usuarios pueden crear su propio perfil"
on perfiles for insert
with check (auth.uid() = id);

drop policy if exists "Usuarios pueden actualizar su propio perfil" on perfiles;
create policy "Usuarios pueden actualizar su propio perfil"
on perfiles for update
using (auth.uid() = id);


-- ============================================
-- PASO 6: Ranking por categoría + modo supervivencia
-- ============================================
-- categoria_id = null representa el modo "Mezclado". Se usa un índice
-- único con coalesce porque en SQL, NULL nunca es "igual" a otro NULL,
-- así que un unique(usuario_id, categoria_id) normal NO evitaría filas
-- duplicadas para el modo Mezclado.

create table if not exists mejores_puntajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete cascade,
  mejor_puntaje integer not null default 0,
  partidas_jugadas integer not null default 0,
  updated_at timestamptz default now()
);

create unique index if not exists idx_mejores_puntajes_usuario_categoria
on mejores_puntajes (usuario_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_mejores_puntajes_ranking
on mejores_puntajes (categoria_id, mejor_puntaje desc);

alter table mejores_puntajes enable row level security;

drop policy if exists "Mejores puntajes son públicos para lectura" on mejores_puntajes;
create policy "Mejores puntajes son públicos para lectura"
on mejores_puntajes for select
using (true);

drop policy if exists "Usuarios pueden insertar su propio mejor puntaje" on mejores_puntajes;
create policy "Usuarios pueden insertar su propio mejor puntaje"
on mejores_puntajes for insert
with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios pueden actualizar su propio mejor puntaje" on mejores_puntajes;
create policy "Usuarios pueden actualizar su propio mejor puntaje"
on mejores_puntajes for update
using (auth.uid() = usuario_id);

-- Registra el puntaje solo si es un nuevo récord para esa categoría
-- (o modo Mezclado si p_categoria es null), y siempre suma la partida jugada.
create or replace function registrar_mejor_puntaje(p_usuario uuid, p_categoria uuid, p_puntaje int)
returns void
language sql
security invoker
as $$
  insert into mejores_puntajes (usuario_id, categoria_id, mejor_puntaje, partidas_jugadas)
  values (p_usuario, p_categoria, p_puntaje, 1)
  on conflict (usuario_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set
    mejor_puntaje = greatest(mejores_puntajes.mejor_puntaje, excluded.mejor_puntaje),
    partidas_jugadas = mejores_puntajes.partidas_jugadas + 1,
    updated_at = now();
$$;

-- Posición exacta de un usuario dentro de una categoría (o Mezclado)
create or replace function obtener_posicion_categoria(p_usuario uuid, p_categoria uuid)
returns int
language sql
security invoker
as $$
  select (count(*) + 1)::int
  from mejores_puntajes
  where coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
    and mejor_puntaje > (
      select mejor_puntaje from mejores_puntajes
      where usuario_id = p_usuario
        and coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
    );
$$;


-- ============================================
-- PASO 7: Panel admin para preguntas generadas por IA
-- ============================================

alter table perfiles add column if not exists es_admin boolean not null default false;

alter table preguntas enable row level security;

drop policy if exists "Preguntas son públicas para lectura" on preguntas;
create policy "Preguntas son públicas para lectura"
on preguntas for select
using (true);

drop policy if exists "Solo administradores pueden insertar preguntas" on preguntas;
create policy "Solo administradores pueden insertar preguntas"
on preguntas for insert
with check (
  exists (select 1 from perfiles where id = auth.uid() and es_admin = true)
);

drop policy if exists "Solo administradores pueden actualizar preguntas" on preguntas;
create policy "Solo administradores pueden actualizar preguntas"
on preguntas for update
using (
  exists (select 1 from perfiles where id = auth.uid() and es_admin = true)
);

drop policy if exists "Solo administradores pueden eliminar preguntas" on preguntas;
create policy "Solo administradores pueden eliminar preguntas"
on preguntas for delete
using (
  exists (select 1 from perfiles where id = auth.uid() and es_admin = true)
);

-- Después de correr esto, hágase admin usted mismo (reemplace por su nombre de usuario):
-- update perfiles set es_admin = true where nombre_usuario = 'SU_USUARIO_AQUI';
