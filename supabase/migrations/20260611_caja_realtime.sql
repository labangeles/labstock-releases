-- Habilitar Supabase Realtime para las tablas del módulo Caja.
-- Sin esto, postgres_changes no emite eventos y los componentes React
-- nunca reciben actualizaciones en tiempo real.

-- 1. Agregar tablas a la publicación de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE cuadres_caja;
ALTER PUBLICATION supabase_realtime ADD TABLE gastos_caja;
ALTER PUBLICATION supabase_realtime ADD TABLE depositos_caja;
ALTER PUBLICATION supabase_realtime ADD TABLE actividad_caja;

-- 2. REPLICA IDENTITY FULL para que Realtime incluya la fila completa
--    en eventos UPDATE/DELETE (necesario para el filtro sede_id=eq.*)
ALTER TABLE cuadres_caja   REPLICA IDENTITY FULL;
ALTER TABLE gastos_caja    REPLICA IDENTITY FULL;
ALTER TABLE depositos_caja REPLICA IDENTITY FULL;
ALTER TABLE actividad_caja REPLICA IDENTITY FULL;
