-- ============================================================
-- LABSTOCK — Gastos Fijos v2: plantillas + checklist mensual
-- ============================================================
begin;

-- 1. Ampliar la tabla gastos_fijos con datos de la plantilla
alter table gastos_fijos add column if not exists tipo_pago      text default 'efectivo';  -- efectivo | transferencia
alter table gastos_fijos add column if not exists beneficiario   text;   -- nombre de quien recibe el pago
alter table gastos_fijos add column if not exists banco          text;   -- nombre del banco
alter table gastos_fijos add column if not exists numero_cuenta  text;   -- cuenta bancaria destino
alter table gastos_fijos add column if not exists dia_vencimiento integer check (dia_vencimiento between 1 and 31);
alter table gastos_fijos add column if not exists notas          text;

-- 2. Tabla de pagos mensuales (checklist)
create table if not exists gastos_fijos_pagos (
  id              uuid primary key default gen_random_uuid(),
  gasto_fijo_id   uuid not null references gastos_fijos(id) on delete cascade,
  organizacion_id uuid not null references organizaciones(id),
  sede_id         uuid references sedes(id),
  mes             integer not null check (mes between 1 and 12),
  anio            integer not null,
  pagado          boolean not null default false,
  fecha_pago      date,
  monto_pagado    numeric(10,2),
  metodo_pago     text,       -- efectivo | transferencia
  comprobante     text,       -- no. boleta, referencia de transferencia, etc.
  notas           text,
  registrado_por  uuid references profiles(id),
  created_at      timestamptz default now(),
  unique (gasto_fijo_id, mes, anio)
);

create index if not exists idx_gfp_periodo on gastos_fijos_pagos(organizacion_id, anio, mes);
create index if not exists idx_gfp_gasto   on gastos_fijos_pagos(gasto_fijo_id);

alter table gastos_fijos_pagos enable row level security;

drop policy if exists "gfp_select" on gastos_fijos_pagos;
create policy "gfp_select" on gastos_fijos_pagos for select using (
  organizacion_id = auth_org_id()
);

drop policy if exists "gfp_insert" on gastos_fijos_pagos;
create policy "gfp_insert" on gastos_fijos_pagos for insert with check (
  organizacion_id = auth_org_id()
  and (select rol from profiles where profiles.id = auth.uid()) = 'admin'
);

drop policy if exists "gfp_update" on gastos_fijos_pagos;
create policy "gfp_update" on gastos_fijos_pagos for update using (
  organizacion_id = auth_org_id()
  and (select rol from profiles where profiles.id = auth.uid()) = 'admin'
);

notify pgrst, 'reload schema';

commit;
