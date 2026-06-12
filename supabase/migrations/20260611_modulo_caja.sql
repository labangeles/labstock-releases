-- ============================================================
-- LABSTOCK — Módulo Cuadre de Caja
-- Migración: base multi-tenant + tablas de caja + RLS
-- EJECUTAR COMPLETO EN EL SQL EDITOR DE SUPABASE
-- ============================================================

begin;

-- ============================================================
-- 1. MULTI-TENANT: tabla organizaciones
-- ============================================================
create table if not exists organizaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activa     boolean not null default true,
  created_at timestamptz default now()
);

-- Insertar la organización actual solo si no existe ninguna
insert into organizaciones (nombre)
select 'Laboratorio Clínico Los Ángeles'
where not exists (select 1 from organizaciones);

-- Agregar organizacion_id a sedes y profiles
alter table sedes    add column if not exists organizacion_id uuid references organizaciones(id);
alter table profiles add column if not exists organizacion_id uuid references organizaciones(id);

-- Asignar todo lo existente a la primera organización
update sedes
set organizacion_id = (select id from organizaciones limit 1)
where organizacion_id is null;

update profiles
set organizacion_id = (select id from organizaciones limit 1)
where organizacion_id is null;

-- Hacer las columnas obligatorias
alter table sedes    alter column organizacion_id set not null;
alter table profiles alter column organizacion_id set not null;

-- ============================================================
-- 2. COLUMNA permisos EN profiles (para técnicos)
-- ============================================================
alter table profiles
  add column if not exists permisos jsonb not null
  default '{"bodega": true, "caja": false}';

-- ============================================================
-- 3. FUNCIONES HELPER (security definer — evitan joins repetidos)
-- ============================================================
create or replace function auth_org_id()
returns uuid language sql stable security definer
as $$ select organizacion_id from profiles where id = auth.uid() $$;

create or replace function auth_role()
returns text language sql stable security definer
as $$ select rol from profiles where id = auth.uid() $$;

create or replace function auth_sede_id()
returns uuid language sql stable security definer
as $$ select sede_id from profiles where id = auth.uid() $$;

create or replace function auth_caja_perm()
returns boolean language sql stable security definer
as $$ select coalesce((permisos->>'caja')::boolean, false) from profiles where id = auth.uid() $$;

-- ============================================================
-- 4. TABLAS DEL MÓDULO DE CAJA
-- ============================================================
create table if not exists cuadres_caja (
  id            uuid primary key default gen_random_uuid(),
  sede_id       uuid not null references sedes(id),
  fecha         date not null default current_date,
  caja_base     numeric(10,2) not null default 300.00,
  ingreso_dia   numeric(10,2) not null default 0,
  estado        text not null default 'abierto'
                check (estado in ('abierto','cerrado')),
  cerrado_por   uuid references profiles(id),
  cerrado_at    timestamptz,
  reabierto_por uuid references profiles(id),
  notas         text,
  creado_por    uuid not null references profiles(id),
  created_at    timestamptz default now(),
  unique (sede_id, fecha)
);

create table if not exists gastos_caja (
  id             uuid primary key default gen_random_uuid(),
  cuadre_id      uuid not null references cuadres_caja(id) on delete cascade,
  descripcion    text not null,
  categoria      text not null default 'operativo'
                 check (categoria in ('operativo','mantenimiento','transporte',
                                      'papeleria','limpieza','extra','otro')),
  monto          numeric(10,2) not null check (monto > 0),
  comprobante    text,
  registrado_por uuid not null references profiles(id),
  created_at     timestamptz default now()
);

create table if not exists depositos_caja (
  id             uuid primary key default gen_random_uuid(),
  cuadre_id      uuid not null references cuadres_caja(id) on delete cascade,
  banco          text not null,
  no_boleta      text not null,
  monto          numeric(10,2) not null check (monto > 0),
  registrado_por uuid not null references profiles(id),
  created_at     timestamptz default now()
);

