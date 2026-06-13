-- Cambiar caja base de Q300 a Q800
alter table cuadres_caja
  alter column caja_base set default 800.00;

-- Actualizar todos los cuadres que aún tienen el valor viejo Q300
update cuadres_caja
  set caja_base = 800.00
  where caja_base = 300.00;
