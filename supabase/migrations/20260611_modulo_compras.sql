-- ============================================================
-- LABSTOCK — Módulo Compras (versión 2 con Proveedores)
-- ============================================================

begin;

-- ============================================================
-- 1. SEDES: habilitar compras solo en La Gomera y Santa Lucía
-- ============================================================
alter table sedes add column if not exists permite_compras boolean not null default false;

update sedes set permite_compras = true
where nombre ilike '%gomera%'
   or nombre ilike '%luc_a%'
   or nombre ilike '%lucia%';

-- ============================================================
-- 2. PROVEEDORES (catálogo a nivel organización)
-- ============================================================
create table if not exists proveedores (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id),
  nombre          text not null,
  codigo_interno  text,
  nit             text,
  telefono        text,
  correo          text,
  activo          boolean not null default true,
  created_at      timestamptz default now()
);

create index if not exists idx_proveedores_org on proveedores(organizacion_id, activo);

-- ============================================================
-- 3. COMPRAS (cabecera de la factura)
-- ============================================================
create table if not exists compras (
  id               uuid primary key default gen_random_uuid(),
  sede_id          uuid not null references sedes(id),
  organizacion_id  uuid not null references organizaciones(id),

  -- Proveedor del catálogo (obligatorio)
  proveedor_id     uuid not null references proveedores(id),

  -- Datos de la factura
  numero_factura   text,
  tipo_documento   text not null default 'fisica',
  fecha_recepcion  date not null default current_date,

  -- Facturación
  monto_total      numeric(10,2) not null,
  cadena_frio      boolean not null default false,

  -- Condiciones de pago
  tipo_pago        text not null default 'contado',
  dias_credito     integer,
  fecha_vencimiento date,

  -- Meta
  estado           text not null default 'activo',
  registrado_por   uuid references profiles(id),
  created_at       timestamptz default now()
);

-- ============================================================
-- 4. COMPRA_ITEMS (líneas vinculadas al inventario)
-- ============================================================
create table if not exists compra_items (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid not null references compras(id) on delete cascade,
  item_id    uuid references items(id),
  nombre     text not null,
  cantidad   numeric(10,2) not null,
  unidad     text,
  categoria  text
);

create index if not exists idx_compras_sede      on compras(sede_id, fecha_recepcion desc);
create index if not exists idx_compras_venc      on compras(fecha_vencimiento) where tipo_pago = 'credito';
create index if not exists idx_compra_items_comp on compra_items(compra_id);

-- ============================================================
-- 5. ROL secretaria + fix CHECK + fix trigger
-- ============================================================
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('admin', 'tecnico', 'auditor', 'secretaria'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, codigo, nombre, rol, sede_id, organizacion_id)
  values (
    NEW.id,
    split_part(NEW.email, '@', 1),
    coalesce(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)),
    coalesce(NEW.raw_user_meta_data->>'rol', 'tecnico'),
    nullif(NEW.raw_user_meta_data->>'sede_id', '')::uuid,
    coalesce(
      (select organizacion_id from public.sedes
       where id = nullif(NEW.raw_user_meta_data->>'sede_id', '')::uuid),
      (select id from public.organizaciones limit 1)
    )
  )
  on conflict (id) do nothing;
  return NEW;
end;
$$;

-- ============================================================
-- 6. RLS — proveedores
-- ============================================================
alter table proveedores enable row level security;

create policy "prov_select" on proveedores for select using (
  organizacion_id = auth_org_id()
);
create policy "prov_insert" on proveedores for insert with check (
  organizacion_id = auth_org_id()
  and auth_role() in ('admin', 'secretaria')
);
create policy "prov_update" on proveedores for update using (
  organizacion_id = auth_org_id()
  and auth_role() in ('admin', 'secretaria')
);

-- ============================================================
-- 7. RLS — compras y compra_items
-- ============================================================
alter table compras      enable row level security;
alter table compra_items enable row level security;

create policy "compras_select" on compras for select using (
  organizacion_id = auth_org_id()
  and (auth_role() in ('admin', 'auditor') or sede_id = auth_sede_id())
);
create policy "compras_insert" on compras for insert with check (
  organizacion_id = auth_org_id()
  and auth_role() in ('admin', 'secretaria')
  and (select permite_compras from sedes where id = sede_id)
  and (auth_role() = 'admin' or sede_id = auth_sede_id())
);
create policy "compras_update" on compras for update using (
  organizacion_id = auth_org_id() and auth_role() = 'admin'
);

create policy "compra_items_select" on compra_items for select using (
  exists (
    select 1 from compras c where c.id = compra_id
      and c.organizacion_id = auth_org_id()
      and (auth_role() in ('admin','auditor') or c.sede_id = auth_sede_id())
  )
);
create policy "compra_items_insert" on compra_items for insert with check (
  exists (
    select 1 from compras c where c.id = compra_id
      and c.organizacion_id = auth_org_id()
      and auth_role() in ('admin','secretaria')
      and (auth_role() = 'admin' or c.sede_id = auth_sede_id())
  )
);

commit;
