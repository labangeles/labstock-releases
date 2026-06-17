import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { cajaCache, cajaQueue } from '../../../lib/cajaOffline';
import { useOnline } from '../../../contexts/OnlineContext';

async function logAct(sedeId, cuadreId, profile, accion, detalle, monto) {
  try {
    await supabase.from('actividad_caja').insert({
      sede_id: sedeId, cuadre_id: cuadreId || null,
      user_id: profile.id, user_name: profile.nombre,
      accion, detalle: detalle || null,
      monto: monto != null ? Number(monto) : null,
    });
  } catch {} // no bloquear si falla el log
}

export function useCuadre(sedeId, profile) {
  const { isOnline, refreshPending } = useOnline();

  const [cuadre, setCuadre]            = useState(null);
  const [gastos, setGastos]            = useState([]);
  const [depositos, setDepositos]      = useState([]);
  const [loading, setLoading]          = useState(true);
  const [saving, setSaving]            = useState(false);
  const [rlsError, setRlsError]        = useState(null);
  const [fromCache, setFromCache]      = useState(false);
  const [soranteAnterior, setSobrante] = useState(null);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Refs para acceder a estado actual dentro de callbacks
  const cuadreRef    = useRef(cuadre);
  const gastosRef    = useRef(gastos);
  const depositosRef = useRef(depositos);
  useEffect(() => { cuadreRef.current    = cuadre;    }, [cuadre]);
  useEffect(() => { gastosRef.current    = gastos;    }, [gastos]);
  useEffect(() => { depositosRef.current = depositos; }, [depositos]);

  const load = useCallback(async () => {
    if (!sedeId || !profile) return;
    setRlsError(null);

    // ── Sin conexión: servir desde caché ──────────────────────
    if (!isOnline) {
      const cached = cajaCache.load(sedeId);
      if (cached?.cuadre?.fecha === today) {
        setCuadre(cached.cuadre);
        setGastos(cached.gastos || []);
        setDepositos(cached.depositos || []);
        setFromCache(true);
      }
      setLoading(false);
      return;
    }

    setFromCache(false);

    // ── Con conexión: carga normal desde Supabase ─────────────
    const { data: existing, error: selectErr } = await supabase
      .from('cuadres_caja').select('*')
      .eq('sede_id', sedeId).eq('fecha', today).maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') {
      // Intentar caché como fallback
      const cached = cajaCache.load(sedeId);
      if (cached?.cuadre?.fecha === today) {
        setCuadre(cached.cuadre);
        setGastos(cached.gastos || []);
        setDepositos(cached.depositos || []);
        setFromCache(true);
        setLoading(false);
        return;
      }
      setRlsError('Sin permiso para leer el cuadre. Contacta al administrador.');
      setLoading(false);
      return;
    }

    let cuadreDelDia = existing;

    // Siempre consultar el último cuadre cerrado anterior para fecha (display) y diferencia.
    // Debe hacerse ANTES de crear el cuadre nuevo para poder persistir sobrante_anterior.
    const { data: anterior } = await supabase
      .from('v_cuadres_resumen').select('fecha, diferencia')
      .eq('sede_id', sedeId).eq('estado', 'cerrado').lt('fecha', today)
      .order('fecha', { ascending: false }).limit(1).maybeSingle();

    if (!cuadreDelDia) {
      // Persistir sobrante_anterior al momento de apertura para que la cadena
      // de acumulación nunca se pierda aunque haya días consecutivos sin depósito.
      const sobranteAntMonto = anterior && Number(anterior.diferencia) > 0
        ? Number(anterior.diferencia) : 0;

      const { data: created, error: insertErr } = await supabase
        .from('cuadres_caja')
        .insert({ sede_id: sedeId, fecha: today, creado_por: profile.id,
                  caja_base: 800, sobrante_anterior: sobranteAntMonto })
        .select().single();
      if (insertErr) {
        setRlsError('Sin permiso para crear el cuadre. Contacta al administrador.');
        setLoading(false);
        return;
      }
      if (created) {
        cuadreDelDia = created;
        await logAct(sedeId, created.id, profile, 'crear_cuadre', 'Cuadre del día creado');
      }
    }

    setCuadre(cuadreDelDia);

    // Usar sobrante_anterior del registro persistido (no diferencia de la vista).
    // La vista solo conoce el día actual; el campo persistido acumula días sin depósito.
    const sobrantePersistido = Number(cuadreDelDia?.sobrante_anterior ?? 0);
    setSobrante(sobrantePersistido > 0
      ? { fecha: anterior?.fecha ?? null, monto: sobrantePersistido }
      : null);

    let gData = [], dData = [];
    if (existing) {
      const [g, d] = await Promise.all([
        supabase.from('gastos_caja').select('*, registrado:registrado_por(nombre)')
          .eq('cuadre_id', existing.id).order('created_at'),
        supabase.from('depositos_caja').select('*, registrado:registrado_por(nombre)')
          .eq('cuadre_id', existing.id).order('created_at'),
      ]);
      gData = g.data || [];
      dData = d.data || [];
      setGastos(gData);
      setDepositos(dData);
    }

    // Guardar en caché tras carga exitosa
    cajaCache.save(sedeId, { cuadre: cuadreDelDia, gastos: gData, depositos: dData });

    setLoading(false);
  }, [sedeId, profile, today, isOnline]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Canal Realtime — solo activo con conexión
  useEffect(() => {
    if (!sedeId || !isOnline) return;
    const ch = supabase.channel(`cuadre-rt-${sedeId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'cuadres_caja',
        filter:`sede_id=eq.${sedeId}` }, () => loadRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'gastos_caja'    }, () => loadRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'depositos_caja' }, () => loadRef.current())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sedeId, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de respaldo: solo cuando online y ventana visible
  useEffect(() => {
    if (!sedeId || !isOnline) return;
    let t = null;
    const start = () => { t = setInterval(() => loadRef.current(), 30_000); };
    const stop  = () => { if (t) { clearInterval(t); t = null; } };
    const onVis = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [sedeId, isOnline]);

  // Cálculos — el sobrante anterior se suma al inicio del día (es efectivo físico en caja)
  const totalGastosCents      = gastos.reduce((s,g)=>s+Math.round(Number(g.monto)*100),0);
  const totalDepositosCents   = depositos.reduce((s,d)=>s+Math.round(Number(d.monto)*100),0);
  const ingresoCents          = Math.round(Number(cuadre?.ingreso_dia||0)*100);
  const cajaBaseCents         = Math.round(Number(cuadre?.caja_base||800)*100);
  const sobranteCents         = soranteAnterior ? Math.round(soranteAnterior.monto * 100) : 0;
  const depositoEsperadoCents = sobranteCents + ingresoCents - totalGastosCents;
  const cajaFinalCents        = cajaBaseCents + sobranteCents + ingresoCents - totalGastosCents - totalDepositosCents;
  const diferenciaCents       = cajaFinalCents - cajaBaseCents;

  const totalGastos      = totalGastosCents / 100;
  const totalDepositos   = totalDepositosCents / 100;
  const ingresoNum       = ingresoCents / 100;
  const cajaBase         = cajaBaseCents / 100;
  const sobrante         = sobranteCents / 100;
  const depositoEsperado = depositoEsperadoCents / 100;
  const cajaFinal        = cajaFinalCents / 100;
  const diferencia       = diferenciaCents / 100;
  const isOpen           = cuadre?.estado === 'abierto';

  // ── Mutaciones con soporte offline ────────────────────────────

  const saveIngreso = async (monto) => {
    if (!cuadre || !isOpen) return;
    const val  = Math.round(Number(monto) * 100) / 100;
    const prev = cuadre.ingreso_dia;
    setSaving(true);
    const updated = { ...cuadre, ingreso_dia: val };
    setCuadre(updated);
    cajaCache.patch(sedeId, { cuadre: updated });

    if (isOnline) {
      const { error } = await supabase.from('cuadres_caja').update({ ingreso_dia: val }).eq('id', cuadre.id);
      if (error) {
        setCuadre(c => ({ ...c, ingreso_dia: prev }));
      } else {
        logAct(sedeId, cuadre.id, profile, 'editar_ingreso', `Ingreso actualizado a Q${val}`, val);
      }
    } else {
      cajaQueue.add({ op:'update', table:'cuadres_caja', rowId: cuadre.id, data:{ ingreso_dia: val } });
      refreshPending();
    }
    setSaving(false);
  };

  const addGasto = async ({ descripcion, categoria, monto, comprobante }) => {
    if (!cuadre || !isOpen) return;
    const val    = Math.round(Number(monto) * 100) / 100;
    const tempId = crypto.randomUUID();
    setSaving(true);

    const newGasto = {
      id: tempId, cuadre_id: cuadre.id, descripcion, categoria,
      monto: val, comprobante: comprobante || null,
      registrado_por: profile.id,
      created_at: new Date().toISOString(),
      registrado: { nombre: profile.nombre },
      _offline: !isOnline,
    };
    const newGastos = [...gastosRef.current, newGasto];
    setGastos(newGastos);
    cajaCache.patch(sedeId, { gastos: newGastos });

    if (isOnline) {
      await supabase.from('gastos_caja').insert({
        id: tempId, cuadre_id: cuadre.id, descripcion, categoria,
        monto: val, comprobante: comprobante || null, registrado_por: profile.id,
      });
      logAct(sedeId, cuadre.id, profile, 'agregar_gasto', `${descripcion} — Q${val}`, val);
    } else {
      cajaQueue.add({ op:'upsert', table:'gastos_caja', data:{
        id: tempId, cuadre_id: cuadre.id, descripcion, categoria,
        monto: val, comprobante: comprobante || null, registrado_por: profile.id,
      }});
      refreshPending();
    }
    setSaving(false);
  };

  const deleteGasto = async (gastoId, descripcion, monto) => {
    if (!cuadre) return;
    setSaving(true);
    const newGastos = gastosRef.current.filter(g => g.id !== gastoId);
    setGastos(newGastos);
    cajaCache.patch(sedeId, { gastos: newGastos });

    if (isOnline) {
      await supabase.from('gastos_caja').delete().eq('id', gastoId);
      logAct(sedeId, cuadre.id, profile, 'eliminar_gasto', `Eliminado: ${descripcion} Q${monto}`, Number(monto));
    } else {
      cajaQueue.add({ op:'delete', table:'gastos_caja', rowId: gastoId });
      refreshPending();
    }
    setSaving(false);
  };

  const addDeposito = async ({ banco, no_boleta, monto }) => {
    if (!cuadre || !isOpen) return;
    const val    = Math.round(Number(monto) * 100) / 100;
    const tempId = crypto.randomUUID();
    setSaving(true);

    const newDep = {
      id: tempId, cuadre_id: cuadre.id, banco, no_boleta, monto: val,
      registrado_por: profile.id,
      created_at: new Date().toISOString(),
      registrado: { nombre: profile.nombre },
      _offline: !isOnline,
    };
    const newDeps = [...depositosRef.current, newDep];
    setDepositos(newDeps);
    cajaCache.patch(sedeId, { depositos: newDeps });

    if (isOnline) {
      await supabase.from('depositos_caja').insert({
        id: tempId, cuadre_id: cuadre.id, banco, no_boleta,
        monto: val, registrado_por: profile.id,
      });
      logAct(sedeId, cuadre.id, profile, 'agregar_deposito', `${banco} boleta ${no_boleta} Q${val}`, val);
    } else {
      cajaQueue.add({ op:'upsert', table:'depositos_caja', data:{
        id: tempId, cuadre_id: cuadre.id, banco, no_boleta,
        monto: val, registrado_por: profile.id,
      }});
      refreshPending();
    }
    setSaving(false);
  };

  const deleteDeposito = async (depositoId, banco, monto) => {
    if (!cuadre) return;
    setSaving(true);
    const newDeps = depositosRef.current.filter(d => d.id !== depositoId);
    setDepositos(newDeps);
    cajaCache.patch(sedeId, { depositos: newDeps });

    if (isOnline) {
      await supabase.from('depositos_caja').delete().eq('id', depositoId);
      logAct(sedeId, cuadre.id, profile, 'eliminar_deposito', `Eliminado: ${banco} Q${monto}`, Number(monto));
    } else {
      cajaQueue.add({ op:'delete', table:'depositos_caja', rowId: depositoId });
      refreshPending();
    }
    setSaving(false);
  };

  const cerrar = async (notas) => {
    if (!cuadre || !isOpen) return;
    const now = new Date().toISOString();
    setSaving(true);
    setCuadre(c => ({ ...c, estado:'cerrado', cerrado_por:profile.id, cerrado_at:now, notas:notas||null }));
    const { error } = await supabase.from('cuadres_caja').update({
      estado:'cerrado', cerrado_por:profile.id, cerrado_at:now, notas:notas||null,
    }).eq('id', cuadre.id);
    if (error) setCuadre(c => ({ ...c, estado:'abierto', cerrado_por:null, cerrado_at:null }));
    else logAct(sedeId, cuadre.id, profile, 'cerrar_cuadre', notas ? `Notas: ${notas}` : 'Cuadre cerrado');
    setSaving(false);
  };

  const reabrir = async () => {
    if (!cuadre || cuadre.estado !== 'cerrado') return;
    setSaving(true);
    setCuadre(c => ({ ...c, estado:'abierto', reabierto_por:profile.id }));
    const { error } = await supabase.from('cuadres_caja').update({
      estado:'abierto', reabierto_por:profile.id,
    }).eq('id', cuadre.id);
    if (error) setCuadre(c => ({ ...c, estado:'cerrado' }));
    else logAct(sedeId, cuadre.id, profile, 'reabrir_cuadre', 'Reabierto por administrador');
    setSaving(false);
  };

  return {
    cuadre, gastos, depositos, loading, saving, isOpen, rlsError, fromCache,
    totalGastos, totalDepositos, ingresoNum,
    cajaBase, sobrante, depositoEsperado, cajaFinal, diferencia,
    soranteAnterior,
    saveIngreso, addGasto, deleteGasto, addDeposito, deleteDeposito,
    cerrar, reabrir, reload: load,
  };
}
