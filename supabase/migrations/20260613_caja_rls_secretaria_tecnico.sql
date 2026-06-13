-- ============================================================
-- LABSTOCK — RLS Caja para secretaria (y verificación técnico)
-- Ejecutar en: Supabase SQL Editor
-- Problema resuelto: secretaria veía cuadre siempre "Cerrado"
-- porque las políticas RLS no incluían el rol secretaria.
-- ============================================================

-- ── cuadres_caja ────────────────────────────────────────────

-- SELECT: secretaria ve cuadres de su sede
drop policy if exists "cuadres_caja_secretaria_select" on cuadres_caja;
create policy "cuadres_caja_secretaria_select" on cuadres_caja
for select using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and sede_id = (select sede_id from profiles where profiles.id = auth.uid())
);

-- INSERT: secretaria puede crear el cuadre del día en su sede
drop policy if exists "cuadres_caja_secretaria_insert" on cuadres_caja;
create policy "cuadres_caja_secretaria_insert" on cuadres_caja
for insert with check (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and sede_id = (select sede_id from profiles where profiles.id = auth.uid())
);

-- UPDATE: secretaria puede registrar ingreso y cerrar cuadre de su sede
drop policy if exists "cuadres_caja_secretaria_update" on cuadres_caja;
create policy "cuadres_caja_secretaria_update" on cuadres_caja
for update using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and sede_id = (select sede_id from profiles where profiles.id = auth.uid())
);

-- ── gastos_caja ─────────────────────────────────────────────

drop policy if exists "gastos_caja_secretaria_select" on gastos_caja;
create policy "gastos_caja_secretaria_select" on gastos_caja
for select using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

drop policy if exists "gastos_caja_secretaria_insert" on gastos_caja;
create policy "gastos_caja_secretaria_insert" on gastos_caja
for insert with check (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

drop policy if exists "gastos_caja_secretaria_delete" on gastos_caja;
create policy "gastos_caja_secretaria_delete" on gastos_caja
for delete using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

-- ── depositos_caja ───────────────────────────────────────────

drop policy if exists "depositos_caja_secretaria_select" on depositos_caja;
create policy "depositos_caja_secretaria_select" on depositos_caja
for select using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

drop policy if exists "depositos_caja_secretaria_insert" on depositos_caja;
create policy "depositos_caja_secretaria_insert" on depositos_caja
for insert with check (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

drop policy if exists "depositos_caja_secretaria_delete" on depositos_caja;
create policy "depositos_caja_secretaria_delete" on depositos_caja
for delete using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and cuadre_id in (
    select id from cuadres_caja
    where sede_id = (select sede_id from profiles where profiles.id = auth.uid())
  )
);

-- ── actividad_caja ───────────────────────────────────────────

drop policy if exists "actividad_caja_secretaria_insert" on actividad_caja;
create policy "actividad_caja_secretaria_insert" on actividad_caja
for insert with check (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
);

drop policy if exists "actividad_caja_secretaria_select" on actividad_caja;
create policy "actividad_caja_secretaria_select" on actividad_caja
for select using (
  (select rol from profiles where profiles.id = auth.uid()) = 'secretaria'
  and sede_id = (select sede_id from profiles where profiles.id = auth.uid())
);

-- ── Verificar resultado ──────────────────────────────────────
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename in ('cuadres_caja','gastos_caja','depositos_caja','actividad_caja')
order by tablename, cmd;
