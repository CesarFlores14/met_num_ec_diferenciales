// Escenarios HIPOTÉTICOS (no son mediciones oficiales). Todos los valores son editables en la interfaz.
// Unidades: litros, litros/día, 1/día, días. Ejemplo: tanque comunitario de 10 000 L.
export const ESCENARIOS = [
  { id: 'normal', nombre: 'Abastecimiento normal',
    descripcion: 'Entrada y consumo moderados y casi equilibrados; pérdidas pequeñas (fugas/evaporación) de 1 % diario.',
    V0: 6000, capacidad: 10000, Q: 900, C: 750, lambda: 0.01, T: 15, h: 1 },
  { id: 'reducido', nombre: 'Abastecimiento reducido',
    descripcion: 'La entrada baja a 40 % del caso normal, el consumo habitual se mantiene y las pérdidas siguen en 1 % diario.',
    V0: 6000, capacidad: 10000, Q: 360, C: 750, lambda: 0.01, T: 15, h: 1 },
  { id: 'interrupcion', nombre: 'Interrupción del suministro',
    descripcion: 'Sin entrada de agua (Q = 0); el consumo se cubre solo con la reserva y hay pérdidas proporcionales de 2 % diario.',
    V0: 6000, capacidad: 10000, Q: 0, C: 750, lambda: 0.02, T: 15, h: 1 },
];
