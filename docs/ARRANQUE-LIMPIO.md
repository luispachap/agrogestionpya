# Arranque limpio y controlado

19 nov 2026 · Decisión de Luis: AgroGestión nunca operó de verdad; lo que hay
guardado son pruebas. **La operación nueva empieza sin ningún registro de
antes.** Lo anterior se conserva intacto, aparte, y no es requisito para arrancar.

## 1 · Qué entra y qué no

| | ¿Entra a la base nueva? |
|---|---|
| Gastos, ingresos, inventarios, jornadas, nóminas, aplicaciones, corridas, estibas, cualquier movimiento | **No.** Ni de la base anterior ni de los teléfonos |
| Cuentas, contraseñas, PIN, la cuenta técnica, permisos anteriores | **No.** Todo se crea de nuevo |
| Catálogos (trabajadores, ranchos, parcelas, maquinaria, proveedores, cultivos, artículos del almacén) | **Sólo los que Luis y Migue aprueben, renglón por renglón** |
| Existencias del almacén | **No.** Salen de un conteo físico |
| Saldos de bancos y cajas | **No.** Se capturan con fecha de corte y evidencia |
| Datos de prueba | **Nunca** en producción |

## 2 · Por dónde podían colarse los datos viejos, y cómo quedó cada puerta

Una base vacía no basta: el primer teléfono que entrara la habría llenado con
lo que traía guardado. Éstas son las puertas que encontré:

| # | Puerta | Estado |
|---|---|---|
| 1 | El teléfono trae guardados registros de prueba y la versión nueva los leía como propios | **Cerrada y probada.** Cada proyecto es un *espacio* con su propio cajón en el teléfono. La versión nueva no lee, no escribe y no borra el cajón de antes |
| 2 | La cola de "pendientes de subir" y los "apartados" viejos subían al entrar una cuenta | **Cerrada y probada**, en navegador real y con una cuenta que sí tenía permiso: cero subidas |
| 3 | Restaurar un respaldo viejo desde la pantalla de Respaldo | **Cerrada y probada.** Sólo se aceptan respaldos de la misma operación; la app explica por qué |
| 4 | El rancho y 24 parcelas venían escritos dentro del código | **Cerrada.** La app ya no trae nada de fábrica; esa lista pasó a ser una fuente más a revisar |
| 5 | "Reiniciar datos" borraba TODO el teléfono, también lo de antes | **Cerrada y probada.** Sólo borra lo de la operación actual |
| 6 | Las hojas que arman la base podían sembrar datos de ejemplo | **Verificado:** una base recién armada sólo trae reglas (permisos, topes), ningún registro |
| 7 | Segundo candado, por si alguna de las anteriores fallara | **Puesto y probado** (hoja SQL 31): la base rechaza todo registro que no traiga la marca de su espacio, aunque quien lo suba tenga permiso |
| 8 | Una base nueva "sin sellar" acepta registros sin marca | Paso obligatorio del montaje; no se abre a nadie antes de sellarla |
| 9 | La pantalla de administrador que importa catálogos desde Excel | **Abierta a propósito, sólo para superadministradores.** Es una puerta legítima, pero se brinca la hoja de revisión: la regla es no usarla para el arranque |
| 10 | **Datos de prueba durante la validación en teléfonos** | **Abierta — necesita una decisión** (sección 6) |
| 11 | Un teléfono que siga con la versión vieja abierta | No puede llegar a la base nueva (apunta a la anterior). Lo que capture ahí se queda en su cajón viejo. Hay que avisar que recarguen |
| 12 | Alguien teclea a mano datos viejos | No lo impide ningún candado; para eso es la fecha de inicio |

Lo de antes **no se borra de ningún teléfono**. La pantalla de Respaldo enseña
una tarjeta "Datos de antes en este teléfono" con un botón para descargarlos tal
cual, para archivo. Descargar no los mueve ni los sube.

## 3 · Catálogos: sólo los validados

