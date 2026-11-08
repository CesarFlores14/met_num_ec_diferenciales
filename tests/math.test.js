import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/math.js';
import { simular } from '../src/simulation.js';

const base = { V0: 5000, capacidad: 10000, Q: 300, C: 600, lambda: 0.02, T: 10, h: 1 };
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('condición inicial V(0)=V0', () => close(M.exacta(base, 0), base.V0));

test('la solución exacta satisface la EDO (derivada numérica)', () => {
  const t = 3, e = 1e-5;
  const dV = (M.exacta(base, t + e) - M.exacta(base, t - e)) / (2 * e);
  close(dV, M.f(base)(t, M.exacta(base, t)), 1e-4);
});

test('caso λ=0 es lineal', () => {
  const p = { ...base, lambda: 0 };
  close(M.exacta(p, 4), 5000 + (300 - 600) * 4);
  const r = simular(p);
  close(r.final.heun, r.final.exacta, 1e-8);
  close(r.final.rk4, r.final.exacta, 1e-8);
});

test('equilibrio Q=C con λ>0: V=V0 e^{-λt}', () => {
  const p = { ...base, Q: 500, C: 500 };
  close(M.exacta(p, 5), 5000 * Math.exp(-0.1));
});

test('V0 = equilibrio permanece constante', () => {
  const p = { ...base, Q: 600, C: 400, lambda: 0.04, V0: 5000 };
  close(M.exacta(p, 7), 5000);
  close(simular(p).final.rk4, 5000, 1e-8);
});

test('un paso de Heun y RK4 verificado a mano (y\'=-y, h=0.1)', () => {
  const fn = (t, y) => -y;
  close(M.pasoHeun(fn, 0, 1, 0.1), 1 - 0.1 + 0.005);
  close(M.pasoRK4(fn, 0, 1, 0.1), 1 - 0.1 + 0.005 - 0.1 ** 3 / 6 + 0.1 ** 4 / 24);
});

test('error absoluto y relativo; relativo indefinido si exacto=0', () => {
  close(M.errorAbsoluto(10, 8), 2);
  close(M.errorRelativoPct(10, 8), 20);
  assert.equal(M.errorRelativoPct(0, 1), null);
});

test('malla: último paso restante cuando T no es múltiplo de h', () => {
  assert.deepEqual(M.mallaTiempos(10, 3), [0, 3, 6, 9, 10]);
  assert.equal(M.mallaTiempos(10, 0.5).length, 21);
  assert.equal(M.mallaTiempos(10, 1).at(-1), 10);
});

test('ambos métodos comparten malla; extremo = T', () => {
  const r = simular({ ...base, h: 3 });
  assert.equal(r.filas.at(-1).t, 10);
  assert.equal(r.filas.length, 5);
});

test('convergencia: error disminuye al reducir h (Heun ~h², RK4 ~h⁴)', () => {
  const hs = [2, 1, 0.5, 0.25];
  const eH = hs.map((h) => simular({ ...base, h }).final.eaHeun);
  const eR = hs.map((h) => simular({ ...base, h }).final.eaRk4);
  for (let i = 1; i < hs.length; i++) { assert.ok(eH[i] < eH[i - 1]); assert.ok(eR[i] < eR[i - 1]); }
  const ordH = Math.log2(eH[2] / eH[3]), ordR = Math.log2(eR[1] / eR[2]);
  assert.ok(ordH > 1.8 && ordH < 2.2, `orden Heun ${ordH}`);
  assert.ok(ordR > 3.5 && ordR < 4.5, `orden RK4 ${ordR}`);
});

test('escenario de agotamiento: V(t*)=0 y valores posteriores negativos sin truncar', () => {
  const p = { ...base, Q: 0, C: 600, lambda: 0.02, V0: 3000, T: 20 };
  const ts = M.tiempoAgotamiento(p);
  assert.ok(ts > 0 && ts < 20);
  close(M.exacta(p, ts), 0, 1e-6);
  assert.ok(simular(p).final.exacta < 0);
});

test('agotamiento con λ=0 y ausencia con equilibrio positivo', () => {
  close(M.tiempoAgotamiento({ ...base, lambda: 0, Q: 0, C: 500, V0: 2000 }), 4);
  assert.equal(M.tiempoAgotamiento({ ...base, Q: 900, C: 600 }), null);
});

test('excedente de capacidad detectado sin truncar', () => {
  const r = simular({ ...base, V0: 9000, Q: 2000, C: 100, lambda: 0.01, T: 30 });
  assert.equal(r.excedeCapacidad, true);
  assert.ok(r.final.exacta > 10000);
});

test('validaciones', () => {
  assert.equal(M.validar(base).length, 0);
  assert.ok(M.validar({ ...base, V0: 20000 }).length);
  assert.ok(M.validar({ ...base, h: 0 }).length);
  assert.ok(M.validar({ ...base, T: 0 }).length);
  assert.ok(M.validar({ ...base, lambda: -1 }).length);
  assert.ok(M.validar({ ...base, Q: '' }).length);
});

test('convergencia(): errores decrecen con h y órdenes observados ≈ 2 (Heun) y ≈ 4 (RK4)', async () => {
  const { convergencia } = await import('../src/simulation.js');
  const c = convergencia({ ...base, T: 10 });
  assert.ok(c.length >= 5);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].eaHeun < c[i - 1].eaHeun);
  const oH = c.find((x) => x.h === 0.25).ordHeun, oR = c.find((x) => x.h === 0.5).ordRk4;
  assert.ok(oH > 1.8 && oH < 2.2, `Heun ${oH}`);
  assert.ok(oR > 3.5 && oR < 4.5, `RK4 ${oR}`);
});
