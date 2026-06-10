-- ============================================================
--  LabStock v2.0 — Esquema de base de datos Supabase
--  INSTRUCCIONES:
--  1. Ve a tu proyecto en supabase.com
--  2. Menú izquierdo → SQL Editor → New query
--  3. Pega TODO este contenido y presiona "Run"
-- ============================================================

-- TABLA: Sedes del laboratorio
CREATE TABLE IF NOT EXISTS public.sedes (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text        NOT NULL,
  ciudad     text        DEFAULT 'Guatemala',
  activa     boolean     DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.sedes (nombre, ciudad) VALUES
  ('Santa Lucía',    'Santa Lucía Cotzumalguapa'),
  ('Siquinalá',      'Siquinalá'),
  ('La Democracia',  'La Democracia'),
  ('La Gomera',      'La Gomera'),
  ('Sipacate',       'Sipacate');

-- TABLA: Perfiles de usuario (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid    REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  codigo     text    UNIQUE,          -- código de acceso para login (ej: sta01)
  nombre     text    NOT NULL,
  rol        text    NOT NULL DEFAULT 'tecnico' CHECK (rol IN ('admin','tecnico')),
  sede_id    uuid    REFERENCES public.sedes(id),
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- TABLA: Inventario de insumos
CREATE TABLE IF NOT EXISTS public.items (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id          uuid    REFERENCES public.sedes(id) ON DELETE CASCADE NOT NULL,
  nombre           text    NOT NULL,
  categoria        text    NOT NULL,
  unidad           text    NOT NULL,
  cantidad_actual  integer NOT NULL DEFAULT 0  CHECK (cantidad_actual  >= 0),
  cantidad_minima  integer NOT NULL DEFAULT 5  CHECK (cantidad_minima  >= 0),
  cantidad_maxima  integer NOT NULL DEFAULT 20 CHECK (cantidad_maxima  >= 1),
  activo           boolean DEFAULT true,
  created_by       uuid    REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- TABLA: Registro de actividad / auditoría
CREATE TABLE IF NOT EXISTS public.actividad (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id           uuid    REFERENCES public.sedes(id),
  item_id           uuid    REFERENCES public.items(id) ON DELETE SET NULL,
  user_id           uuid    REFERENCES public.profiles(id),
  nombre_item       text    NOT NULL,
  nombre_usuario    text    NOT NULL,
  sede_nombre       text    NOT NULL DEFAULT '',
  accion            text    NOT NULL,
  cantidad_anterior integer,
  cantidad_nueva    integer,
  nota              text,
  created_at        timestamptz DEFAULT now()
);

-- ── TRIGGER: updated_at automático ───────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS items_updated_at ON public.items;
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── TRIGGER: crear perfil al registrar usuario ────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, codigo, nombre, rol, sede_id)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'tecnico'),
    NULLIF(NEW.raw_user_meta_data->>'sede_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE public.sedes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividad ENABLE ROW LEVEL SECURITY;

-- sedes: todos los autenticados pueden leer
CREATE POLICY "sedes_read" ON public.sedes
  FOR SELECT TO authenticated USING (true);

-- profiles: todos pueden leer (para listas de usuarios)
CREATE POLICY "profiles_read" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- items: tecnico solo ve su sede; admin ve todas
CREATE POLICY "items_read" ON public.items
  FOR SELECT TO authenticated USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR sede_id = (SELECT sede_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "items_write" ON public.items
  FOR ALL TO authenticated
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR sede_id = (SELECT sede_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR sede_id = (SELECT sede_id FROM public.profiles WHERE id = auth.uid())
  );

-- actividad: tecnico ve solo su sede; admin ve todas
CREATE POLICY "actividad_read" ON public.actividad
  FOR SELECT TO authenticated USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR sede_id = (SELECT sede_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "actividad_insert" ON public.actividad
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── REALTIME (cambios en vivo) ────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.actividad;

-- ── PRIMER USUARIO ADMINISTRADOR ─────────────────────────
-- DESPUÉS de crear el primer usuario en Supabase Dashboard:
--   Authentication → Users → Add user
-- Ejecuta este SQL cambiando el email por el tuyo:
--
-- UPDATE public.profiles
-- SET rol = 'admin', sede_id = NULL
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'tu_email@ejemplo.com');
