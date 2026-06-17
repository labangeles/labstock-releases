-- Soporte para horarios distintos por día de la semana (ej. sábado medio día).
-- horarios_especiales: JSON { "6": { "hora_entrada": "07:00", "hora_salida": "12:00" } }
-- Clave = número de día (1=Lun … 7=Dom). Solo se almacenan los días que difieren del general.
ALTER TABLE horarios_empleados
  ADD COLUMN IF NOT EXISTS horarios_especiales jsonb NOT NULL DEFAULT '{}';
