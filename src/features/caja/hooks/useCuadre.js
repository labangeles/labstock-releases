import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

async function logAct(sedeId, cuadreId, profile, accion, detalle, monto) {
  await supabase.from('actividad_caja').insert({
    sede_id: sedeId,
    cuadre_id: cuadreId || null,
    user_id: profile.id,
    user_name: profile.nombre,
    accion,
    detalle: detalle || null,
    monto: monto != null ? Number(monto) : null,
  });
}

export function useCuadre(sedeId, profile) {
  const [cuadre, setCuadre]       = useState(null);
  const [gastos, setGastos]       = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!sedeId || !profile) return;

    let { data: existing } = await supabase
      .from('cuadres_caja')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('fecha', today)
      .maybeSingle();

    if (!existing) {
      const { data: created, error } = await supabase
        .from('cuadres_caja')
        .insert({ sede_id: sedeId, fecha: today, creado_por: profile.id })
        .select()
        .single();
      if (!error && created) {
        existing = created;
        await logAct(sedeId, created.id, profile, 'crear_cuadre', 'Cuadre del día creado');
      }
    }

    setCuadre(existing);

    if (existing) {
      const [g, d] = await Promise.all([
        supabase.from('gastos_caja').select('*, registrado:registrado_por(nombre)')
          .eq('cuadre_id', existing.id).order('created_at'),
        supabase.from('depositos_caja').select('*, registrado:registrado_por(nombre)')
          .eq('cuadre_id', existing.id).order('created_at'),
      ]);
      setGastos(g.data || []);
      setDepositos(d.data || []);
    }

    setLoading(false);
  }, [sedeId, profile, today]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // loadRef siempre apunta a la versión más reciente de load sin recrear el canal
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Canal Realtime — solo se recrea cuando cambia sedeId
  useEffect(() => {
    if (!sedeId) return;
    const ch = supabase.channel(`cuadre-rt-${sedeId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'cuadres_caja',
        filter:`sede_id=eq.${sedeId}` }, () => loadRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'gastos_caja'    }, () => loadRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'depositos_caja' }, () => loadRef.current())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de respaldo: refresca cada 15 s por si Realtime no dispara
  useEffect(() => {
    if (!sedeId) return;
    const t = setInterval(() => loadRef.current(), 15_000);
    return () => clearInterval(t);
  }, [sedeId]);

  // Cálculos en centavos para evitar errores de punto flotante
  const totalGastosCents    = gastos.reduce((s,g)=>s+Math.round(Number(g.monto)*100),0);
  const totalDepositosCents = depositos.reduce((s,d)=>s+Math.round(Number(d.monto)*100),0);
  const ingresoCents        = Math.round(Number(cuadre?.ingreso_dia||0)*100);
  const cajaBaseCents       = Math.round(Number(cuadre?.caja_base||300)*100);
  const depositoEsperadoCents = ingresoCents - totalGastosCents;
  const cajaFinalCents      = cajaBaseCents + ingresoCents - totalGastosCents - totalDepositosCents;
  const diferenciaCents     = cajaFinalCents - cajaBaseCents;

  const totalGastos       = totalGastosCents / 100;
  const totalDepositos    = totalDepositosCents / 100;
  const ingresoNum        = ingresoCents / 100;
  const cajaBase          = cajaBaseCents / 100;
  const depositoEsperado  = depositoEsperadoCents / 100;
  const cajaFinal         = cajaFinalCents / 100;
  const diferencia        = diferenciaCents / 100;

  const isOpen = cuadre?.estado === 'abierto';

  const saveIngreso = async (monto) => {
    if (!cuadre || !isOpen) return;
    const val = Math.round(Number(monto) * 100) / 100;
    const prev = cuadre.ingreso_dia;
    setSaving(true);
    setCuadre(c => ({ ...c, ingreso_dia: val })); // optimista — antes del await
    const { error } = await supabase.from('cuadres_caja').update({ ingreso_dia: val }).eq('id', cuadre.id);
    if (error) {
      setCuadre(c => ({ ...c, ingreso_dia: prev })); // revertir si falla
    } else {
      await logAct(sedeId, cuadre.id, profile, 'editar_ingreso', `Ingreso actualizado a Q${val}`, val);
    }
    setSaving(false);
  };

  const addGasto = async ({ descripcion, categoria, monto, comprobante }) => {
    if (!cuadre || !isOpen) return;
    const val = Math.round(Number(monto) * 100) / 100;
    setSaving(true);
    await supabase.from('gastos_caja').insert({
      cuadre_id: cuadre.id, descripcion, categoria,
      monto: val, comprobante: comprobante || null,
      registrado_por: profile.id,
    });
    await logAct(sedeId, cuadre.id, profile, 'agregar_gasto', `${descripcion} — Q${val}`, val);
    setSaving(false);
  };

  const deleteGasto = async (gastoId, descripcion, monto) => {
    if (!cuadre) return;
    setSaving(true);
    await supabase.from('gastos_caja').delete().eq('id', gastoId);
    await logAct(sedeId, cuadre.id, profile, 'eliminar_gasto', `Eliminado: ${descripcion} Q${monto}`, Number(monto));
    setSaving(false);
  };

  const addDeposito = async ({ banco, no_boleta, monto }) => {
    if (!cuadre || !isOpen) return;
    const val = Math.round(Number(monto) * 100) / 100;
    setSaving(true);
    await supabase.from('depositos_caja').insert({
      cuadre_id: cuadre.id, banco, no_boleta,
      monto: val, registrado_por: profile.id,
    });
    await logAct(sedeId, cuadre.id, profile, 'agregar_deposito', `${banco} boleta ${no_boleta} Q${val}`, val);
    setSaving(false);
  };

  const deleteDeposito = async (depositoId, banco, monto) => {
    if (!cuadre) return;
    setSaving(true);
    await supabase.from('depositos_caja').delete().eq('id', depositoId);
    await logAct(sedeId, cuadre.id, profile, 'eliminar_deposito', `Eliminado: ${banco} Q${monto}`, Number(monto));
    setSaving(false);
  };

  const cerrar = async (notas) => {
    if (!cuadre || !isOpen) return;
    const now = new Date().toISOString();
    setSaving(true);
    setCuadre(c => ({ ...c, estado:'cerrado', cerrado_por:profile.id, cerrado_at:now, notas:notas||null }));
    const { error } = await supabase.from('cuadres_caja').update({
      estado: 'cerrado',
      cerrado_por: profile.id,
      cerrado_at: now,
      notas: notas || null,
    }).eq('id', cuadre.id);
    if (error) setCuadre(c => ({ ...c, estado:'abierto', cerrado_por:null, cerrado_at:null }));
    else await logAct(sedeId, cuadre.id, profile, 'cerrar_cuadre', notas ? `Notas: ${notas}` : 'Cuadre cerrado');
    setSaving(false);
  };

  const reabrir = async () => {
    if (!cuadre || cuadre.estado !== 'cerrado') return;
    setSaving(true);
    setCuadre(c => ({ ...c, estado:'abierto', reabierto_por:profile.id }));
    const { error } = await supabase.from('cuadres_caja').update({
      estado: 'abierto',
      reabierto_por: profile.id,
    }).eq('id', cuadre.id);
    if (error) setCuadre(c => ({ ...c, estado:'cerrado' }));
    else await logAct(sedeId, cuadre.id, profile, 'reabrir_cuadre', 'Reabierto por administrador');
    setSaving(false);
  };

  return {
    cuadre, gastos, depositos, loading, saving, isOpen,
    totalGastos, totalDepositos, ingresoNum,
    cajaBase, depositoEsperado, cajaFinal, diferencia,
    saveIngreso, addGasto, deleteGasto, addDeposito, deleteDeposito,
    cerrar, reabrir, reload: load,
  };
}
