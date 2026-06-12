-- ============================================================
-- LABSTOCK — Gastos Fijos Mensuales
-- ============================================================
begin;

create table if not exists gastos_fijos (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id),
  sede_id         uuid references sedes(id),          -- NULL = costo de toda la organización
  nombre          text not null,
  categoria       text not null default 'Otros',
  monto_mensual   numeric(10,2) not null check (monto_mensual >= 0),
  activo          boolean not null default true,
  created_at      timestamptz default now()
);

create index if not exists idx_gastos_fijos_org  on gastos_fijos(organizacion_id, activo);
create index if not exists idx_gastos_fijos_sede on gastos_fijos(sede_id);

alter table gastos_fijos enable row level security;

drop policy if exists "gf_select" on gastos_fijos;
create policy "gf_select" on gastos_fijos for select using (
  organizacion_id = auth_org_id()
);

drop policy if exists "gf_insert" on gastos_fijos;
create policy "gf_insert" on gastos_fijos for insert with check (
  organizacion_id = auth_org_id()
  and (select rol from profiles where profiles.id = auth.uid()) = 'admin'
);

drop policy if exists "gf_update" on gastos_fijos;
create policy "gf_update" on gastos_fijos for update using (
  organizacion_id = auth_org_id()
  and (select rol from profiles where profiles.id = auth.uid()) = 'admin'
);

drop policy if exists "gf_delete" on gastos_fijos;
create policy "gf_delete" on gastos_fijos for delete using (
  organizacion_id = auth_org_id()
  and (select rol from profiles where profiles.id = auth.uid()) = 'admin'
);

notify pgrst, 'reload schema';

commit;
