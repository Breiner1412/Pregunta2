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
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists trivia.preguntas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references trivia.categorias(id) on delete cascade,
  pregunta text not null check (char_length(btrim(pregunta)) > 0),
  -- Siempre 4 opciones; la correcta es su índice (0 a 3).
  opciones jsonb not null check (
    case when jsonb_typeof(opciones) = 'array' then jsonb_array_length(opciones) = 4 else false end
  ),
  respuesta_correcta integer not null check (respuesta_correcta between 0 and 3),
  dificultad integer not null default 1 check (dificultad between 1 and 5),
  generada_por_ia boolean not null default false,
  revisada boolean not null default true,
  veces_usada integer not null default 0 check (veces_usada >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists trivia.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Mismo formato que valida completar-perfil: 3 a 20 letras, números o _.
  nombre_usuario text unique not null check (nombre_usuario ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_url text,
  puntaje_total bigint not null default 0 check (puntaje_total >= 0),
  partidas_jugadas integer not null default 0 check (partidas_jugadas >= 0),
  created_at timestamptz not null default now()
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
  modo text not null default 'mixto' check (modo in ('mixto', 'categoria_unica')),
  categoria_id uuid references trivia.categorias(id) on delete set null,
  puntaje integer not null default 0 check (puntaje >= 0),
  preguntas_correctas integer not null default 0 check (preguntas_correctas >= 0),
  preguntas_totales integer not null default 0 check (preguntas_totales >= 0),
  finalizada boolean not null default false,
  -- Estado de la partida en curso: lo maneja solo el servidor.
  vidas smallint not null default 3 check (vidas between 0 and 3),
  pregunta_actual_id uuid references trivia.preguntas(id) on delete set null,
  pregunta_servida_at timestamptz,
  finalizada_at timestamptz,
  created_at timestamptz not null default now(),
  check (preguntas_correctas <= preguntas_totales)
);

create table if not exists trivia.respuestas_partida (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references trivia.partidas(id) on delete cascade,
  pregunta_id uuid references trivia.preguntas(id) on delete set null,
  -- null = se acabó el tiempo sin responder.
  respuesta_dada integer check (respuesta_dada between 0 and 3),
  correcta boolean not null,
  tiempo_respuesta_ms integer not null check (tiempo_respuesta_ms between 0 and 15000),
  dificultad_en_momento integer not null check (dificultad_en_momento between 1 and 5),
  created_at timestamptz not null default now()
);

-- categoria_id = null representa el modo "Mezclado". En SQL, NULL nunca es
-- "igual" a otro NULL, así que un unique(usuario_id, categoria_id) normal NO
-- evitaría filas duplicadas para el modo Mezclado. Por eso se usa
-- categoria_clave: la misma categoría, pero con un uuid fijo para Mezclado,
-- que sirve para el índice único y para buscar posiciones con índice.
create table if not exists trivia.mejores_puntajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references trivia.perfiles(id) on delete cascade,
  categoria_id uuid references trivia.categorias(id) on delete cascade,
  mejor_puntaje integer not null default 0 check (mejor_puntaje >= 0),
  partidas_jugadas integer not null default 0 check (partidas_jugadas >= 0),
  categoria_clave uuid not null generated always as
    (coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  updated_at timestamptz not null default now()
);


-- Registro de cada generación de preguntas con IA: sirve de cuota diaria
-- por admin y de lock por categoría. Solo lo toca el servidor.
create table if not exists trivia.uso_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid references trivia.categorias(id) on delete set null,
  cantidad_pedida integer not null,
  estado text not null default 'en_curso'
    check (estado in ('en_curso', 'ok', 'error', 'expirado')),
  insertadas integer not null default 0,
  created_at timestamptz not null default now(),
  finalizada_at timestamptz
);


-- Bases creadas con una versión anterior de este script: "create table if
-- not exists" no cambia tablas existentes, así que las columnas que pasaron
-- a not null se ajustan aquí (rellenando antes los null que hubiera).
update trivia.categorias set activa = true where activa is null;
update trivia.categorias set orden = 0 where orden is null;
update trivia.categorias set created_at = now() where created_at is null;
update trivia.mejores_puntajes set updated_at = now() where updated_at is null;
alter table trivia.categorias
  alter column activa set not null,
  alter column orden set not null,
  alter column created_at set not null;
