-- AquaResiliencia · esquema PostgreSQL para Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run. Es idempotente.
create extension if not exists pgcrypto;

create table if not exists public.escenarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  descripcion text check (descripcion is null or char_length(descripcion) <= 1000),
  volumen_inicial numeric not null check (volumen_inicial >= 0 and volumen_inicial <= 1e9),
  capacidad_tanque numeric not null check (capacidad_tanque > 0 and capacidad_tanque <= 1e9),
  abastecimiento_diario numeric not null check (abastecimiento_diario >= 0 and abastecimiento_diario <= 1e9),
  consumo_diario numeric not null check (consumo_diario >= 0 and consumo_diario <= 1e9),
  coeficiente_perdida numeric not null check (coeficiente_perdida >= 0 and coeficiente_perdida <= 10),
  tiempo_simulacion numeric not null check (tiempo_simulacion > 0 and tiempo_simulacion <= 100000),
  fecha_creacion timestamptz not null default now(),
  constraint volumen_le_capacidad check (volumen_inicial <= capacidad_tanque)
);

create table if not exists public.simulaciones (
  id uuid primary key default gen_random_uuid(),
  escenario_id uuid references public.escenarios(id) on delete set null,
  nombre text not null check (char_length(nombre) between 1 and 120),
  parametros jsonb not null check (jsonb_typeof(parametros) = 'object' and pg_column_size(parametros) < 4096),
  paso_h numeric not null check (paso_h > 0),
  volumen_final_analitico numeric not null,
  volumen_final_heun numeric not null,
  volumen_final_rk4 numeric not null,
  error_heun numeric not null check (error_heun >= 0),
  error_rk4 numeric not null check (error_rk4 >= 0),
  fecha_ejecucion timestamptz not null default now()
);

create index if not exists idx_escenarios_fecha on public.escenarios (fecha_creacion desc);
create index if not exists idx_simulaciones_fecha on public.simulaciones (fecha_ejecucion desc);
create index if not exists idx_simulaciones_escenario on public.simulaciones (escenario_id);

alter table public.escenarios enable row level security;
alter table public.simulaciones enable row level security;

-- Solo SELECT e INSERT para anónimos. Sin políticas de UPDATE/DELETE => quedan denegados por RLS.
drop policy if exists "escenarios_select_anon" on public.escenarios;
drop policy if exists "escenarios_insert_anon" on public.escenarios;
drop policy if exists "simulaciones_select_anon" on public.simulaciones;
drop policy if exists "simulaciones_insert_anon" on public.simulaciones;
create policy "escenarios_select_anon" on public.escenarios for select to anon using (true);
create policy "escenarios_insert_anon" on public.escenarios for insert to anon with check (true);
create policy "simulaciones_select_anon" on public.simulaciones for select to anon using (true);
create policy "simulaciones_insert_anon" on public.simulaciones for insert to anon with check (true);

-- Refuerzo a nivel de privilegios (defensa en profundidad).
revoke all on public.escenarios, public.simulaciones from anon;
grant select, insert on public.escenarios, public.simulaciones to anon;

-- LIMITACIONES de permitir INSERT público sin autenticación:
--  * Cualquiera con la clave pública puede insertar filas (spam / consumo de cuota). Los CHECK limitan
--    el tamaño y rango de los datos, pero no el número de filas.
--  * Todo registro es legible por cualquiera: no guardar datos personales ni sensibles.
--  * Para producción: añadir Supabase Auth, límites por usuario y/o CAPTCHA, y borrar spam desde el panel.
