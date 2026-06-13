-- ============================================================
-- LABSTOCK — Reset de datos operacionales
-- Borra TODO menos usuarios administradores y estructura base
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================

begin;

-- ── 1. Gastos fijos (checklist y plantillas) ─────────────
delete from gastos_fijos_pagos;
delete from gastos_fijos;

-- ── 2. Caja (borrar dependientes antes que cuadres) ──────
delete from actividad_caja;
delete from gastos_caja;
delete from depositos_caja;
delete from cuadres_caja;

-- ── 3. Compras ────────────────────────────────────────────
-- (compras_items cascadea si existe FK; si no, borrar primero)
delete from compras_items where true;   -- ignorar si no existe
delete from compras;

-- ── 4. Pedidos ────────────────────────────────────────────
delete from pedidos_items where true;   -- ignorar si no existe
delete from pedidos;

-- ── 5. Inventario y actividad ────────────────────────────
delete from item_activity where true;   -- ignorar si no existe
delete from items;

-- ── 6. Proveedores ───────────────────────────────────────
delete from proveedores;

-- ── 7. Usuarios no administradores ───────────────────────
-- Primero identificamos los IDs a eliminar
do $$
declare
  uid uuid;
begin
  for uid in
    select id from profiles where rol <> 'admin'
  loop
    -- Eliminar de auth.users cascadea a profiles automáticamente
    delete from auth.users where id = uid;
  end loop;
end;
$$;

commit;

-- ── Verificar resultado ───────────────────────────────────
select rol, count(*) as usuarios
from profiles
group by rol
order by rol;
