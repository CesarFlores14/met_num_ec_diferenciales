import { ESCENARIOS } from './scenarios.js';
import { validar } from './math.js';
import { simular, interpretar, aCSV, convergencia } from './simulation.js';
import { exacta } from './math.js';
import { dibujar } from './charts.js';
import * as DB from './supabase.js';

const $ = (id) => document.getElementById(id);
const CAMPOS = ['V0', 'capacidad', 'Q', 'C', 'lambda', 'T', 'h'];
const fmt = (x, d = 2) => (x === null ? 'No definido' : Number(x).toLocaleString('es-BO', { maximumFractionDigits: d }));
const sci = (x) => (x === null ? 'No definido' : Number(x).toExponential(3));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { nube: false, r: null, scenario: ESCENARIOS[0], memoriaSim: [], memoriaEsc: [], escenariosNube: [] };

const leer = () => Object.fromEntries(CAMPOS.map((k) => [k, $(k).value.trim() === '' ? '' : Number($(k).value)]));
const escribir = (p) => CAMPOS.forEach((k) => ($(k).value = p[k]));

function graficar(r) {
  const n = 120, ts = Array.from({ length: n + 1 }, (_, i) => (r.p.T * i) / n);
  const comp = ESCENARIOS.map((e) => ({ nombre: e.nombre, pts: ts.map((t) => ({ x: t, y: exacta({ ...e, T: r.p.T }, t) })) }));
  dibujar(r, convergencia(r.p), comp);
}

function mostrarSeccion(id) {
  document.querySelectorAll('main section').forEach((s) => (s.hidden = s.id !== id));
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.s === id));
  if (id === 'resultados' && state.r) graficar(state.r);
  if (id === 'historial') cargarHistorial();
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
}

function msg(texto, tipo = 'info') {
  const t = $('toast'); t.textContent = texto; t.className = 'toast ' + tipo; t.hidden = false;
  clearTimeout(msg.t); msg.t = setTimeout(() => (t.hidden = true), 6000);
}

function ejecutar(irA) {
  const p = leer();
  const errs = validar(p);
  $('errores').innerHTML = errs.map((e) => `<li>${esc(e)}</li>`).join('');
  $('errores').hidden = !errs.length;
  if (errs.length) { msg('Corrija los parámetros marcados.', 'err'); return false; }
  const r = (state.r = simular(p));
  render(r);
  if (irA) mostrarSeccion(irA);
  return true;
}

function render(r) {
  const { p, final: u } = r;
  const pct = (100 * p.V0) / p.capacidad;
  $('kV0').textContent = fmt(p.V0, 0) + ' L';
  $('kC').textContent = fmt(p.C, 0) + ' L/día';
  $('kQ').textContent = fmt(p.Q, 0) + ' L/día';
  $('kPct').textContent = fmt(pct, 1) + ' %';
  $('barra').style.width = Math.min(100, pct) + '%';
  $('kFin').textContent = fmt(u.exacta, 0) + ' L';
  $('kAgot').textContent = r.agotamiento !== null && r.agotamiento <= p.T ? 't ≈ ' + fmt(r.agotamiento) + ' días' : 'No se agota en T';
  let est = ['ok', 'Reserva sostenible en el horizonte simulado'];
  if (r.agotamiento !== null && r.agotamiento <= p.T) est = ['bad', 'Agotamiento de la reserva'];
  else if (r.excedeCapacidad) est = ['warn', 'El modelo supera la capacidad del tanque'];
  else if (p.Q - p.C < 0) est = ['warn', 'Reservas en descenso'];
  $('estado').className = 'chip ' + est[0]; $('estado').textContent = est[1];
  $('aviso-cap').hidden = !r.excedeCapacidad;
  $('aviso-cap').textContent = `⚠ El modelo matemático alcanza ${fmt(r.maxVolumen, 0)} L > capacidad ${fmt(p.capacidad, 0)} L. La solución no se truncó; en la realidad habría rebalse.`;
  $('aviso-neg').hidden = !(r.agotamiento !== null && r.agotamiento <= p.T);
  $('resumen').innerHTML = `
    <tr><th></th><th>Heun (RK2)</th><th>RK4</th></tr>
    <tr><th>Volumen final (L)</th><td>${fmt(u.heun)}</td><td>${fmt(u.rk4)}</td></tr>
    <tr><th>Error absoluto final (L)</th><td>${sci(u.eaHeun)}</td><td>${sci(u.eaRk4)}</td></tr>
    <tr><th>Error relativo final (%)</th><td>${u.erHeun === null ? 'No definido' : sci(u.erHeun)}</td><td>${u.erRk4 === null ? 'No definido' : sci(u.erRk4)}</td></tr>
    <tr><th>Volumen analítico final (L)</th><td colspan="2">${fmt(u.exacta)}</td></tr>
    <tr><th>Método con menor error</th><td colspan="2"><b>${r.mejor}</b> (h = ${p.h} d, ${r.filas.length - 1} pasos)</td></tr>`;
  $('tbody').innerHTML = r.filas.slice(0, 5000).map((f) => `<tr><td>${f.i}</td><td>${fmt(f.t, 4)}</td><td>${fmt(f.exacta, 4)}</td>
    <td>${fmt(f.heun, 4)}</td><td>${sci(f.eaHeun)}</td><td>${f.erHeun === null ? 'No definido' : sci(f.erHeun)}</td>
    <td>${fmt(f.rk4, 4)}</td><td>${sci(f.eaRk4)}</td><td>${f.erRk4 === null ? 'No definido' : sci(f.erRk4)}</td></tr>`).join('');
  $('nota-tabla').textContent = r.filas.length > 5000 ? `Se muestran 5000 de ${r.filas.length} filas; el CSV contiene todas.` : `${r.filas.length} filas (iteraciones 0 a ${r.filas.length - 1}).`;
  $('interp').innerHTML = interpretar(r).map((t) => `<li>${esc(t)}</li>`).join('');
  $('verif').innerHTML = `<li>Condición inicial: V(0) = ${fmt(r.filas[0].exacta)} L = V₀ ✔</li>
    <li>Ecuación: V′ = Q − C − λV, con ${r.p.lambda === 0 ? 'λ = 0 ⇒ V(t) = V₀ + (Q−C)t' : 'V(t) = V* + (V₀−V*)e^(−λt), V* = (Q−C)/λ = ' + fmt(r.equilibrio) + ' L'} ✔</li>
    <li>Unidades: litros, días, litros/día, 1/día ✔ (comprobación formal en las pruebas automáticas)</li>`;
  $('hLbl').textContent = r.p.h;
  if (!$('resultados').hidden) graficar(r);
}

