# 04 · Permisos por rol, puestos en la base

**Estado: corregido en rama y probado en una base aislada. NO desplegado. NO corrido contra la base real.**

## El problema, reproducido

Con las hojas SQL 1 a 23 (lo que hoy tiene la base):

1. Una cuenta recién registrada **se da de alta sola como admin** y desde ahí
   lee los egresos, lee los PIN de dirección y borra el catálogo de
   trabajadores. No necesita la app: basta la llave pública, que viene dentro
   de la app.
2. Cualquier rol con perfil puede todo: el agrónomo lee los ingresos y cambia
   el monto de un gasto.

Las dos están como prueba que empieza por `ANTES_` en
`pruebas/base/permisos.test.mjs`, y pasan — es decir, el hoyo existe.

## La solución: hoja `supabase/24-permisos-por-rol.sql`

- **Superadministradores** (Luis y Migue): cada uno su cuenta, mismas
  facultades. Pueden todo menos lo que nadie puede.
- **Lo que nadie puede, tampoco ellos:** editar o borrar la bitácora; borrar
  renglones de dinero (se cancelan); dejar al rancho sin superadministrador.
- **Los demás roles:** sólo lo que diga la tabla `permisos_rol`, tabla por
  tabla (leer / crear / editar / borrar). Lo que no está, está negado.
- **Nadie se da de alta ni se asciende solo.** Los perfiles y los permisos los
  editan únicamente los superadministradores.
- **La bitácora anota sola la cuenta real** de quien escribe; el teléfono no
  puede mandar otro nombre.
- **Reversa:** `supabase/25-reversa-de-la-24.sql` devuelve el trabajo a todos
  sin reabrir el hoyo (probado).

## Pruebas de ataque directo (16 de 16)

`npm run test:base` — arma un Postgres de verdad dentro de la prueba, con las
mismas hojas SQL, y le habla como alguien que se brinca la app.

| Ataque | Resultado con la hoja 24 |
|---|---|
| Sin sesión: leer o escribir cualquier tabla | Negado |
| Recién registrado: darse perfil (de cualquier rol) | Negado |
| Encargado / agrónomo / finanzas / dueño: ascenderse o cambiarse permisos | Negado |
| Agrónomo: leer ingresos, créditos, préstamos, caja, bancos, PIN de dirección | No ve nada |
| Dueño: escribir dinero o borrar | Negado |
| Encargado: borrar o editar trabajadores; ver PIN de dirección | Negado |
| Cualquiera, **incluidos Luis y Migue**: borrar ingresos o egresos | Negado |
| Cualquiera, **incluidos Luis y Migue**: editar o borrar la bitácora | Negado |
| Encargado escribe en la bitácora haciéndose pasar por Luis | Queda anotada su cuenta real |
| Quitar al último superadministrador | Rechazado con mensaje |
| Rol viejo "admin" sin reasignar | No ve ni toca nada (falla cerrado) |
| Luis y Migue | Pueden exactamente lo mismo |

## Lo que esto todavía NO resuelve — dicho claro

1. **Los que entran por PIN (trabajadores, cuadrillas, externos, y dirección
   por PIN) no tienen cuenta en la base.** Con la hoja 24 su teléfono no puede
   subir ni bajar nada por sí solo. Hoy tampoco puede (la app nunca inicia
   sesión por ellos desde que se quitó la cuenta técnica), pero hay que
   resolverlo antes del piloto: o cada encargado sube lo de su gente desde su
   cuenta, o se crea una entrada limitada en el servidor para captura de campo.
   **Es la decisión de diseño más importante que sigue.**
2. **Editar no es lo mismo que editar bien.** Quien puede editar egresos puede
   cambiarle el monto a uno viejo. La base ya impide borrar; falta que los
   cambios a dinero queden anotados por la base misma, no por la app.
3. **Los permisos iniciales (192 renglones) salieron de leer el código**, no de
   preguntarle a quien trabaja. Hay que repasarlos con Migue pantalla por
   pantalla. Si a un rol le falta un permiso de lectura, su pantalla sale
   vacía: la app ya avisa cuando una tabla falla al bajar, pero una tabla que
   baja vacía por falta de permiso todavía no se distingue de una vacía de
   verdad.
4. **La bitácora y el reintento de subida:** si un renglón de bitácora se sube
   dos veces, la segunda es rechazada (correcto), y la app lo va a mostrar como
   subida fallida. Hay que tratarlo como "ya estaba".
5. **"Recargar/vaciar tabla" de la app** borra tablas enteras; con la 24 sólo
   funciona para superadministradores y nunca sobre dinero ni bitácora.
6. En el panel de Supabase hay que **apagar el registro libre de cuentas**.

## En la app

`sesionDeCuenta()` en `src/acceso.js`: el rol `superadmin` abre las pantallas
de administrador con el nombre y la cuenta de cada quien; un rol que la app no
conoce no entra. Tres pruebas.
