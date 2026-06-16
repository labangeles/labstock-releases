// src/features/rrhh/autoservicio/MiPerfilTab.jsx
// ⚠️ AUTOSERVICIO — Reglas de privacidad (RRHH v2.1):
//   • Prohibido mostrar montos en quetzales (no importar ni usar fmtQ).
//   • Prohibido consultar empleados_compensacion / nomina / nomina_items / prestaciones.
//   • Toda escritura del empleado va por RPC (nunca update() directo a empleados).
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, Field, TInput, TSelect, Ico } from '../../../shared/ui';
import { useMiEmpleado } from '../lib/useMiEmpleado';
import { calcularEdad, calcularAntiguedad } from '../lib/edad';
import { subirFoto, urlFirmada } from '../lib/storage';
import { DEPARTAMENTOS, MUNICIPIOS } from '../lib/guatemala';

const SEL = { value: '', label: 'Selecciona…' };
const SEXO_OPC = [SEL, { value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }];
const ESTADO_CIVIL_OPC = [SEL,
  { value: 'soltero',   label: 'Soltero/a' },
  { value: 'casado',    label: 'Casado/a' },
  { value: 'unido',     label: 'Unido/a' },
  { value: 'divorciado',label: 'Divorciado/a' },
  { value: 'viudo',     label: 'Viudo/a' },
];
const DEPT_OPC = [SEL, ...DEPARTAMENTOS.map((d) => ({ value: d, label: d }))];
const TIPO_CUENTA = [SEL,
  { value: 'monetaria', label: 'Monetaria' },
  { value: 'ahorro', label: 'Ahorro' },
];
const BANCO_OPC = [SEL,
  { value: 'Banco Industrial',           label: 'Banco Industrial' },
  { value: 'Banrural',                   label: 'Banrural' },
  { value: 'BAC Credomatic',             label: 'BAC Credomatic' },
  { value: 'Banco Agromercantil (BAM)',  label: 'Banco Agromercantil (BAM)' },
  { value: 'G&T Continental',            label: 'G&T Continental' },
  { value: 'Bantrab',                    label: 'Bantrab' },
  { value: 'Banco Promerica',            label: 'Banco Promerica' },
  { value: 'Banco Azteca',              label: 'Banco Azteca' },
  { value: 'Banco Inmobiliario',         label: 'Banco Inmobiliario' },
  { value: 'Banco Internacional',        label: 'Banco Internacional' },
  { value: 'Vivibanco',                  label: 'Vivibanco' },
  { value: 'Banco de Antigua',           label: 'Banco de Antigua' },
  { value: 'Ficohsa Guatemala',          label: 'Ficohsa Guatemala' },
  { value: 'Citibank Guatemala',         label: 'Citibank Guatemala' },
];