1. **Juntar las fuentes** en una carpeta `respaldos/` (no se sube al
   repositorio: trae nombres de personas): los respaldos que ya existan, los
   "datos de antes" que quieran descargar de los teléfonos, y la lista que venía
   en el código. La base anterior no hace falta; si el 19 de diciembre se puede
   leer, será una fuente más.
2. **Yo corro** `node herramientas/catalogos.mjs candidatos respaldos/`. Sale un
   Excel con una hoja por catálogo. Sólo trae catálogos: sin PIN, sin
   contraseñas, sin existencias ni costos. Junta los repetidos y **marca lo que
   huele a prueba** o viene con datos distintos en dos teléfonos. No quita nada:
   decide quien conoce el rancho.
3. **Luis y Migue** escriben **sí** o **no** en la primera columna de cada
   renglón. En blanco es no. Pueden corregir el nombre ahí mismo.
4. **Yo corro** el segundo paso con quién aprobó y la fecha. Sale un archivo
   listo para cargar y un resumen. **No se carga solo.**
5. Con su autorización lo cargo, **una vez**, en el proyecto nuevo. Cada
   registro entra con id nuevo y con la constancia de quién lo aprobó y cuándo.
6. Los trabajadores entran **sin PIN**: cada uno recibe uno nuevo desde la app.
   Los artículos del almacén entran **en cero**.

Probado de punta a punta con datos de mentira: de un respaldo con un gasto
inventado, un PIN y existencias, a la base sólo llegó lo aprobado.

## 4 · Con qué se abre

| Qué | Cómo | Estado |
|---|---|---|
| **Fecha oficial de inicio** | La declara un superadministrador, una sola vez; ya no se cambia. Queda quién y cuándo | En la base y probado. **Falta el botón en la app** |
| **Inventario inicial** | Conteo físico con fecha, lugar y responsable. La app ya tiene el conteo a ciegas (no enseña el saldo hasta después de contar) | La regla que exige fecha, lugar y responsable está escrita y probada. **Falta conectarla a la pantalla de conteo** |
| **Saldos iniciales** | Por cada cuenta o caja: fecha de corte, saldo, responsable y evidencia (estado de cuenta o arqueo). Sin evidencia se puede guardar, pero queda marcado así | Regla escrita y probada. **Falta la pantalla** |

Esas tres pantallas son chicas y las propongo como primer paso de la
especificación ampliada, porque inventarios y control financiero vienen ahí.

## 5 · Orden del arranque

1. Montar el proyecto y **sellarlo** con su espacio.
2. Cuentas nuevas: Luis y Migue superadministradores; luego encargados.
3. Cargar los catálogos aprobados.
4. PIN nuevos para la gente de campo.
5. Conteo físico del almacén.
6. Saldos iniciales con su evidencia.
7. Declarar la fecha de inicio. De ahí en adelante, todo es operación real.

## 6 · Decisión pendiente: dónde se hacen las pruebas

El plan gratuito de Supabase da **dos proyectos activos por persona**, contando
todas sus organizaciones. Luis ya tiene uno activo (el del despacho). Queda
**un solo lugar**: no caben a la vez uno de pruebas y uno de producción.

| Opción | Qué implica |
|---|---|
| **A · Uno después del otro (la que propongo)** | Se crea primero el proyecto **de pruebas**, se hace ahí toda la validación en teléfonos con datos de mentira, se **elimina**, y se crea el de producción limpio. Armar la base toma minutos, así que no cuesta nada repetirlo. Los datos de prueba nunca tocan producción porque producción todavía no existe. Eliminar el proyecto de pruebas requiere tu autorización. Después del arranque ya no habría ambiente de pruebas |
| B · Migue crea el de pruebas con su cuenta | Cada persona tiene sus dos lugares. Deja ambiente de pruebas permanente, que hará falta para las funciones nuevas |
| C · Plan de paga | No lo propongo ahora |

A y B no se excluyen: A para arrancar, B cuando empiecen las funciones nuevas.
