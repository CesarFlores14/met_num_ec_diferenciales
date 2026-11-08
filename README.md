# 💧 AquaResiliencia

**Simulador matemático de autonomía y gestión de reservas de agua ante interrupciones del suministro.**
Autor: Cesar Mauricio Flores Laura · UMSA · Informática (mención Desarrollo de Software e Innovación Tecnológica) · Métodos Numéricos.

> Los parámetros y escenarios son **hipotéticos y editables**. Los resultados no son predicciones reales ni mediciones oficiales.

## Problema estudiado
Las interrupciones del suministro afectan a hogares y comunidades que dependen de tanques (La Paz y El Alto). Pregunta central: ¿cómo estimar la disponibilidad y autonomía de una reserva ante distintos escenarios de consumo, pérdidas y abastecimiento, con ecuaciones diferenciales y métodos numéricos?

## Modelo (EDO)
`dV/dt = Q − C − λV`, `V(0) = V₀`

| Símbolo | Significado | Unidad |
|---|---|---|
| V(t) | volumen almacenado | litros |
| t | tiempo | días |
| V₀ | volumen inicial | litros |
| Q | entrada diaria | litros/día |
| C | consumo diario | litros/día |
| λ | coeficiente de pérdida proporcional | 1/día |

## Solución analítica
- λ ≠ 0: `V(t) = (Q−C)/λ + [V₀ − (Q−C)/λ]·e^(−λt)` (equilibrio V* = (Q−C)/λ)
- λ = 0: `V(t) = V₀ + (Q−C)t`

Comprobación: V(0) = V₀; derivando, V′ = −λ(V₀−V*)e^(−λt) = (Q−C) − λV ✔ (también verificado numéricamente en las pruebas).

## Métodos numéricos
**Heun (RK2)**: `k1=f(tn,yn)`, `k2=f(tn+h,yn+h·k1)`, `y(n+1)=yn+(h/2)(k1+k2)`. Error global O(h²).
**RK4**: `k1=f(tn,yn)`, `k2=f(tn+h/2,yn+h·k1/2)`, `k3=f(tn+h/2,yn+h·k2/2)`, `k4=f(tn+h,yn+h·k3)`, `y(n+1)=yn+(h/6)(k1+2k2+2k3+k4)`. Error global O(h⁴).

Ambos usan los mismos parámetros, V₀, T y malla. Si T no es múltiplo de h, el último paso es el tamaño restante. Errores: `Ea=|exacto−aprox|`, `Er=Ea/|exacto|·100` ("No definido" si exacto = 0). La aplicación **compara los resultados reales** y no asume que RK4 gana.

**Interpretación física:** la EDO se integra sin truncar valores negativos. V = 0 marca el agotamiento; lo posterior no es agua disponible. La capacidad del tanque solo genera una advertencia (rebalse), no modifica la solución.

## Arquitectura
Sitio estático (sin backend propio):
```
index.html            interfaz con 7 secciones (hash navigation)
src/math.js           EDO, solución exacta, Heun, RK4, errores, validación
src/simulation.js     orquesta la simulación, interpretación automática, CSV
src/scenarios.js      3 escenarios hipotéticos documentados
src/charts.js         gráficas Chart.js (datos reales)
src/supabase.js       cliente REST mínimo (sin dependencias)
src/config.js         URL y clave PÚBLICA de Supabase (a completar)
src/app.js            UI y estado
schema.sql            tablas, CHECK, índices, RLS
tests/math.test.js    pruebas con node:test
```

## Configuración de Supabase (paso a paso)
1. Cree un proyecto gratuito en <https://supabase.com>.
2. **SQL Editor → New query**, pegue todo `schema.sql` y ejecute (**Run**).
3. **Project Settings → API**: copie **Project URL** y la clave **anon** (o *publishable*).
4. Pegue ambos valores en `src/config.js`. **Nunca** use `service_role` ni la contraseña de PostgreSQL.
5. Abra la app: el indicador debe decir "☁ Supabase conectado". Solo lo dice si una consulta real a la tabla tuvo éxito; si falla, muestra el error y vuelve al modo demostración.

**Producción sin Vite:** el sitio es estático y no usa variables de entorno; `src/config.js` se publica tal cual. Esto es seguro porque la clave anon es pública por diseño y la protección real es RLS. `.env.example` es solo una referencia de qué valores completar.

**Seguridad (RLS):** anónimos solo pueden `SELECT` e `INSERT`; `UPDATE`/`DELETE` quedan denegados. **Limitación:** sin autenticación, cualquiera con la clave puede insertar filas (spam/cuota) y leer todo. Los `CHECK` limitan rangos y tamaños, no la cantidad. No guarde datos personales. Para producción añada Supabase Auth, límites o CAPTCHA.

## Ejecución local
```bash
npm start              # http://localhost:8080  (módulos ES requieren servidor, no file://)
```
Chart.js se carga desde jsDelivr (requiere internet).

## Pruebas
```bash
npm test               # node --test tests/math.test.js  (Node ≥ 18)
```
Cubren: condición inicial, EDO, λ = 0, equilibrio (Q = C y V₀ = V*), pasos de Heun/RK4 a mano, errores, último paso parcial, convergencia (órdenes ≈ 2 y ≈ 4), agotamiento, excedente de capacidad y validaciones.

## Publicación en GitHub Pages
```bash
git init && git add . && git commit -m "AquaResiliencia"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/aqua-resiliencia.git
git push -u origin main
```
En GitHub: **Settings → Pages → Deploy from a branch → main / (root) → Save**. URL: `https://TU_USUARIO.github.io/aqua-resiliencia/`.

## Limitaciones del modelo
Un solo tanque, consumo y entrada constantes, pérdidas proporcionales al volumen, sin rebalse ni vaciado físico dentro de la EDO, parámetros hipotéticos y sin calibración con datos reales.
