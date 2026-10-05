-- Paso 2 de la migración: pasa categorías y preguntas de trivia_importacion
-- al esquema trivia. Se puede correr más de una vez: lo que ya existe no se
-- duplica.

-- Categorías: se emparejan por slug. Si ya existe (por ejemplo, las que crea
-- schema.sql), se actualizan sus datos y se conserva el id del destino.
insert into trivia.categorias (nombre, slug, grupo, activa, orden)
select nombre, slug, coalesce(grupo, 'general'), coalesce(activa, true), coalesce(orden, 0)
from trivia_importacion.categorias
where slug is not null and nombre is not null
on conflict (slug) do update
set nombre = excluded.nombre,
    grupo = excluded.grupo,
    activa = excluded.activa,
    orden = excluded.orden;

-- Id de categoría en la nube -> id en el destino.
create temp table mapa_categorias on commit drop as
select origen.id as id_origen, destino.id as id_destino
from trivia_importacion.categorias origen
join trivia.categorias destino on destino.slug = origen.slug;

-- Preguntas: solo las que cumplen las restricciones de trivia.preguntas
-- (4 opciones, respuesta 0-3, dificultad 1-5). Conservan su id; las que ya
-- existen (mismo id, o mismo texto en la categoría) se saltan.
insert into trivia.preguntas
  (id, categoria_id, pregunta, opciones, respuesta_correcta, dificultad,
   generada_por_ia, revisada, veces_usada, activa, created_at)
select
  p.id,
  m.id_destino,
  btrim(p.pregunta),
  p.opciones,
  p.respuesta_correcta,
  p.dificultad,
  coalesce(p.generada_por_ia, false),
  coalesce(p.revisada, true),
  greatest(coalesce(p.veces_usada, 0), 0),
  coalesce(p.activa, true),
  coalesce(p.created_at, now())
from trivia_importacion.preguntas p
join mapa_categorias m on m.id_origen = p.categoria_id
where char_length(btrim(coalesce(p.pregunta, ''))) > 0
  and case when jsonb_typeof(p.opciones) = 'array' then jsonb_array_length(p.opciones) = 4 else false end
  and p.respuesta_correcta between 0 and 3
  and p.dificultad between 1 and 5
on conflict do nothing;

-- Resumen de lo importado.
select 'categorias en la nube' as dato, count(*) as cantidad from trivia_importacion.categorias
union all
select 'preguntas en la nube', count(*) from trivia_importacion.preguntas
union all
select 'preguntas válidas (con categoría y que cumplen los checks)', count(*)
from trivia_importacion.preguntas p
join mapa_categorias m on m.id_origen = p.categoria_id
where char_length(btrim(coalesce(p.pregunta, ''))) > 0
  and case when jsonb_typeof(p.opciones) = 'array' then jsonb_array_length(p.opciones) = 4 else false end
  and p.respuesta_correcta between 0 and 3
  and p.dificultad between 1 and 5
union all
select 'preguntas en trivia ahora', count(*) from trivia.preguntas;
