-- ════════════════════════════════════════════════════════════
-- MÓDULO DE ASISTENCIA
-- ════════════════════════════════════════════════════════════

-- Horario laboral por empleado (configurable por admin)
CREATE TABLE IF NOT EXISTS horarios_empleados (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id         uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  organizacion_id     uuid NOT NULL REFERENCES organizaciones(id),

  dias_laborales      integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 1=Lun…7=Dom
  hora_entrada        time NOT NULL DEFAULT '07:00',
  hora_salida         time NOT NULL DEFAULT '17:00',
  duracion_comida_min integer NOT NULL DEFAULT 60,
  tolerancia_min      integer NOT NULL DEFAULT 2,

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(empleado_id)
);

-- Marcajes del día
CREATE TABLE IF NOT EXISTS asistencia_marcajes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id         uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  organizacion_id     uuid NOT NULL REFERENCES organizaciones(id),
  sede_id             uuid REFERENCES sedes(id),

  fecha               date NOT NULL DEFAULT current_date,
  tipo                text NOT NULL CHECK (tipo IN ('entrada','inicio_comida','fin_comida','salida')),
  marcado_en          timestamptz NOT NULL DEFAULT now(),

  hora_programada     time,          -- hora en que debía marcar
  minutos_tardanza    integer DEFAULT 0,
  es_tardanza         boolean DEFAULT false,
  nota                text,

  created_at          timestamptz DEFAULT now(),
  UNIQUE(empleado_id, fecha, tipo)   -- un marcaje por tipo por día
);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE horarios_empleados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_marcajes ENABLE ROW LEVEL SECURITY;

-- Admin/auditor: acceso total a su org
CREATE POLICY "admin_horarios_all" ON horarios_empleados FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_marcajes_all" ON asistencia_marcajes FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

-- Empleado: ver su propio horario
CREATE POLICY "empleado_horario_select" ON horarios_empleados FOR SELECT
  USING (empleado_id = (SELECT id FROM empleados WHERE profile_id = auth.uid() LIMIT 1));

-- Empleado: ver e insertar sus propios marcajes
CREATE POLICY "empleado_marcajes_select" ON asistencia_marcajes FOR SELECT
  USING (empleado_id = (SELECT id FROM empleados WHERE profile_id = auth.uid() LIMIT 1));

CREATE POLICY "empleado_marcajes_insert" ON asistencia_marcajes FOR INSERT
  WITH CHECK (empleado_id = (SELECT id FROM empleados WHERE profile_id = auth.uid() LIMIT 1));