function Seccion({ titulo, children }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
      <h3 style={{ color: T.hi, marginTop: 0 }}>{titulo}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function mapPerfil(f) {
  return {
    p_foto_path: f.foto_path ?? null,
    p_sexo: f.sexo || null, p_estado_civil: f.estado_civil || null,
    p_numero_igss: f.numero_igss || null, p_telefono: f.telefono || null,
    p_correo: f.correo || null, p_direccion: f.direccion || null,
    p_municipio: f.municipio || null,
    p_departamento_residencia: f.departamento_residencia || null,
    p_fecha_nacimiento: f.fecha_nacimiento || null,
    p_dpi: f.dpi || null, p_nit: f.nit || null,
    p_emergencia_nombre: f.emergencia_nombre || null,
    p_emergencia_telefono: f.emergencia_telefono || null,
    p_emergencia_parentesco: f.emergencia_parentesco || null,
  };
}

export default function MiPerfilTab() {
  const { empleado, loading, reload } = useMiEmpleado();
  const [form, setForm] = useState({});
  const [banco, setBanco] = useState({});
  const [fotoUrl, setFotoUrl] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }));
  const setB = (campo) => (e) =>
    setBanco((b) => ({ ...b, [campo]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (!empleado) return;
    setForm({
      sexo: empleado.sexo || '', estado_civil: empleado.estado_civil || '',
      numero_igss: empleado.numero_igss || '', telefono: empleado.telefono || '',
      correo: empleado.correo || '', direccion: empleado.direccion || '',
      municipio: empleado.municipio || '',
      departamento_residencia: empleado.departamento_residencia || '',
      fecha_nacimiento: empleado.fecha_nacimiento || '',
      dpi: empleado.dpi || '', nit: empleado.nit || '',
      emergencia_nombre: empleado.emergencia_nombre || '',
      emergencia_telefono: empleado.emergencia_telefono || '',
      emergencia_parentesco: empleado.emergencia_parentesco || '',
    });
    if (empleado.foto_path) urlFirmada('rrhh-fotos', empleado.foto_path).then(setFotoUrl);
    supabase.from('empleado_datos_bancarios').select('*')
      .eq('empleado_id', empleado.id).maybeSingle()
      .then(({ data }) => setBanco(data || {}));
  }, [empleado]);

  const onFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !empleado) return;
    try {
      const path = await subirFoto(empleado.id, file);
      await supabase.rpc('rpc_actualizar_mi_perfil', mapPerfil({ ...form, foto_path: path }));
      setFotoUrl(await urlFirmada('rrhh-fotos', path));
      setMsg({ tipo: 'ok', txt: 'Foto actualizada.' });
      reload();
    } catch (err) { setMsg({ tipo: 'err', txt: err.message }); }
  };

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const { error: e1 } = await supabase.rpc('rpc_actualizar_mi_perfil', mapPerfil(form));
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc('rpc_actualizar_mis_datos_bancarios', {
        p_banco: banco.banco || null, p_numero_cuenta: banco.numero_cuenta || null,
        p_tipo_cuenta: banco.tipo_cuenta || null, p_nombre_titular: banco.nombre_titular || null,
      });
      if (e2) throw e2;
      setMsg({ tipo: 'ok', txt: 'Datos guardados.' });
      reload();
    } catch (err) { setMsg({ tipo: 'err', txt: err.message }); }
    setGuardando(false);
  };

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando expediente…</div>;
  if (!empleado) return (
    <div style={{ color: T.lo, padding: 24 }}>
      Tu expediente aún no está creado. Contacta a administración.
    </div>
  );

  const edad = calcularEdad(form.fecha_nacimiento);
  const ant = calcularAntiguedad(empleado.fecha_ingreso);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 880 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden',
                      background: T.canvas, border: `1px solid ${T.border}`, flexShrink: 0 }}>
          {fotoUrl
            ? <img src={fotoUrl} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: T.lo, fontSize: 12 }}>Sin foto</div>}
        </div>
        <div>
          <h2 style={{ color: T.hi, margin: 0 }}>{empleado.nombre} {empleado.apellido}</h2>
          <div style={{ color: T.lo, fontSize: 14 }}>
            {empleado.cargos?.nombre || 'Sin cargo'} · {empleado.sedes?.nombre || 'Sin sede'}
          </div>
          <div style={{ color: T.lo, fontSize: 13 }}>
            Antigüedad: {ant?.texto || '—'}{edad != null ? ` · ${edad} años` : ''}
          </div>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center',
                          marginTop: 8, cursor: 'pointer', color: T.teal, fontSize: 13 }}>
            <Ico.Upload s={14}/> Cambiar foto
            <input type="file" accept="image/png,image/jpeg" hidden onChange={onFoto} />
          </label>
        </div>
      </div>

      <Seccion titulo="Datos personales">
        <Field label="DPI"><TInput value={form.dpi} onChange={set('dpi')} /></Field>
        <Field label="NIT"><TInput value={form.nit} onChange={set('nit')} /></Field>
        <Field label="No. IGSS (carné)"><TInput value={form.numero_igss} onChange={set('numero_igss')} /></Field>
        <Field label="Fecha de nacimiento"><TInput type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} /></Field>
        <Field label="Sexo"><TSelect value={form.sexo} onChange={set('sexo')} options={SEXO_OPC} /></Field>
        <Field label="Estado civil"><TSelect value={form.estado_civil} onChange={set('estado_civil')} options={ESTADO_CIVIL_OPC} /></Field>
        <Field label="Teléfono"><TInput value={form.telefono} onChange={set('telefono')} /></Field>
        <Field label="Correo"><TInput type="email" value={form.correo} onChange={set('correo')} /></Field>
        <Field label="Dirección"><TInput value={form.direccion} onChange={set('direccion')} /></Field>
        <Field label="Departamento">
          <TSelect value={form.departamento_residencia} onChange={(e) => {
            const val = e?.target ? e.target.value : e;
            setForm((f) => ({ ...f, departamento_residencia: val, municipio: '' }));
          }} options={DEPT_OPC} />
        </Field>
        <Field label="Municipio">
          <TSelect value={form.municipio} onChange={set('municipio')}
            options={[SEL, ...(MUNICIPIOS[form.departamento_residencia] || []).map((m) => ({ value: m, label: m }))]}
            disabled={!form.departamento_residencia} />
        </Field>
      </Seccion>

      <Seccion titulo="Contacto de emergencia">
        <Field label="Nombre"><TInput value={form.emergencia_nombre} onChange={set('emergencia_nombre')} /></Field>
        <Field label="Teléfono"><TInput value={form.emergencia_telefono} onChange={set('emergencia_telefono')} /></Field>
        <Field label="Parentesco"><TInput value={form.emergencia_parentesco} onChange={set('emergencia_parentesco')} /></Field>
      </Seccion>

      <Seccion titulo="Datos bancarios (para tu pago)">
        <Field label="Banco"><TSelect value={banco.banco || ''} onChange={setB('banco')} options={BANCO_OPC} /></Field>
        <Field label="No. de cuenta"><TInput value={banco.numero_cuenta || ''} onChange={setB('numero_cuenta')} /></Field>
        <Field label="Tipo de cuenta"><TSelect value={banco.tipo_cuenta || ''} onChange={setB('tipo_cuenta')} options={TIPO_CUENTA} /></Field>
        <Field label="Nombre del titular"><TInput value={banco.nombre_titular || ''} onChange={setB('nombre_titular')} /></Field>
      </Seccion>

      {msg && (
        <div style={{ color: msg.tipo === 'ok' ? T.ok : T.crit, fontSize: 14 }}>{msg.txt}</div>
      )}
      <div>
        <Btn onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Btn>
      </div>
    </div>
  );
}
