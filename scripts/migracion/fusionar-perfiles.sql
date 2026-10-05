-- Paso opcional (--con-perfiles): perfiles, admins y mejores puntajes.
--
-- Un perfil solo se puede importar si su usuario YA existe en el auth.users
-- del Supabase nuevo con el mismo id (perfiles.id referencia auth.users).
-- Los demás se saltan: esas personas crearán su perfil al volver a entrar.

insert into trivia.perfiles (id, nombre_usuario, avatar_url, puntaje_total, partidas_jugadas, created_at)
select
  p.id,
  p.nombre_usuario,
  p.avatar_url,
  greatest(coalesce(p.puntaje_total, 0), 0),
  greatest(coalesce(p.partidas_jugadas, 0), 0),
  coalesce(p.created_at, now())
from trivia_importacion.perfiles p
where exists (select 1 from auth.users u where u.id = p.id)
  and p.nombre_usuario ~ '^[A-Za-z0-9_]{3,20}$'
on conflict do nothing;

-- El rol de admin pasa de perfiles.es_admin a trivia.admins.
insert into trivia.admins (usuario_id)
select p.id
from trivia_importacion.perfiles p
where p.es_admin
  and exists (select 1 from trivia.perfiles destino where destino.id = p.id)
on conflict do nothing;

-- Mejores puntajes: categoría null = modo Mezclado.
insert into trivia.mejores_puntajes (usuario_id, categoria_id, mejor_puntaje, partidas_jugadas, updated_at)
select
  mp.usuario_id,
  m.id_destino,
  greatest(coalesce(mp.mejor_puntaje, 0), 0),
  greatest(coalesce(mp.partidas_jugadas, 0), 0),
  coalesce(mp.updated_at, now())
from trivia_importacion.mejores_puntajes mp
left join mapa_categorias m on m.id_origen = mp.categoria_id
where exists (select 1 from trivia.perfiles destino where destino.id = mp.usuario_id)
  and (mp.categoria_id is null or m.id_destino is not null)
on conflict (usuario_id, categoria_clave) do update
set mejor_puntaje = greatest(trivia.mejores_puntajes.mejor_puntaje, excluded.mejor_puntaje),
    partidas_jugadas = greatest(trivia.mejores_puntajes.partidas_jugadas, excluded.partidas_jugadas);

select 'perfiles en la nube' as dato, count(*) as cantidad from trivia_importacion.perfiles
union all
select 'perfiles importados (usuario existe en auth.users)', count(*)
from trivia_importacion.perfiles p
where exists (select 1 from trivia.perfiles destino where destino.id = p.id)
union all
select 'admins en trivia ahora', count(*) from trivia.admins;
