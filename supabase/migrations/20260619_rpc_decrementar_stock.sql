-- rpc_decrementar_stock: reduce stock atómicamente, con piso en 0.
-- Usado en ComprasScreen al eliminar una compra para revertir el stock
-- que fue sumado automáticamente al registrarla.

CREATE OR REPLACE FUNCTION public.rpc_decrementar_stock(
  p_item_id uuid,
  p_cantidad integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE items SET
    cantidad_actual = GREATEST(0, cantidad_actual - p_cantidad)
  WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_decrementar_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decrementar_stock(uuid, integer) TO authenticated;