alter table trivia.mejores_puntajes alter column updated_at set not null;


-- ============================================
-- Índices
-- ============================================

create index if not exists idx_preguntas_categoria_dificultad
  on trivia.preguntas (categoria_id, dificultad) where activa = true;
create index if not exists idx_perfiles_puntaje on trivia.perfiles (puntaje_total desc);
create index if not exists idx_partidas_usuario on trivia.partidas (usuario_id);
-- Para la limpieza de partidas abandonadas y de invitado (_limpiar_partidas_viejas).
create index if not exists idx_partidas_abandonadas on trivia.partidas (created_at) where not finalizada;
create index if not exists idx_partidas_invitado on trivia.partidas (created_at) where usuario_id is null;

-- Índices de claves foráneas (borrados en cascada / set null y joins).
create index if not exists idx_partidas_categoria on trivia.partidas (categoria_id);
create index if not exists idx_partidas_pregunta_actual on trivia.partidas (pregunta_actual_id);
-- También sirve para saber qué preguntas ya salieron en una partida.
create index if not exists idx_respuestas_partida_partida_pregunta
  on trivia.respuestas_partida (partida_id, pregunta_id);
create index if not exists idx_respuestas_partida_pregunta on trivia.respuestas_partida (pregunta_id);
create index if not exists idx_uso_ia_categoria on trivia.uso_ia (categoria_id);

-- Versión anterior del índice único, con la expresión coalesce.
drop index if exists trivia.idx_mejores_puntajes_usuario_categoria;
create unique index if not exists idx_mejores_puntajes_usuario_clave
  on trivia.mejores_puntajes (usuario_id, categoria_clave);
-- Para obtener_posicion_categoria.
create index if not exists idx_mejores_puntajes_clave_puntaje
  on trivia.mejores_puntajes (categoria_clave, mejor_puntaje desc);
-- Para el top del ranking, que filtra por categoria_id (o categoria_id is null).
create index if not exists idx_mejores_puntajes_ranking
  on trivia.mejores_puntajes (categoria_id, mejor_puntaje desc);

-- Solo una generación en curso por categoría (el lock de uso_ia).
create unique index if not exists idx_uso_ia_lock_categoria
  on trivia.uso_ia (categoria_id) where estado = 'en_curso';
create index if not exists idx_uso_ia_usuario_fecha on trivia.uso_ia (usuario_id, created_at);

-- "Ana" y "ana" no pueden ser dos usuarios distintos.
create unique index if not exists idx_perfiles_nombre_usuario_lower
  on trivia.perfiles (lower(nombre_usuario));

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

-- Versiones anteriores dejaban registrar el mejor puntaje desde el navegador
-- con cualquier valor. Ahora solo lo hace _finalizar_partida.
drop function if exists trivia.registrar_mejor_puntaje(uuid, uuid, int);
drop function if exists trivia.incrementar_puntaje_usuario(uuid, int);

-- --------------------------------------------
-- Partida con estado en el servidor
-- --------------------------------------------
-- El navegador nunca calcula ni envía el puntaje: el servidor sirve una
-- pregunta a la vez, mide el tiempo con su propio reloj, corrige la
-- respuesta y lleva vidas y puntaje. Estas funciones solo las ejecuta
-- service_role (desde las rutas de app/api/partida), y cada llamada es
-- una transacción: o se guarda todo o no se guarda nada.

-- Bloquea la partida para esta transacción y comprueba que sea del usuario.
-- Las partidas de invitado (usuario_id null) se identifican solo por su id.
create or replace function trivia._bloquear_partida(p_partida uuid, p_usuario uuid)
returns trivia.partidas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partida trivia.partidas;
begin
  select * into v_partida from trivia.partidas where id = p_partida for update;

  if not found or (v_partida.usuario_id is not null and v_partida.usuario_id is distinct from p_usuario) then
    raise exception 'partida_no_encontrada' using errcode = 'P0002';
  end if;

  return v_partida;
end;
$$;

