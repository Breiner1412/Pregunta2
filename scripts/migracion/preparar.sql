-- Paso 1 de la migración: esquema temporal donde se cargan, tal cual, los
-- datos exportados del esquema public de Supabase en la nube.
-- Las columnas siguen la estructura que tenía public (ver el historial de
-- supabase/schema.sql); no tienen restricciones para que la carga no falle.

drop schema if exists trivia_importacion cascade;
create schema trivia_importacion;

create table trivia_importacion.categorias (
  id uuid,
  nombre text,
  slug text,
  grupo text,
  activa boolean,
  orden integer,
  created_at timestamptz
);

create table trivia_importacion.preguntas (
  id uuid,
  categoria_id uuid,
  pregunta text,
  opciones jsonb,
  respuesta_correcta integer,
  dificultad integer,
  generada_por_ia boolean,
  revisada boolean,
  veces_usada integer,
  activa boolean,
  created_at timestamptz
);

create table trivia_importacion.perfiles (
  id uuid,
  nombre_usuario text,
  avatar_url text,
  puntaje_total bigint,
  partidas_jugadas integer,
  es_admin boolean,
  created_at timestamptz
);

create table trivia_importacion.mejores_puntajes (
  id uuid,
  usuario_id uuid,
  categoria_id uuid,
  mejor_puntaje integer,
  partidas_jugadas integer,
  updated_at timestamptz
);
