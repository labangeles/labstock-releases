// src/features/rrhh/autoservicio/MisVacacionesTab.jsx
// ⚠️ AUTOSERVICIO — vacaciones SIEMPRE en días, nunca en quetzales.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, Field, TInput, StatCard, Ico } from '../../../shared/ui';
import { useMiEmpleado } from '../lib/useMiEmpleado';
import CalendarioVacaciones from '../components/CalendarioVacaciones';
import { contarDiasHabiles } from '../lib/vacaciones';

const BADGE = {
  solicitado: { c: T.warn, bg: T.warnBg, txt: 'Solicitado' },
  aprobado:   { c: T.ok,   bg: T.okBg,   txt: 'Aprobado' },
  rechazado:  { c: T.crit, bg: T.critBg, txt: 'Rechazado' },
};

export default function MisVacacionesTab() {
  const { empleado, loading } = useMiEmpleado();
  const [saldo, setSaldo] = useState(null);
  const [feriados, setFeriados] = useState(new Set());
  const [historial, setHistorial] = useState([]);
  const [mes, setMes] = useState(new Date());
  const [rango, setRango] = useState({ inicio: null, fin: null });
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    if (!empleado) return;
    const [s, f, h] = await Promise.all([
      supabase.from('v_saldo_vacaciones').select('*').eq('empleado_id', empleado.id).maybeSingle(),
      supabase.from('feriados').select('fecha').eq('organizacion_id', empleado.organizacion_id),
      supabase.from('vacaciones_permisos').select('*').eq('empleado_id', empleado.id)
        .order('fecha_inicio', { ascending: false }),
    ]);
    setSaldo(s.data || null);
    setFeriados(new Set((f.data || []).map((x) => x.fecha)));
    setHistorial(h.data || []);
  }, [empleado]);

  useEffect(() => { cargar(); }, [cargar]);

  // 1er clic = inicio, 2do = fin (ordena automáticamente)
  const onSelect = (s) => {
    setRango((r) => {
      if (!r.inicio || r.fin) return { inicio: s, fin: null };
      return s < r.inicio ? { inicio: s, fin: r.inicio } : { inicio: r.inicio, fin: s };
    });
  };

  const diasSel = contarDiasHabiles(rango.inicio, rango.fin, feriados);

  const solicitar = async () => {
    if (!rango.inicio || !rango.fin) { setMsg({ tipo: 'err', txt: 'Selecciona un rango de fechas.' }); return; }
    setEnviando(true); setMsg(null);
    const { error } = await supabase.rpc('rpc_solicitar_vacaciones', {
      p_fecha_inicio: rango.inicio, p_fecha_fin: rango.fin, p_motivo: motivo || null,
    });
    if (error) setMsg({ tipo: 'err', txt: error.message });
    else {
      setMsg({ tipo: 'ok', txt: 'Solicitud enviada. Queda pendiente de aprobación.' });
      setRango({ inicio: null, fin: null }); setMotivo('');
      cargar();
    }
    setEnviando(false);
  };

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;
  if (!empleado) return <div style={{ color: T.lo, padding: 24 }}>Tu expediente aún no está creado. Contacta a administración.</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Saldo SOLO en días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Días al año" value={saldo?.dias_anuales ?? '—'} icon={<Ico.Calendar s={20}/>} accent={T.teal} />
        <StatCard label="Días tomados" value={saldo?.dias_tomados ?? 0} icon={<Ico.Check s={20}/>} accent={T.warn} />
        <StatCard label="Días disponibles" value={saldo?.dias_disponibles ?? '—'} icon={<Ico.Activity s={20}/>} accent={T.ok} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
        <CalendarioVacaciones mes={mes} onMes={setMes} rango={rango} onSelect={onSelect} feriados={feriados} />

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
            <h3 style={{ color: T.hi, marginTop: 0 }}>Solicitar vacaciones</h3>
            <div style={{ color: T.lo, fontSize: 14, marginBottom: 8 }}>
              {rango.inicio && rango.fin
                ? <>Del <b>{rango.inicio}</b> al <b>{rango.fin}</b> · <b>{diasSel}</b> día(s) hábil(es)</>
                : 'Elige la fecha de inicio y la de fin en el calendario.'}
            </div>
            <Field label="Motivo (opcional)">
              <TInput value={motivo} onChange={(e) => setMotivo(e?.target ? e.target.value : e)}
                placeholder="Ej. descanso anual" />
            </Field>
            {msg && <div style={{ color: msg.tipo === 'ok' ? T.ok : T.crit, fontSize: 14, margin: '8px 0' }}>{msg.txt}</div>}
            <Btn onClick={solicitar} disabled={enviando || !rango.inicio || !rango.fin}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </Btn>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
            <h3 style={{ color: T.hi, marginTop: 0 }}>Mis solicitudes</h3>
            {historial.length === 0 && <div style={{ color: T.lo }}>Aún no tienes solicitudes.</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {historial.map((v) => {
                const b = BADGE[v.estado] || BADGE.solicitado;
                return (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                    <div style={{ color: T.hi, fontSize: 14 }}>
                      {v.fecha_inicio} → {v.fecha_fin} · {v.dias_habiles} día(s)
                      {v.nota_aprobacion && <div style={{ color: T.lo, fontSize: 12 }}>Nota: {v.nota_aprobacion}</div>}
                    </div>
                    <span style={{ color: b.c, background: b.bg, padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>
                      {b.txt}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