function cargarEscenario(e) {
  state.scenario = e;
  escribir(e);
  $('escNombre').textContent = e.nombre; $('escDesc').textContent = e.descripcion;
  $('simNombre').value = e.nombre; $('simDesc').value = e.descripcion;
  ejecutar();
}

function pintarEscenarios() {
  const todos = [...ESCENARIOS, ...state.escenariosNube.map((e) => ({ id: e.id, nombre: e.nombre, descripcion: e.descripcion || '', V0: +e.volumen_inicial, capacidad: +e.capacidad_tanque, Q: +e.abastecimiento_diario, C: +e.consumo_diario, lambda: +e.coeficiente_perdida, T: +e.tiempo_simulacion, h: 1, nube: true })), ...state.memoriaEsc];
  const html = todos.map((e, i) => `<article class="card esc"><h3>${esc(e.nombre)} ${e.nube ? '<small>☁</small>' : e.local ? '<small>(sesión)</small>' : ''}</h3>
    <p>${esc(e.descripcion)}</p><p class="mono">V₀=${fmt(e.V0, 0)} · Q=${fmt(e.Q, 0)} · C=${fmt(e.C, 0)} · λ=${e.lambda} · T=${e.T}</p>
    <button data-i="${i}">Cargar y simular</button></article>`).join('');
  $('listaEsc').innerHTML = html; $('rapidos').innerHTML = html;
  document.querySelectorAll('.esc button').forEach((b) => b.addEventListener('click', () => { cargarEscenario(todos[+b.dataset.i]); mostrarSeccion('resultados'); }));
}

async function cargarHistorial() {
  let filas = state.memoriaSim.map((s) => ({ ...s, _local: true }));
  $('hNota').textContent = '';
  if (state.nube) {
    try { filas = [...(await DB.listarSimulaciones()), ...filas]; }
    catch (e) { $('hNota').textContent = 'Error al consultar Supabase: ' + e.message; }
  } else $('hNota').textContent = 'Modo demostración: solo se muestran simulaciones de esta sesión (se pierden al recargar). No hay nada guardado en la nube.';
  $('hBody').innerHTML = filas.length ? filas.map((s, i) => `<tr><td>${esc(s.nombre)}${s._local ? ' <small>(sesión)</small>' : ''}</td><td>${new Date(s.fecha_ejecucion).toLocaleString('es-BO')}</td>
    <td>${esc(s.paso_h)}</td><td>${fmt(s.volumen_final_analitico, 1)}</td><td>${sci(+s.error_heun)}</td><td>${sci(+s.error_rk4)}</td>
    <td><button data-i="${i}">Cargar</button></td></tr>`).join('') : '<tr><td colspan="7">Sin simulaciones guardadas.</td></tr>';
  document.querySelectorAll('#hBody button').forEach((b) => b.addEventListener('click', () => {
    const s = filas[+b.dataset.i], q = s.parametros;
    escribir({ V0: q.V0, capacidad: q.capacidad, Q: q.Q, C: q.C, lambda: q.lambda, T: q.T, h: s.paso_h });
    $('simNombre').value = s.nombre; $('simDesc').value = q.descripcion || '';
    if (ejecutar('resultados')) msg('Parámetros cargados desde el historial.', 'ok');
  }));
}

