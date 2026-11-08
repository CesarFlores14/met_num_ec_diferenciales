// Motor matemático: dV/dt = Q - C - λV, V(0)=V0. Unidades: litros, días.
export const f = (p) => (t, V) => p.Q - p.C - p.lambda * V;

export function exacta(p, t) {
  const { V0, Q, C, lambda } = p;
  if (lambda === 0) return V0 + (Q - C) * t;
  const Ve = (Q - C) / lambda; // equilibrio
  return Ve + (V0 - Ve) * Math.exp(-lambda * t);
}

export function pasoHeun(fn, t, y, h) {
  const k1 = fn(t, y);
  const k2 = fn(t + h, y + h * k1);
  return y + (h / 2) * (k1 + k2);
}

export function pasoRK4(fn, t, y, h) {
  const k1 = fn(t, y);
  const k2 = fn(t + h / 2, y + (h * k1) / 2);
  const k3 = fn(t + h / 2, y + (h * k2) / 2);
  const k4 = fn(t + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

// Malla de tiempos; el último paso usa el tamaño restante si T no es múltiplo de h.
export function mallaTiempos(T, h) {
  const eps = 1e-9 * Math.max(1, T);
  const ts = [0];
  let n = 1;
  while (n * h < T - eps) { ts.push(n * h); n++; }
  ts.push(T);
  return ts;
}

export function integrar(paso, fn, V0, ts) {
  const ys = [V0];
  for (let i = 0; i < ts.length - 1; i++) {
    ys.push(paso(fn, ts[i], ys[i], ts[i + 1] - ts[i]));
  }
  return ys;
}

export const errorAbsoluto = (ex, ap) => Math.abs(ex - ap);
export const errorRelativoPct = (ex, ap) =>
  ex === 0 ? null : (Math.abs(ex - ap) / Math.abs(ex)) * 100; // null = "No definido"

// Tiempo en que la solución exacta cruza 0 (primer cruce) o null si no ocurre.
export function tiempoAgotamiento(p) {
  const { V0, Q, C, lambda } = p;
  if (V0 <= 0) return 0;
  const d = Q - C;
  if (lambda === 0) return d < 0 ? V0 / -d : null;
  const Ve = d / lambda;
  if (Ve >= 0) return null; // equilibrio no negativo: nunca llega a 0
  return Math.log((V0 - Ve) / -Ve) / lambda;
}

export function volumenEquilibrio(p) {
  return p.lambda === 0 ? null : (p.Q - p.C) / p.lambda;
}

export function validar(p) {
  const errs = [];
  const campos = { V0: 'V₀', capacidad: 'Capacidad', Q: 'Q', C: 'C', lambda: 'λ', T: 'T', h: 'h' };
  for (const [k, n] of Object.entries(campos)) {
    const v = p[k];
    if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) errs.push(`${n} no puede estar vacío ni ser inválido.`);
    else if (Number(v) < 0) errs.push(`${n} no puede ser negativo.`);
  }
  if (errs.length) return errs;
  if (p.V0 > p.capacidad) errs.push('V₀ no puede superar la capacidad del tanque.');
  if (!(p.h > 0)) errs.push('h debe ser mayor que cero.');
  if (!(p.T > 0)) errs.push('T debe ser mayor que cero.');
  if (p.T / p.h > 200000) errs.push('T/h genera demasiadas iteraciones (máx. 200 000).');
  return errs;
}
