-- Agregar desayuno al módulo de asistencia

-- 1. Ampliar CHECK de tipos
ALTER TABLE asistencia_marcajes
  DROP CONSTRAINT IF EXISTS asistencia_marcajes_tipo_check;

ALTER TABLE asistencia_marcajes
  ADD CONSTRAINT asistencia_marcajes_tipo_check
  CHECK (tipo IN ('entrada','inicio_desayuno','fin_desayuno','inicio_comida','fin_comida','salida'));

-- 2. Agregar columnas de desayuno al horario
ALTER TABLE horarios_empleados
  ADD COLUMN IF NOT EXISTS tiene_desayuno       boolean NOT NULL DEFAULT false;

ALTER TABLE horarios_empleados
  ADD COLUMN IF NOT EXISTS duracion_desayuno_min integer NOT NULL DEFAULT 15;