async function guardarSim() {
  if (!ejecutar()) return;
  const r = state.r, p = r.p, u = r.final;
  const nombre = $('simNombre').value.trim() || 'Simulación sin nombre';
  const reg = { nombre, parametros: { ...p, descripcion: $('simDesc').value.trim() }, paso_h: p.h,
    volumen_final_analitico: u.exacta, volumen_final_heun: u.heun, volumen_final_rk4: u.rk4,
    error_heun: u.eaHeun, error_rk4: u.eaRk4, fecha_ejecucion: new Date().toISOString() };
  if (!state.nube) { state.memoriaSim.unshift(reg); msg('Modo demostración: guardada solo en memoria de esta sesión (NO en la nube).', 'warn'); return; }
  try {
    const en = state.escenariosNube.find((e) => e.id === state.scenario.id);
    await DB.guardarSimulacion({ ...reg, escenario_id: en ? en.id : null });
    msg('Simulación guardada en Supabase.', 'ok');
  } catch (e) { msg(e.message, 'err'); }
}

async function guardarEsc() {
  const p = leer();
  if (validar(p).length) return ejecutar();
  const nombre = $('simNombre').value.trim() || 'Escenario personalizado', descripcion = $('simDesc').value.trim();
  if (!state.nube) { state.memoriaEsc.unshift({ ...p, id: 'l' + Date.now(), nombre, descripcion, local: true }); pintarEscenarios(); msg('Modo demostración: escenario solo en esta sesión.', 'warn'); return; }
  try {
    await DB.guardarEscenario({ nombre, descripcion, volumen_inicial: p.V0, capacidad_tanque: p.capacidad, abastecimiento_diario: p.Q, consumo_diario: p.C, coeficiente_perdida: p.lambda, tiempo_simulacion: p.T });
    state.escenariosNube = await DB.listarEscenarios(); pintarEscenarios(); msg('Escenario guardado en Supabase.', 'ok');
  } catch (e) { msg(e.message, 'err'); }
}

function descargarCSV() {
  if (!state.r) return;
  const blob = new Blob(['\ufeff' + aCSV(state.r)], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'aquaresiliencia_resultados.csv' });
  a.click(); URL.revokeObjectURL(a.href);
}

async function iniciarConexion() {
  const c = await DB.probarConexion();
  state.nube = c.ok;
  const b = $('conexion');
  if (c.ok) {
    b.className = 'chip ok'; b.textContent = '☁ Supabase conectado';
    try { state.escenariosNube = await DB.listarEscenarios(); } catch (e) { msg(e.message, 'err'); }
  } else if (c.motivo === 'no-configurado') {
    b.className = 'chip warn'; b.textContent = 'Modo demostración (sin Supabase)';
    $('ayudaDB').hidden = false;
  } else {
    b.className = 'chip bad'; b.textContent = 'Supabase con error → modo demostración'; msg(c.motivo, 'err'); $('ayudaDB').hidden = false;
  }
  pintarEscenarios();
}

document.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); mostrarSeccion(a.dataset.s); }));
$('form').addEventListener('submit', (e) => { e.preventDefault(); ejecutar('resultados'); });
$('btnSim').addEventListener('click', () => ejecutar('resultados'));
$('btnCsv').addEventListener('click', descargarCSV);
$('btnGuardar').addEventListener('click', guardarSim);
$('btnGuardarEsc').addEventListener('click', guardarEsc);
$('hRec').addEventListener('click', () => ejecutar());
document.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { $('h').value = b.dataset.h; ejecutar(); }));
$('hLibre').addEventListener('change', (e) => { $('h').value = e.target.value; ejecutar(); });
document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => mostrarSeccion(b.dataset.ir)));

cargarEscenario(ESCENARIOS[0]);
mostrarSeccion((location.hash || '#dashboard').slice(1) in { dashboard: 1, config: 1, escenarios: 1, resultados: 1, tabla: 1, analisis: 1, historial: 1 } ? location.hash.slice(1) : 'dashboard');
iniciarConexion();
