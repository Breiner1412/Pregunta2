-- Migración dentro del MISMO Supabase en la nube: copia public -> trivia.
-- Requisito: supabase/schema.sql ya aplicado (el esquema trivia existe).
-- Pegar completo en el SQL Editor y dar Run. Se puede correr más de una
-- vez: lo que ya existe no se duplica. No usa tablas temporales ni
-- esquemas auxiliares (el SQL Editor no los conserva entre sentencias).

-- 1. Categorías: se emparejan por slug.
insert into trivia.categorias (nombre, slug, grupo, activa, orden)
select nombre, slug, coalesce(grupo, 'general'), coalesce(activa, true), coalesce(orden, 0)
from public.categorias
where slug is not null and nombre is not null
on conflict (slug) do update
set nombre = excluded.nombre,
    grupo = excluded.grupo,
    activa = excluded.activa,
    orden = excluded.orden;

-- 2. Preguntas (solo las que cumplen los checks de trivia.preguntas).
insert into trivia.preguntas
  (id, categoria_id, pregunta, opciones, respuesta_correcta, dificultad,
   generada_por_ia, revisada, veces_usada, activa, created_at)
select
  p.id,
  destino.id,
  btrim(p.pregunta),
  p.opciones,
  p.respuesta_correcta,
  p.dificultad,
  coalesce(p.generada_por_ia, false),
  coalesce(p.revisada, true),
  greatest(coalesce(p.veces_usada, 0), 0),
  coalesce(p.activa, true),
  coalesce(p.created_at, now())
from public.preguntas p
join public.categorias origen on origen.id = p.categoria_id
join trivia.categorias destino on destino.slug = origen.slug
where char_length(btrim(coalesce(p.pregunta, ''))) > 0
  and case when jsonb_typeof(p.opciones) = 'array' then jsonb_array_length(p.opciones) = 4 else false end
  and p.respuesta_correcta between 0 and 3
  and p.dificultad between 1 and 5
on conflict do nothing;

-- 3. Perfiles (solo usuarios que existen en auth.users).
insert into trivia.perfiles (id, nombre_usuario, avatar_url, puntaje_total, partidas_jugadas, created_at)
select
  p.id,
  p.nombre_usuario,
  p.avatar_url,
  greatest(coalesce(p.puntaje_total, 0), 0),
  greatest(coalesce(p.partidas_jugadas, 0), 0),
  coalesce(p.created_at, now())
from public.perfiles p
where exists (select 1 from auth.users u where u.id = p.id)
  and p.nombre_usuario ~ '^[A-Za-z0-9_]{3,20}$'
on conflict do nothing;

-- 4. Admins: de perfiles.es_admin a trivia.admins.
insert into trivia.admins (usuario_id)
select p.id
from public.perfiles p
where p.es_admin
  and exists (select 1 from trivia.perfiles destino where destino.id = p.id)
on conflict do nothing;

-- 5. Mejores puntajes (categoría null = modo Mezclado).
insert into trivia.mejores_puntajes (usuario_id, categoria_id, mejor_puntaje, partidas_jugadas, updated_at)
select
  mp.usuario_id,
  destino.id,
  greatest(coalesce(mp.mejor_puntaje, 0), 0),
  greatest(coalesce(mp.partidas_jugadas, 0), 0),
  coalesce(mp.updated_at, now())
from public.mejores_puntajes mp
left join public.categorias origen on origen.id = mp.categoria_id
left join trivia.categorias destino on destino.slug = origen.slug
where exists (select 1 from trivia.perfiles p where p.id = mp.usuario_id)
  and (mp.categoria_id is null or destino.id is not null)
on conflict (usuario_id, categoria_clave) do update
set mejor_puntaje = greatest(trivia.mejores_puntajes.mejor_puntaje, excluded.mejor_puntaje),
    partidas_jugadas = greatest(trivia.mejores_puntajes.partidas_jugadas, excluded.partidas_jugadas);

-- Pide a PostgREST que recargue el esquema.
notify pgrst, 'reload schema';

-- 6. Resumen.
select 'categorias en public' as dato, count(*) as cantidad from public.categorias
union all select 'categorias en trivia', count(*) from trivia.categorias
union all select 'preguntas en public', count(*) from public.preguntas
union all select 'preguntas en trivia', count(*) from trivia.preguntas
union all select 'perfiles en public', count(*) from public.perfiles
union all select 'perfiles en trivia', count(*) from trivia.perfiles
union all select 'admins en trivia', count(*) from trivia.admins
union all select 'mejores puntajes en trivia', count(*) from trivia.mejores_puntajes;
