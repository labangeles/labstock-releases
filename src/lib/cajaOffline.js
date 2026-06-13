/**
 * cajaOffline.js
 * Cache + cola de escrituras para soporte offline del módulo Caja.
 * Usa localStorage — sin dependencias externas.
 */
import { supabase } from './supabase';

const CACHE_KEY = 'ls_caja_v1';
const QUEUE_KEY = 'ls_queue_v1';

// ── Utilidades JSON seguras ────────────────────────────────────
const read  = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── Cache de datos del día ─────────────────────────────────────
export const cajaCache = {
  save(sedeId, { cuadre, gastos, depositos }) {
    const all = read(CACHE_KEY) || {};
    all[sedeId] = { cuadre, gastos, depositos, savedAt: new Date().toISOString() };
    write(CACHE_KEY, all);
  },

  load(sedeId) {
    const all = read(CACHE_KEY) || {};
    return all[sedeId] || null;
  },

  // Actualizar solo gastos/depositos en cache (tras mutación optimista)
  patch(sedeId, { gastos, depositos, cuadre }) {
    const all = read(CACHE_KEY) || {};
    if (!all[sedeId]) return;
    if (gastos   !== undefined) all[sedeId].gastos   = gastos;
    if (depositos !== undefined) all[sedeId].depositos = depositos;
    if (cuadre   !== undefined) all[sedeId].cuadre   = cuadre;
    write(CACHE_KEY, all);
  },
};

// ── Cola de escrituras ─────────────────────────────────────────
export const cajaQueue = {
  add(op) {
    const q = read(QUEUE_KEY) || [];
    q.push({ ...op, _qid: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    write(QUEUE_KEY, q);
    return q[q.length - 1]._qid;
  },

  remove(qid) {
    const q = (read(QUEUE_KEY) || []).filter(i => i._qid !== qid);
    write(QUEUE_KEY, q);
  },

  getAll() { return read(QUEUE_KEY) || []; },

  count() { return (read(QUEUE_KEY) || []).length; },
};

// ── Sincronización de cola ─────────────────────────────────────
export async function syncQueue() {
  const items = cajaQueue.getAll();
  if (!items.length) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;

  for (const item of items) {
    try {
      let err = null;

      if (item.op === 'upsert') {
        ({ error: err } = await supabase.from(item.table).upsert(item.data, { onConflict: 'id' }));
      } else if (item.op === 'update') {
        ({ error: err } = await supabase.from(item.table).update(item.data).eq('id', item.rowId));
      } else if (item.op === 'delete') {
        ({ error: err } = await supabase.from(item.table).delete().eq('id', item.rowId));
      }

      // 23505 = clave duplicada → ya fue insertado, igual se elimina de la cola
      if (!err || err.code === '23505') {
        cajaQueue.remove(item._qid);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// ── Verificar conexión real (ping a Supabase) ─────────────────
export async function checkConnection() {
  if (!navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const { error } = await supabase.from('sedes').select('id').limit(1).abortSignal(ctrl.signal);
    clearTimeout(timer);
    return !error;
  } catch {
    return false;
  }
}
