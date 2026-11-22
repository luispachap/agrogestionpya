-- ============================================================
--  AgroGestión — Hoja 55: Banco y Socios piden autorización expresa (perfil Finanzas)
--
--  Decisión de Luis (22 nov): pertenecer a Finanzas NO da acceso a los estados de cuenta, los titulares, las
--  bolsas ni las aportaciones de los socios. Antes la base se los dejaba leer por su perfil y sólo el menú los
--  escondía. Ahora:
--    · El perfil «finanzas» ya no lee esas cuatro tablas por ser finanzas.
--    · Existe un permiso que se otorga CUENTA POR CUENTA: `consultar_banco_y_socios`. Lo da un superadministrador
--      (Arranque → Cuentas) y queda anotado quién lo dio y cuándo; se puede revocar.
--    · Con ese permiso, una cuenta de Finanzas o de Administración puede CONSULTAR esas tablas. No capturar:
--      capturar sigue siendo de quien ya podía por su perfil.
--    · A un encargado, a un agrónomo o a quien no tiene perfil el permiso no le abre nada (hoja 54).
--  Dirección sigue consultando por su perfil, sin capturar. No borra ningún dato.
--  Se puede correr las veces que haga falta. Requiere las hojas 24, 37, 46 y 52.
-- ============================================================
insert into operaciones_sensibles (tipo, operacion, pide_importe, solo_otorgado) values
  ('consulta_banco_y_socios', 'consultar_banco_y_socios', false, true)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe, solo_otorgado = excluded.solo_otorgado;

update permisos_rol
   set leer = false, crear = false, editar = false, borrar = false
 where rol = 'finanzas' and tabla in ('estados_cuenta', 'titulares', 'bolsas', 'aportaciones');

create or replace function consulta_banco_y_socios()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (select rol from perfiles where id = auth.uid()) in ('finanzas', 'admin')
     and exists (select 1 from permisos_operacion where usuario = auth.uid() and operacion = 'consultar_banco_y_socios' and revocado is null);
$$;
revoke execute on function consulta_banco_y_socios() from public, anon;
grant execute on function consulta_banco_y_socios() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['estados_cuenta', 'titulares', 'bolsas', 'aportaciones'] loop
    execute format('drop policy if exists %I on %I', 'consultar ' || t || ' con permiso expreso', t);
    execute format('create policy %I on %I for select using (consulta_banco_y_socios())', 'consultar ' || t || ' con permiso expreso', t);
  end loop;
end $$;

-- CÓMO COMPROBAR
--   select tabla, leer from permisos_rol where rol = 'finanzas' and tabla in ('estados_cuenta','titulares','bolsas','aportaciones');  → false
--   select usuario, otorgado_por, otorgado from permisos_operacion where operacion = 'consultar_banco_y_socios' and revocado is null;   → a quién se le dio
