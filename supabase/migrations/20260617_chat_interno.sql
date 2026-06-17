-- =============================================================
-- Chat interno 1:1 para LabStock
-- =============================================================

CREATE TABLE IF NOT EXISTS conversaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL,
  tipo            text NOT NULL DEFAULT 'directo' CHECK (tipo IN ('directo','grupo')),
  nombre          text,
  creado_por      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversacion_miembros (
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ultimo_leido_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversacion_id, profile_id)
);

CREATE TABLE IF NOT EXISTS mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  autor_id        uuid NOT NULL REFERENCES profiles(id),
  contenido       text NOT NULL CHECK (length(contenido) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_conv    ON mensajes(conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_miembros_profile ON conversacion_miembros(profile_id);

-- Helper SECURITY DEFINER para evitar recursión en RLS
CREATE OR REPLACE FUNCTION es_miembro(conv uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversacion_miembros m
    WHERE m.conversacion_id = conv AND m.profile_id = auth.uid()
  );
$$;

-- RLS
ALTER TABLE conversaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversacion_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes              ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_select            ON conversaciones;
DROP POLICY IF EXISTS miembros_select        ON conversacion_miembros;
DROP POLICY IF EXISTS miembros_update_propio ON conversacion_miembros;
DROP POLICY IF EXISTS mensajes_select        ON mensajes;
DROP POLICY IF EXISTS mensajes_insert        ON mensajes;

CREATE POLICY conv_select ON conversaciones
  FOR SELECT USING (es_miembro(id));

CREATE POLICY miembros_select ON conversacion_miembros
  FOR SELECT USING (es_miembro(conversacion_id));

CREATE POLICY miembros_update_propio ON conversacion_miembros
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK  (profile_id = auth.uid());

CREATE POLICY mensajes_select ON mensajes
  FOR SELECT USING (es_miembro(conversacion_id));

CREATE POLICY mensajes_insert ON mensajes
  FOR INSERT WITH CHECK (autor_id = auth.uid() AND es_miembro(conversacion_id));

-- RPC: abrir o reutilizar conversación directa entre dos personas
CREATE OR REPLACE FUNCTION iniciar_conversacion_directa(otro uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yo   uuid := auth.uid();
  conv uuid;
  org  uuid;
BEGIN
  IF otro = yo THEN
    RAISE EXCEPTION 'No puedes iniciar una conversación contigo mismo';
  END IF;

  SELECT c.id INTO conv
  FROM conversaciones c
  WHERE c.tipo = 'directo'
    AND EXISTS (SELECT 1 FROM conversacion_miembros m WHERE m.conversacion_id = c.id AND m.profile_id = yo)
    AND EXISTS (SELECT 1 FROM conversacion_miembros m WHERE m.conversacion_id = c.id AND m.profile_id = otro)
  LIMIT 1;

  IF conv IS NOT NULL THEN
    RETURN conv;
  END IF;

  SELECT organizacion_id INTO org FROM profiles WHERE id = yo;

  INSERT INTO conversaciones (organizacion_id, tipo, creado_por)
  VALUES (org, 'directo', yo)
  RETURNING id INTO conv;

  INSERT INTO conversacion_miembros (conversacion_id, profile_id)
  VALUES (conv, yo), (conv, otro);

  RETURN conv;
END;
$$;

-- Activar Realtime para mensajes
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