create table if not exists actividad_caja (
  id         uuid primary key default gen_random_uuid(),
  sede_id    uuid not null references sedes(id),
  cuadre_id  uuid references cuadres_caja(id),
  user_id    uuid not null references profiles(id),
  user_name  text not null,
  accion     text not null,
  detalle    text,
  monto      numeric(10,2),
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_cuadres_sede_fecha  on cuadres_caja(sede_id, fecha desc);
create index if not exists idx_gastos_cuadre       on gastos_caja(cuadre_id);
create index if not exists idx_depositos_cuadre    on depositos_caja(cuadre_id);
create index if not exists idx_actcaja_sede        on actividad_caja(sede_id, created_at desc);

-- ============================================================
-- 5. VISTA RESUMEN (security_invoker — respeta RLS del usuario)
-- ============================================================
create or replace view v_cuadres_resumen
with (security_invoker = true) as
select
  c.id,
  c.sede_id,
  s.nombre                                            as sede_nombre,
  s.organizacion_id,
  c.fecha,
  c.caja_base,
  c.ingreso_dia,
  coalesce(g.total_gastos, 0)                         as total_gastos,
  coalesce(d.total_depositos, 0)                      as total_depositos,
  c.ingreso_dia - coalesce(g.total_gastos, 0)         as deposito_esperado,
  c.caja_base + c.ingreso_dia
    - coalesce(g.total_gastos, 0)
    - coalesce(d.total_depositos, 0)                  as caja_final,
  (c.caja_base + c.ingreso_dia
    - coalesce(g.total_gastos, 0)
    - coalesce(d.total_depositos, 0)) - c.caja_base   as diferencia,
  c.estado,
  c.cerrado_at,
  c.notas,
  c.creado_por
from cuadres_caja c
join sedes s on s.id = c.sede_id
left join (
  select cuadre_id, sum(monto) as total_gastos
  from gastos_caja group by cuadre_id
) g on g.cuadre_id = c.id
left join (
  select cuadre_id, sum(monto) as total_depositos
  from depositos_caja group by cuadre_id
) d on d.cuadre_id = c.id;

-- ============================================================
-- 6. RLS
-- ============================================================
alter table cuadres_caja   enable row level security;
alter table gastos_caja    enable row level security;
alter table depositos_caja enable row level security;
alter table actividad_caja enable row level security;

-- Helper: ¿el cuadre está abierto?
create or replace function cuadre_is_open(p_cuadre_id uuid)
returns boolean language sql stable security definer
as $$ select estado = 'abierto' from cuadres_caja where id = p_cuadre_id $$;

-- ── cuadres_caja ────────────────────────────────────────────
-- SELECT: admin y auditor ven todos los de su org;
--         técnico solo el de su sede (si tiene permiso caja)
create policy "cuadres_select" on cuadres_caja for select using (
  (select organizacion_id from sedes where id = sede_id) = auth_org_id()
  and (
    auth_role() in ('admin','auditor')
    or (
      auth_role() = 'tecnico'
      and sede_id = auth_sede_id()
      and auth_caja_perm()
    )
  )
);

-- INSERT: admin o técnico de la sede con permiso
create policy "cuadres_insert" on cuadres_caja for insert with check (
  (select organizacion_id from sedes where id = sede_id) = auth_org_id()
  and auth_role() in ('admin','tecnico')
  and (
    auth_role() = 'admin'
    or (sede_id = auth_sede_id() and auth_caja_perm())
  )
);

-- UPDATE cuadre abierto (guardar ingreso, cerrar): admin o técnico con permiso
create policy "cuadres_update_abierto" on cuadres_caja for update using (
  estado = 'abierto'
  and (select organizacion_id from sedes where id = sede_id) = auth_org_id()
  and (
    auth_role() = 'admin'
    or (auth_role() = 'tecnico' and sede_id = auth_sede_id() and auth_caja_perm())
  )
);

-- UPDATE cuadre cerrado (reapertura): solo admin
create policy "cuadres_reopen" on cuadres_caja for update using (
  estado = 'cerrado'
  and auth_role() = 'admin'
  and (select organizacion_id from sedes where id = sede_id) = auth_org_id()
);

-- ── gastos_caja ─────────────────────────────────────────────
create policy "gastos_select" on gastos_caja for select using (
  exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() in ('admin','auditor')
      or (auth_role()='tecnico' and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

create policy "gastos_insert" on gastos_caja for insert with check (
  cuadre_is_open(cuadre_id)
  and exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (auth_role()='tecnico' and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

create policy "gastos_delete" on gastos_caja for delete using (
  exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (cuadre_is_open(cuadre_id) and auth_role()='tecnico'
          and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

-- ── depositos_caja (mismo patrón que gastos) ────────────────
create policy "depositos_select" on depositos_caja for select using (
  exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() in ('admin','auditor')
      or (auth_role()='tecnico' and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

create policy "depositos_insert" on depositos_caja for insert with check (
  cuadre_is_open(cuadre_id)
  and exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (auth_role()='tecnico' and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

create policy "depositos_delete" on depositos_caja for delete using (
  exists (
    select 1 from cuadres_caja c join sedes s on s.id = c.sede_id
    where c.id = cuadre_id and s.organizacion_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (cuadre_is_open(cuadre_id) and auth_role()='tecnico'
          and c.sede_id=auth_sede_id() and auth_caja_perm())
    )
  )
);

-- ── actividad_caja ──────────────────────────────────────────
create policy "actcaja_select" on actividad_caja for select using (
  (select organizacion_id from sedes where id = sede_id) = auth_org_id()
  and auth_role() in ('admin','auditor')
);

create policy "actcaja_insert" on actividad_caja for insert with check (
  (select organizacion_id from sedes where id = sede_id) = auth_org_id()
);

commit;
