-- ══════════════════════════════════════════════════════════════
-- APERTURA AUTOMÁTICA DIARIA DE CUADRES DE CAJA
-- Se ejecuta todos los días a las 00:00 hora Guatemala (06:00 UTC)
-- Días hábiles  → crea el cuadre abierto con caja base Q800
-- Domingos      → crea el cuadre y lo cierra automáticamente en 0
-- ══════════════════════════════════════════════════════════════

-- 1. Función principal
create or replace function aperturar_cuadres_diarios()
returns void
language plpgsql
security definer   -- corre como el dueño, bypasea RLS
set search_path = public
as $$
declare
  v_sede      record;
  v_fecha     date    := current_date;
  v_es_domingo boolean := extract(dow from current_date) = 0;
  v_nuevo_id  uuid;
begin
  for v_sede in select id from sedes loop

    -- No crear si ya existe un cuadre para esta sede hoy
    if exists (
      select 1 from cuadres_caja
      where sede_id = v_sede.id and fecha = v_fecha
    ) then
      continue;
    end if;

    if v_es_domingo then
      -- Domingo: abrir y cerrar de inmediato con todo en 0
      insert into cuadres_caja (
        sede_id, fecha, caja_base, ingreso_dia,
        estado, cerrado_at, notas
      ) values (
        v_sede.id, v_fecha, 800.00, 0.00,
        'cerrado', now(),
        'Apertura y cierre automático — domingo sin operación'
      )
      returning id into v_nuevo_id;

    else
      -- Día hábil: abrir normalmente
      insert into cuadres_caja (
        sede_id, fecha, caja_base, estado
      ) values (
        v_sede.id, v_fecha, 800.00, 'abierto'
      )
      returning id into v_nuevo_id;

    end if;

  end loop;
end;
$$;

-- 2. Habilitar pg_cron (debe estar activada en Dashboard > Database > Extensions)
create extension if not exists pg_cron;

-- 3. Eliminar job previo si existe (para permitir re-ejecutar esta migración)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'apertura-cuadres-diarios') then
    perform cron.unschedule('apertura-cuadres-diarios');
  end if;
end;
$$;

-- 4. Programar: todos los días a las 06:00 UTC = 00:00 Guatemala (UTC-6)
select cron.schedule(
  'apertura-cuadres-diarios',
  '0 6 * * *',
  $cron$ select aperturar_cuadres_diarios(); $cron$
);
