import * as M from './math.js';

export function simular(p) {
  const fn = M.f(p);
  const ts = M.mallaTiempos(p.T, p.h);
  const ex = ts.map((t) => M.exacta(p, t));
  const heun = M.integrar(M.pasoHeun, fn, p.V0, ts);
  const rk4 = M.integrar(M.pasoRK4, fn, p.V0, ts);
  const filas = ts.map((t, i) => ({
    i, t, exacta: ex[i],
    heun: heun[i], eaHeun: M.errorAbsoluto(ex[i], heun[i]), erHeun: M.errorRelativoPct(ex[i], heun[i]),
    rk4: rk4[i], eaRk4: M.errorAbsoluto(ex[i], rk4[i]), erRk4: M.errorRelativoPct(ex[i], rk4[i]),
  }));
  const u = filas[filas.length - 1];
  const mejor = u.eaHeun === u.eaRk4 ? 'Empate' : u.eaHeun < u.eaRk4 ? 'Heun' : 'RK4';
  return {
    p, ts, filas, final: u, mejor,
    agotamiento: M.tiempoAgotamiento(p),
    equilibrio: M.volumenEquilibrio(p),
    maxVolumen: Math.max(...ex),
    excedeCapacidad: Math.max(...ex) > p.capacidad,
  };
}

const fmt = (x, d = 1) => x.toLocaleString('es-BO', { maximumFractionDigits: d });

// Interpretación automática basada exclusivamente en los resultados calculados.
export function interpretar(r) {
  const { p } = r, out = [], d = p.Q - p.C;
  if (d < 0) out.push(`El consumo (${fmt(p.C)} L/día) supera al abastecimiento (${fmt(p.Q)} L/día): el balance neto es ${fmt(d)} L/día y las reservas tienden a disminuir${p.lambda > 0 ? ', agravado por las pérdidas proporcionales' : ''}.`);
  else if (d > 0) out.push(`El abastecimiento supera al consumo en ${fmt(d)} L/día: el volumen tiende a aumentar${p.lambda > 0 ? ` hacia el equilibrio V* = (Q−C)/λ = ${fmt(r.equilibrio)} L` : ' de forma lineal, sin equilibrio (λ = 0)'}.`);
  else out.push(`Q = C: el balance neto es cero. ${p.lambda > 0 ? 'El volumen decae exponencialmente hacia 0 por las pérdidas.' : 'Con λ = 0 el volumen permanece constante.'}`);
  if (r.agotamiento !== null && r.agotamiento <= p.T) out.push(`⚠ La reserva se agota (V = 0) en t ≈ ${fmt(r.agotamiento, 2)} días. Los valores posteriores son negativos en el modelo y NO representan agua físicamente disponible.`);
  else if (r.agotamiento !== null) out.push(`La reserva llegaría a cero en t ≈ ${fmt(r.agotamiento, 2)} días, fuera del horizonte simulado (T = ${fmt(p.T)} días).`);
  else out.push(`En el horizonte simulado la reserva no se agota; volumen final analítico: ${fmt(r.final.exacta)} L (${fmt(100 * r.final.exacta / p.capacidad)} % de la capacidad).`);
  if (r.excedeCapacidad) out.push(`⚠ El modelo alcanza ${fmt(r.maxVolumen)} L, por encima de la capacidad (${fmt(p.capacidad)} L): en la realidad habría rebalse. La solución no fue truncada.`);
  const u = r.final;
  out.push(`Con h = ${p.h} día(s): error absoluto final Heun = ${u.eaHeun.toExponential(3)} L, RK4 = ${u.eaRk4.toExponential(3)} L. Menor error en este escenario: ${r.mejor}.`);
  return out;
}

export function aCSV(r) {
  const h = 'iteracion,t_dias,exacta,heun,ea_heun,er_heun_pct,rk4,ea_rk4,er_rk4_pct';
  const n = (x) => (x === null ? 'No definido' : x);
  return [h, ...r.filas.map((f) => [f.i, f.t, f.exacta, f.heun, f.eaHeun, n(f.erHeun), f.rk4, f.eaRk4, n(f.erRk4)].join(','))].join('\n');
}

// Error final vs h (para la gráfica de convergencia). Orden observado p ≈ log2(e(h)/e(h/2)).
export function convergencia(p) {
  const hs = [4, 2, 1, 0.5, 0.25, 0.125, 0.0625].filter((h) => h <= p.T && p.T / h <= 20000);
  const filas = hs.map((h) => { const u = simular({ ...p, h }).final; return { h, eaHeun: u.eaHeun, eaRk4: u.eaRk4 }; });
  const ord = (a, b) => (a > 1e-10 && b > 1e-10 ? Math.log2(a / b) : null); // bajo 1e-10 domina el ruido de redondeo
  filas.forEach((f, i) => {
    f.ordHeun = i ? ord(filas[i - 1].eaHeun, f.eaHeun) : null;
    f.ordRk4 = i ? ord(filas[i - 1].eaRk4, f.eaRk4) : null;
  });
  return filas;
}