-- Cierra la partida (si no estaba cerrada) y, si es de un usuario con
-- perfil, suma a sus totales y actualiza su mejor puntaje. Devuelve el
-- resultado final.
create or replace function trivia._finalizar_partida(p_partida uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partida trivia.partidas;
begin
  update trivia.partidas
  set finalizada = true,
      finalizada_at = now(),
      pregunta_actual_id = null,
      pregunta_servida_at = null
  where id = p_partida and not finalizada
  returning * into v_partida;

  if found and v_partida.usuario_id is not null then
    update trivia.perfiles
    set puntaje_total = puntaje_total + v_partida.puntaje,
        partidas_jugadas = partidas_jugadas + 1
    where id = v_partida.usuario_id;

    insert into trivia.mejores_puntajes (usuario_id, categoria_id, mejor_puntaje, partidas_jugadas)
    values (v_partida.usuario_id, v_partida.categoria_id, v_partida.puntaje, 1)
    on conflict (usuario_id, categoria_clave)
    do update set
      mejor_puntaje = greatest(trivia.mejores_puntajes.mejor_puntaje, excluded.mejor_puntaje),
      partidas_jugadas = trivia.mejores_puntajes.partidas_jugadas + 1,
      updated_at = now();
  end if;

  select * into v_partida from trivia.partidas where id = p_partida;

  return jsonb_build_object(
    'correctas', v_partida.preguntas_correctas,
    'puntaje', v_partida.puntaje,
    'total_respondidas', v_partida.preguntas_totales
  );
end;
$$;

-- Borra, en lotes acotados, lo que no aporta al ranking y solo ocupa disco:
-- partidas que nadie terminó en un día, y partidas de invitado (que nunca
-- suman al ranking) de más de 30 días. Sus respuestas se borran en cascada.
-- Se llama al iniciar cada partida, así no hace falta un cron.
create or replace function trivia._limpiar_partidas_viejas()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from trivia.partidas
  where id in (
    (select id from trivia.partidas
     where not finalizada and created_at < now() - interval '1 day'
     limit 200)
    union all
    (select id from trivia.partidas
     where usuario_id is null and created_at < now() - interval '30 days'
     limit 200)
  );
$$;

-- Crea una partida. Un usuario de auth sin perfil de trivia (por ejemplo,
-- alguien que solo usa la otra app) juega como invitado.
-- Parámetros con default null: invitado (sin usuario) y modo Mezclado (sin categoría).
create or replace function trivia.iniciar_partida(p_usuario uuid default null, p_categoria uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
  v_id uuid;
begin
  if p_categoria is not null
     and not exists (select 1 from trivia.categorias where id = p_categoria and activa) then
    raise exception 'categoria_no_encontrada' using errcode = 'P0002';
  end if;

  perform trivia._limpiar_partidas_viejas();

  select id into v_usuario from trivia.perfiles where id = p_usuario;

  insert into trivia.partidas (usuario_id, modo, categoria_id)
  values (
    v_usuario,
    case when p_categoria is null then 'mixto' else 'categoria_unica' end,
    p_categoria
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Devuelve la pregunta en juego (sin la respuesta correcta). Si ya había
-- una servida y sin responder, devuelve la misma sin reiniciar el reloj.
-- Si no quedan preguntas, cierra la partida.
create or replace function trivia.servir_siguiente_pregunta(p_partida uuid, p_usuario uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partida trivia.partidas;
  v_pregunta_id uuid;
  v_pregunta jsonb;
begin
  v_partida := trivia._bloquear_partida(p_partida, p_usuario);

  if v_partida.finalizada then
    return jsonb_build_object('terminada', true, 'resultado', trivia._finalizar_partida(p_partida));
  end if;

  v_pregunta_id := v_partida.pregunta_actual_id;

  if v_pregunta_id is null then
    -- Dificultad progresiva: 1, 2, 3, 4, 5, 1, 2... tomando la más cercana
    -- disponible, al azar entre las de igual distancia.
    select p.id into v_pregunta_id
    from trivia.preguntas p
    where p.activa
      and p.revisada
      and (v_partida.modo = 'mixto' or p.categoria_id = v_partida.categoria_id)
      -- Una categoría desactivada no aporta preguntas (tampoco en Mezclado).
      and exists (
        select 1 from trivia.categorias c
        where c.id = p.categoria_id and c.activa
      )
      and not exists (
        select 1 from trivia.respuestas_partida r
        where r.partida_id = v_partida.id and r.pregunta_id = p.id
      )
    order by abs(p.dificultad - (v_partida.preguntas_totales % 5 + 1)), random()
    limit 1;

    if v_pregunta_id is null then
      return jsonb_build_object('terminada', true, 'resultado', trivia._finalizar_partida(p_partida));
    end if;

    update trivia.partidas
    set pregunta_actual_id = v_pregunta_id,
        pregunta_servida_at = now()
    where id = v_partida.id;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'categoria_id', p.categoria_id,
    'pregunta', p.pregunta,
    'opciones', p.opciones,
    'dificultad', p.dificultad
  ) into v_pregunta
  from trivia.preguntas p
  where p.id = v_pregunta_id;

  return jsonb_build_object(
    'terminada', false,
    'pregunta', v_pregunta,
    'numero', v_partida.preguntas_totales + 1,
    'vidas', v_partida.vidas,
    'puntaje', v_partida.puntaje
  );
end;
$$;

-- Corrige la respuesta a la pregunta en juego (una sola vez). El tiempo
-- se mide desde que el servidor sirvió la pregunta, con un margen para
-- la latencia de red; pasado ese margen la respuesta cuenta como fallo.
-- p_usuario null = invitado; p_respuesta null = se acabó el tiempo.
-- (Versiones anteriores tenían otro orden de parámetros: se recrea.)
drop function if exists trivia.responder_pregunta(uuid, uuid, uuid, int);
create function trivia.responder_pregunta(
  p_partida uuid,
  p_pregunta uuid,
  p_usuario uuid default null,
  p_respuesta int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_duracion_ms constant int := 15000;
  c_margen_red_ms constant int := 2000;
  v_partida trivia.partidas;
  v_respuesta_correcta int;
  v_dificultad int;
  v_tiempo_ms int;
  v_correcta boolean;
  v_puntos int;
begin
  v_partida := trivia._bloquear_partida(p_partida, p_usuario);

  if v_partida.finalizada then
    raise exception 'partida_finalizada' using errcode = 'P0001';
  end if;

  if p_pregunta is null or v_partida.pregunta_actual_id is distinct from p_pregunta then
    raise exception 'pregunta_no_vigente' using errcode = 'P0001';
  end if;

  select respuesta_correcta, dificultad into v_respuesta_correcta, v_dificultad
  from trivia.preguntas
  where id = p_pregunta;

  v_tiempo_ms := greatest(0, floor(extract(epoch from (now() - v_partida.pregunta_servida_at)) * 1000))::int;
  v_correcta := p_respuesta is not null
    and p_respuesta = v_respuesta_correcta
    and v_tiempo_ms <= c_duracion_ms + c_margen_red_ms;
  v_tiempo_ms := least(v_tiempo_ms, c_duracion_ms);

  v_puntos := case
    when v_correcta then
      round(100 * v_dificultad * (1 + greatest(0, 1 - v_tiempo_ms::numeric / c_duracion_ms)))::int
    else 0
  end;

  insert into trivia.respuestas_partida
    (partida_id, pregunta_id, respuesta_dada, correcta, tiempo_respuesta_ms, dificultad_en_momento)
  values
    (v_partida.id, p_pregunta, p_respuesta, v_correcta, v_tiempo_ms, v_dificultad);

  update trivia.preguntas set veces_usada = veces_usada + 1 where id = p_pregunta;

  update trivia.partidas
  set puntaje = puntaje + v_puntos,
      preguntas_correctas = preguntas_correctas + v_correcta::int,
      preguntas_totales = preguntas_totales + 1,
      vidas = vidas - (not v_correcta)::int,
      pregunta_actual_id = null,
      pregunta_servida_at = null
  where id = v_partida.id
  returning * into v_partida;

  return jsonb_build_object(
    'correcta', v_correcta,
    'respuesta_correcta', v_respuesta_correcta,
    'vidas', v_partida.vidas,
    'puntaje', v_partida.puntaje,
    'terminada', v_partida.vidas <= 0,
    'resultado', case when v_partida.vidas <= 0 then trivia._finalizar_partida(v_partida.id) end
  );
end;
$$;

-- --------------------------------------------
-- Límite de uso de la IA
-- --------------------------------------------

-- Reserva una generación: falla con 'cuota_ia_agotada' si el admin ya hizo
-- p_limite_diario generaciones hoy, o con 'generacion_en_curso' si ya hay
-- una corriendo para esa categoría. Devuelve el id a cerrar al terminar.
create or replace function trivia.reservar_uso_ia(
  p_usuario uuid,
  p_categoria uuid,
  p_cantidad int,
  p_limite_diario int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usadas int;
  v_id uuid;
begin
  -- Un lock que quedó colgado (por ejemplo, si el proceso murió) caduca a los 5 minutos.
  update trivia.uso_ia
  set estado = 'expirado', finalizada_at = now()
  where estado = 'en_curso' and created_at < now() - interval '5 minutes';

  -- Serializa las reservas de un mismo admin para que dos pedidos
  -- simultáneos no superen juntos el límite.
  perform pg_advisory_xact_lock(hashtextextended('trivia.uso_ia:' || p_usuario::text, 0));

  select count(*) into v_usadas
  from trivia.uso_ia
  where usuario_id = p_usuario and created_at >= date_trunc('day', now());

  if v_usadas >= p_limite_diario then
    raise exception 'cuota_ia_agotada' using errcode = 'P0001';
  end if;

  begin
    insert into trivia.uso_ia (usuario_id, categoria_id, cantidad_pedida)
    values (p_usuario, p_categoria, p_cantidad)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'generacion_en_curso' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

-- Cierra una generación reservada y libera el lock de su categoría.
create or replace function trivia.cerrar_uso_ia(p_uso uuid, p_insertadas int)
returns void
language sql
security definer
set search_path = ''
as $$
  update trivia.uso_ia
  set estado = case when p_insertadas > 0 then 'ok' else 'error' end,
      insertadas = p_insertadas,
      finalizada_at = now()
  where id = p_uso and estado = 'en_curso';
$$;

-- Posición exacta de un usuario dentro de una categoría (o Mezclado).
-- Devuelve null si el usuario todavía no tiene puntaje en esa categoría.
create or replace function trivia.obtener_posicion_categoria(p_usuario uuid, p_categoria uuid default null)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  -- Compara contra categoria_clave (columna indexada) y no contra una
  -- expresión, para que Postgres pueda usar los índices.
  with propio as (
    select mejor_puntaje
    from trivia.mejores_puntajes
    where usuario_id = p_usuario
      and categoria_clave = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  select (
    select count(*) + 1
    from trivia.mejores_puntajes m
    where m.categoria_clave = coalesce(p_categoria, '00000000-0000-0000-0000-000000000000'::uuid)
      and m.mejor_puntaje > propio.mejor_puntaje
  )::int
  from propio;
$$;


-- ============================================
-- Row Level Security
-- ============================================
-- El auth es compartido: un usuario de la otra app llega aquí como
-- "authenticated". Por eso ninguna política confía solo en tener sesión:
-- cada escritura se limita a la propia fila y a columnas concretas, los
-- puntajes los escribe solo el servidor y el rol admin sale de
-- trivia.admins. Lo más que puede hacer ese usuario es crearse un perfil
-- y jugar.

alter table trivia.categorias enable row level security;

drop policy if exists "Categorías son públicas para lectura" on trivia.categorias;
create policy "Categorías son públicas para lectura"
on trivia.categorias for select
to anon, authenticated
using (true);

alter table trivia.admins enable row level security;

drop policy if exists "Cada usuario ve solo su propia fila de admin" on trivia.admins;
create policy "Cada usuario ve solo su propia fila de admin"
on trivia.admins for select
to authenticated
using ((select auth.uid()) = usuario_id);

alter table trivia.perfiles enable row level security;

drop policy if exists "Perfiles son públicos para lectura" on trivia.perfiles;
create policy "Perfiles son públicos para lectura"
on trivia.perfiles for select
to anon, authenticated
using (true);

drop policy if exists "Usuarios pueden crear su propio perfil" on trivia.perfiles;
create policy "Usuarios pueden crear su propio perfil"
on trivia.perfiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Usuarios pueden actualizar su propio perfil" on trivia.perfiles;
create policy "Usuarios pueden actualizar su propio perfil"
on trivia.perfiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

alter table trivia.partidas enable row level security;

drop policy if exists "Cada usuario ve solo sus partidas" on trivia.partidas;
create policy "Cada usuario ve solo sus partidas"
on trivia.partidas for select
to authenticated
using ((select auth.uid()) = usuario_id);

alter table trivia.respuestas_partida enable row level security;

drop policy if exists "Cada usuario ve solo las respuestas de sus partidas" on trivia.respuestas_partida;
create policy "Cada usuario ve solo las respuestas de sus partidas"
on trivia.respuestas_partida for select
to authenticated
using (
  exists (
    select 1 from trivia.partidas p
    where p.id = partida_id and p.usuario_id = (select auth.uid())
  )
);

-- Sin políticas: solo la usa el servidor (service_role ignora RLS).
alter table trivia.uso_ia enable row level security;

alter table trivia.mejores_puntajes enable row level security;

drop policy if exists "Mejores puntajes son públicos para lectura" on trivia.mejores_puntajes;
create policy "Mejores puntajes son públicos para lectura"
on trivia.mejores_puntajes for select
to anon, authenticated
using (true);

-- Sin políticas de insert/update: el mejor puntaje solo lo escribe el
-- servidor al cerrar una partida.
drop policy if exists "Usuarios pueden insertar su propio mejor puntaje" on trivia.mejores_puntajes;
drop policy if exists "Usuarios pueden actualizar su propio mejor puntaje" on trivia.mejores_puntajes;

alter table trivia.preguntas enable row level security;

-- Las preguntas (con su respuesta correcta) solo las leen los admins.
-- Los jugadores las reciben de una en una desde el servidor, sin la
-- respuesta, a través de servir_siguiente_pregunta.
drop policy if exists "Preguntas son públicas para lectura" on trivia.preguntas;
drop policy if exists "Solo administradores pueden leer preguntas" on trivia.preguntas;
create policy "Solo administradores pueden leer preguntas"
on trivia.preguntas for select
to authenticated
using ((select trivia.es_admin()));

drop policy if exists "Solo administradores pueden insertar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden insertar preguntas"
on trivia.preguntas for insert
to authenticated
with check ((select trivia.es_admin()));

drop policy if exists "Solo administradores pueden actualizar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden actualizar preguntas"
on trivia.preguntas for update
to authenticated
using ((select trivia.es_admin()))
with check ((select trivia.es_admin()));

drop policy if exists "Solo administradores pueden eliminar preguntas" on trivia.preguntas;
create policy "Solo administradores pueden eliminar preguntas"
on trivia.preguntas for delete
to authenticated
using ((select trivia.es_admin()));


-- ============================================
-- Permisos
-- ============================================
-- Un esquema nuevo no hereda los permisos por defecto que Supabase da en
-- public. En cada corrida se parte de cero y se otorga solo lo necesario.

grant usage on schema trivia to anon, authenticated, service_role;

revoke all on all tables in schema trivia from anon, authenticated;
revoke execute on all functions in schema trivia from public, anon, authenticated;
alter default privileges in schema trivia revoke execute on functions from public;

-- El servidor (service_role) puede todo; nunca se usa desde el navegador.
grant all on all tables in schema trivia to service_role;
grant execute on all functions in schema trivia to service_role;

-- Lectura pública: categorías, perfiles y ranking.
grant select on trivia.categorias, trivia.perfiles, trivia.mejores_puntajes to anon, authenticated;

-- Del perfil, el usuario solo puede escribir sus datos públicos. Los
-- contadores (puntaje_total, partidas_jugadas) los mueve el servidor.
grant insert (id, nombre_usuario, avatar_url) on trivia.perfiles to authenticated;
grant update (nombre_usuario, avatar_url) on trivia.perfiles to authenticated;

-- Lectura de lo propio (las políticas filtran por usuario). La lista de
-- admins nunca se escribe desde el navegador.
grant select on trivia.admins, trivia.partidas, trivia.respuestas_partida to authenticated;

-- Preguntas: se abre la tabla a authenticated, pero las políticas solo
-- dejan pasar a los admins (panel de revisión).
grant select, insert, update, delete on trivia.preguntas to authenticated;

grant execute on function trivia.es_admin() to authenticated;
grant execute on function trivia.obtener_posicion_categoria(uuid, uuid) to anon, authenticated;

-- Todo lo demás (flujo de partida, puntajes) lo ejecuta solo service_role.


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
