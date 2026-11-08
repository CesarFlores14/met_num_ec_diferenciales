// Cliente mínimo vía REST (PostgREST) con la clave pública. Sin dependencias.
import { SUPABASE_URL as URL_CRUDA, SUPABASE_ANON_KEY } from './config.js';
// Normaliza: acepta la URL con o sin '/rest/v1/' al final.
const SUPABASE_URL = URL_CRUDA.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const configurado = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) && !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('TU_');

const base = () => SUPABASE_URL + '/rest/v1';
const hdr = () => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' });

async function req(path, opts = {}) {
  let res;
  try { res = await fetch(base() + path, { ...opts, headers: { ...hdr(), ...(opts.headers || {}) } }); }
  catch { throw new Error('No se pudo contactar con Supabase (red o URL incorrecta).'); }
  if (!res.ok) {
    let m = ''; try { m = (await res.json()).message || ''; } catch {}
    if (res.status === 404 || /relation .* does not exist|schema cache/i.test(m)) throw new Error('Las tablas no existen: ejecute schema.sql en el SQL Editor de Supabase.');
    if (res.status === 401 || res.status === 403) throw new Error('Clave o permisos (RLS) rechazados por Supabase.');
    throw new Error(m || `Error de Supabase (HTTP ${res.status}).`);
  }
  return res.status === 204 ? null : res.json();
}

// Comprobación REAL: consulta una tabla; solo si responde se declara "conectado".
export async function probarConexion() {
  if (!configurado()) return { ok: false, motivo: 'no-configurado' };
  try { await req('/escenarios?select=id&limit=1'); return { ok: true }; }
  catch (e) { return { ok: false, motivo: e.message }; }
}

export const listarEscenarios = () => req('/escenarios?select=*&order=fecha_creacion.desc&limit=100');
export const listarSimulaciones = () => req('/simulaciones?select=*&order=fecha_ejecucion.desc&limit=100');
export const guardarEscenario = (e) =>
  req('/escenarios', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(e) });
export const guardarSimulacion = (s) =>
  req('/simulaciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(s) });
