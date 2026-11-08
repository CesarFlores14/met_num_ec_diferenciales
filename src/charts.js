// Gráficas con Chart.js (global). Todos los datos provienen de simular()/convergencia(); nada decorativo.
const inst = {};
const col = { exacta: '#0b3d91', heun: '#f59e0b', rk4: '#16a34a', cap: '#64748b', zero: '#e5484d' };
const $ = (id) => document.getElementById(id);

function make(id, cfg) { inst[id]?.destroy(); inst[id] = new Chart($(id), cfg); }
const axes = (xt, yt, ylog, xlog) => ({
  responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
  scales: { x: { type: xlog ? 'logarithmic' : 'linear', title: { display: true, text: xt } },
    y: { type: ylog ? 'logarithmic' : 'linear', title: { display: true, text: yt } } },
  plugins: { legend: { position: 'bottom' } },
});
const line = (label, data, color, o = {}) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, tension: 0, ...o });

export function dibujar(r, conv, comp) {
  const F = r.filas, many = F.length > 60, pr = many ? 0 : 4;
  const xy = (k, fn = (v) => v) => F.map((f) => ({ x: f.t, y: fn(f[k], f) }));

  // 1) Volúmenes: exacta gruesa de fondo; Heun y RK4 con marcadores distintos para ver el solapamiento.
  const ds = [
    line('Solución analítica', xy('exacta'), col.exacta, { borderWidth: 6, borderColor: '#0b3d9144' }),
    line('Heun (RK2)', xy('heun'), col.heun, { borderDash: [8, 5], pointStyle: 'triangle', pointRadius: pr + 1 }),
    line('RK4', xy('rk4'), col.rk4, { borderDash: [2, 4], pointStyle: 'rectRot', pointRadius: pr + 1 }),
    line('Capacidad del tanque', [{ x: 0, y: r.p.capacidad }, { x: r.p.T, y: r.p.capacidad }], col.cap, { borderDash: [3, 3], borderWidth: 1.5, hidden: !r.excedeCapacidad }),
    line('V = 0 (agotamiento)', [{ x: 0, y: 0 }, { x: r.p.T, y: 0 }], col.zero, { borderWidth: 1.5, hidden: r.agotamiento === null || r.agotamiento > r.p.T }),
  ];
  make('cV', { type: 'line', data: { datasets: ds }, options: axes('t (días)', 'V(t) (litros)') });

  // 2) Diferencia con signo respecto a la exacta, una gráfica por método (cada una con su propia escala).
  const dif = (k, color, lbl) => make('cD' + k, { type: 'line', data: { datasets: [
    line(lbl + ' − analítica', xy(k.toLowerCase() === 'h' ? 'heun' : 'rk4', (v, f) => v - f.exacta), color, { pointRadius: pr, fill: { target: 'origin', above: color + '22', below: color + '22' } })] },
    options: { ...axes('t (días)', 'Aproximado − exacto (L)'), plugins: { legend: { position: 'bottom' } } } });
  dif('H', col.heun, 'Heun'); dif('R', col.rk4, 'RK4');
  const mH = Math.max(...F.map((f) => f.eaHeun)), mR = Math.max(...F.map((f) => f.eaRk4));
  $('notaDif').textContent = `Máxima diferencia: Heun ${mH.toExponential(2)} L · RK4 ${mR.toExponential(2)} L. Cada gráfica usa su propia escala vertical.` + (mH + mR === 0 ? ' Error 0: con λ = 0 la solución es una recta y ambos métodos la reproducen exactamente, por eso las gráficas de error quedan vacías.' : '');

  // 3) Errores absolutos (log). Se omiten ceros exactos porque log(0) no existe.
  const pos = (k) => F.filter((f) => f[k] > 0).map((f) => ({ x: f.t, y: f[k] }));
  make('cE', { type: 'line', data: { datasets: [
    line('Error abs. Heun', pos('eaHeun'), col.heun, { pointRadius: pr }), line('Error abs. RK4', pos('eaRk4'), col.rk4, { pointRadius: pr })] },
    options: axes('t (días)', 'Error absoluto (L, escala log)', true) });

  // 4) Convergencia: error final vs h en escala log-log, con pendientes de referencia h² y h⁴.
  const c = conv.filter((x) => x.eaHeun > 0 && x.eaRk4 > 0);
  if (c.length) {
    const ref = (k, ord, color, lbl) => line(lbl, c.map((x) => ({ x: x.h, y: c[0][k] * (x.h / c[0].h) ** ord })), color, { borderDash: [4, 4], borderWidth: 1, backgroundColor: color });
    make('cK', { type: 'line', data: { datasets: [
      line('Heun', c.map((x) => ({ x: x.h, y: x.eaHeun })), col.heun, { pointRadius: 4, borderWidth: 2.5 }),
      line('RK4', c.map((x) => ({ x: x.h, y: x.eaRk4 })), col.rk4, { pointRadius: 4, borderWidth: 2.5 }),
      ref('eaHeun', 2, col.heun, 'Pendiente h² (ref.)'), ref('eaRk4', 4, col.rk4, 'Pendiente h⁴ (ref.)')] },
      options: axes('h (días, escala log)', 'Error absoluto final (L, escala log)', true, true) });
  } else inst.cK?.destroy();
  $('convBody').innerHTML = conv.map((x) => `<tr><td>${x.h}</td><td>${x.eaHeun.toExponential(3)}</td><td>${x.ordHeun === null ? '—' : x.ordHeun.toFixed(2)}</td><td>${x.eaRk4.toExponential(3)}</td><td>${x.ordRk4 === null ? '—' : x.ordRk4.toFixed(2)}</td></tr>`).join('');

  // 5) Comparación de escenarios (solución analítica con el mismo T actual).
  make('cS', { type: 'line', data: { datasets: comp.map((e, i) => line(e.nombre, e.pts, ['#1d9bf0', '#f59e0b', '#e5484d'][i % 3], { borderWidth: 3 })).concat([
    line('V = 0', [{ x: 0, y: 0 }, { x: r.p.T, y: 0 }], col.zero, { borderWidth: 1, borderDash: [3, 3] })]) },
    options: axes('t (días)', 'V(t) analítico (litros)') });
}
