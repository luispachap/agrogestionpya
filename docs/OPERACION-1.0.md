# AgroGestión 1.0 — guía de operación

Para quien va a usar el sistema, no para quien lo programa. Dirección: **https://app.agroselectos.com**
(en el teléfono: abrirla en Chrome → menú ⋮ → «Agregar a pantalla de inicio»).

> Todo lo que aquí dice «probado» se probó con datos inventados y en un navegador que imita teléfonos.
> **Nada está probado todavía en el rancho, con sus teléfonos y su señal.** La sección 7 es esa prueba.

---

## 1. Quién entra y cómo

| Quién | Cómo entra | Qué necesita antes |
|---|---|---|
| Luis, Migue (administración) | Correo y contraseña | Luis ya tiene cuenta. A Migue lo invita Luis |
| Fito (agrónomo), Rodolfo (dirección), finanzas | Correo y contraseña | Invitación de Luis, con su perfil |
| Encargados | Correo y contraseña | Invitación de Luis, perfil «Encargado» |
| Trabajadores | PIN de 4 a 8 números, en el aparato del encargado o en el checador | Que alguien los dé de alta con su PIN |

**Invitar a alguien:** Arranque → Cuentas → nombre, correo y perfil → Invitar. Esa persona abre la dirección, toca
«Es mi primera vez: crear mi cuenta», usa **ese mismo correo**, confirma el enlace que le llega y entra.

Reglas que conviene respetar desde el primer día:

- **Una cuenta por persona.** Nadie presta su contraseña.
- **La cuenta de administrador no se usa en un teléfono que pasa de mano en mano.** Ese aparato guarda una copia de
  todo lo que esa cuenta puede ver.
- **El PIN no es una firma.** Sirve para saber quién captura, no para autorizar dinero: lo que mueve dinero se hace
  con cuenta.
- **No pongan PIN a los perfiles de dirección** (pantalla Seguridad). Con cuenta es más seguro y es lo probado.

## 2. El primer día (una sola vez)

En este orden, desde la cuenta de Luis:

1. **Arranque → Cuentas:** invitar a Migue, a Fito y a los encargados.
2. **Parcelas:** crear el rancho y sus parcelas (nombre, cultivo, hectáreas).
3. **Equipo → Planta → +:** dar de alta a cada trabajador que sigue: nombre completo, lo que gana por día y un PIN.
   - La app no deja repetir un PIN ni un nombre, y avisa si falta algo.
   - El sueldo que se pone vale desde ese día.
   - La fecha de ingreso se pone después, tocando el lápiz de la persona (hace falta para aguinaldo y vacaciones).
4. **Equipo → Encargados → +:** lo mismo para los encargados que cobran sueldo.
5. **Organización:** antes, Luis se da a sí mismo el permiso «configurar la organización» en Arranque → Cuentas
   (un toque) y vuelve a abrir la app. Sin ese permiso la pantalla se ve pero no deja capturar.
6. **Almacén:** dar de alta lo que hay (Inventario → +) y hacer el conteo inicial (Arranque → Conteo).
7. **Arranque → Inicio:** declarar la fecha oficial de inicio. **Hoy no está declarada**, y se declara una sola vez:
   escojan bien el día (lo natural es el primer día que operen de verdad).

Lo que **no** hace falta para empezar: saldos de bancos, socios, corrida de ajo, mapa, importar documentos.

## 3. Un día normal

| Momento | Quién | Dónde | Qué hace |
|---|---|---|---|
| La tarde anterior o temprano | Encargado | El día → Reparto | Dice el plan hablado o escrito («Hoy Juan y Pedro van a la 53 a regar») → **Mandarla** |
| Al llegar | Cada trabajador | Checador | Teclea su PIN: queda su entrada y ve a qué va |
| Ya que llegaron | Encargado | Equipos de trabajo | Marca a la gente, escoge parcela y actividad → **Asignar desde ahorita** |
| Si alguien cambia de parcela o de actividad | Encargado | Equipos de trabajo | Lo vuelve a asignar: es otra asignación, la anterior no se borra |
| Si pasa algo | Quien sea, con cuenta | Mensajes → AgroGestión | Lo dice («Se descompuso la bomba del pozo») y toca **Guardar** |
| Si sale dinero de la caja | Encargado | Caja chica → + Movimiento | Dice cuánto y **qué fue**: gasto de una parcela, gasto general, compra para el almacén, préstamo, pago a un trabajador, traspaso, o «todavía no sé» |
| Si se aplica algo | Agrónomo o administración | Aplicaciones → + Nueva | Parcela, producto, dosis y **quién lo aplicó** (si no se marca, la app lo advierte) |
| Al salir | Cada trabajador | Checador | Teclea su PIN otra vez |
| Al final | Encargado | El día → Jornada | Revisa plan contra lo que pasó → **Cerrar la jornada** |
| Cuando toque | Administración | Pagos al personal | Ve lo que corresponde a cada quien; registra lo entregado |

Lo que hay que saber:

- **Checar no es trabajar en una parcela.** Mientras el encargado no asigne, ese tiempo queda «sin asignar» y no se
  le carga a ninguna parcela.
- **Lo que corresponde pagar se calcula solo** de lo checado y lo asignado. No se captura otra vez.
- **Pagar no es un costo.** El costo nació el día que se trabajó.
- **Comprar para el almacén no es gasto:** es inventario. Se vuelve costo cuando se usa.
- **No toda salida de caja chica es gasto.** El fondo que entra tampoco es ingreso: el gasto se cuenta cuando se usa.
  Un préstamo o un pago que salió de la caja se registra en su pantalla (Préstamos, Pagos al personal) y en la caja
  sólo se liga. Lo que nadie ha dicho qué fue queda «por clasificar»: sale en el flujo de efectivo, no en resultados.

## 4. Sin señal

Probado con la versión publicada, en dos teléfonos Android imitados:

- La app **abre sin señal** desde la primera vez que se abrió con señal.
- Lo que se captura sin señal **se guarda en el teléfono** y la pantalla dice cuántos registros esperan.
- Al volver la señal **sube solo**, una vez. Si la señal es mala, lo reintenta cada medio minuto; ya no hay que picar nada.
- Lo que capturan los demás llega solo: marcas y asignaciones en unos 2 minutos; lo demás (plan, gente nueva,
  aplicaciones) en unos 5, o al volver a la app.

Lo que **sí** necesita señal: entrar con correo y contraseña por primera vez en un aparato, invitar cuentas, registrar
pagos y cierres (quedan «por validar» hasta que la base los autoriza) y leer fotos con IA.

**Antes de borrar la app, cambiar de teléfono o «recargar desde la nube», el aparato tiene que haber subido todo.**
La app ya no deja recargar si hay registros esperando.

## 5. Teléfonos compartidos

- El encargado entra con su cuenta y, al salir, acepta **dejar el teléfono ligado**: así su gente captura con PIN y
  lo capturado sube con la cuenta del encargado, pero con el nombre de quien lo capturó.
- Con el teléfono ligado, nadie abre las pantallas del encargado sin su contraseña.
- Quien entra con PIN a capturar lo suyo **queda fuera solo a los 5 minutos sin tocar la pantalla**, para que el
  siguiente no capture a su nombre.
- Límite conocido: la app sólo enseña a cada quien lo suyo, pero el aparato guarda lo que la cuenta ligada puede ver.
  Por eso se liga la cuenta de un **encargado**, nunca la de un administrador.

## 6. Respaldo y recuperación

**Dónde vive la información:** en la base (Supabase, plan gratuito) y, además, una copia en cada aparato que entró.

**Respaldo semanal (5 minutos, lo hace un administrador):**

1. Con señal, y con el aparato sin registros esperando (arriba no debe decir «sincronizando»).
2. Menú → Respaldo → **Descargar respaldo**. Baja un archivo `respaldo-agroselectos-FECHA.json`.
3. Guardarlo **fuera del teléfono**: mandárselo por correo a uno mismo o subirlo a Drive.
4. Hacerlo cada semana al cerrar la semana, y antes de cualquier cambio grande.

El archivo trae todo lo capturado (catálogos, movimientos, eventos, mensajes). **No trae las fotos de comprobantes**:
ésas viven en el almacén de archivos de la base y en el teléfono que las tomó.

**Qué hacer si…**

| Pasa esto | Se hace esto | Probado |
|---|---|---|
| Se pierde o se rompe un teléfono | Entrar con la cuenta en otro: baja todo. Lo que ese teléfono no había subido se pierde | Sí |
| Un teléfono enseña datos raros o viejos | Respaldo → «Recargar este dispositivo desde la nube» (no deja si tiene registros sin subir) | Sí |
| Alguien capturó algo mal | No se borra: se **cancela** con motivo (dinero) o se corrige con otro registro | Sí |
| Se borró o se dañó información en la base | Respaldo → «Elegir archivo de respaldo»: restaura el aparato y vuelve a subir todo, sin duplicar | Sí, con nube de imitación |
| Se pierde el proyecto de Supabase completo | Se arma una base nueva con las hojas del repositorio y se restaura el respaldo. **Requiere apoyo técnico** (el respaldo tiene que pasar por `herramientas/respaldo-a-otro-espacio.mjs`) | La regla, sí; el procedimiento completo, **no** |
| La base está «en pausa» | El plan gratuito pausa un proyecto tras varios días sin uso. Se reactiva desde el panel de Supabase; no se pierde nada | No aplica |

Lo que el respaldo **no** resuelve y hay que saber:

- El plan gratuito de Supabase **no hace copias automáticas** de la base. Está preparado un respaldo de cada noche,
  cifrado, que no cuesta (`docs/RESPALDO-AUTOMATICO.md`); **todavía no está funcionando**: faltan los pasos de Luis
  y el ensayo de restauración. Mientras tanto, la única copia fuera de la base es este archivo.
- Al restaurar, los pagos, cierres y demás decisiones **conservan quién los autorizó y cuándo**, y quedan marcados
  como restaurados, con quién restauró y cuándo. La app pide el motivo, y la restauración queda anotada. Nadie puede
  usar una restauración para inventar una autorización: la base firma cada sello y sólo acepta los que ella puso.
- Una semana sin respaldo es una semana que depende de que la base no falle.

## 7. La prueba que falta: ustedes, en el rancho

Con datos reales o marcados «PRUEBA» (lo de dinero se cancela al final con motivo). ✔ o ✘ en cada paso y, si falla,
captura de pantalla.

1. Luis entra en su teléfono. Invita a Migue y a un encargado. ¿Entran los dos?
2. Luis da de alta a dos trabajadores con PIN. ¿Los ve el encargado en su teléfono en menos de 5 minutos, sin salir?
3. El encargado manda el plan del día para esos dos.
4. Los dos checan con su PIN en el aparato del encargado. ¿Cada quien ve a qué va?
5. El encargado los asigna a una parcela. Una hora después cambia a uno de parcela.
6. El encargado pone **modo avión**, registra la salida de los dos y quita el modo avión. ¿Suben solas?
7. El encargado cierra la jornada.
8. Luis abre Pagos al personal. ¿Sale lo que corresponde a cada quien, ni más ni menos?
9. Luis cierra la app, la vuelve a abrir, sale y vuelve a entrar. ¿Todo sigue igual, sin nada repetido?
10. Luis descarga un respaldo y lo guarda fuera del teléfono.
11. El encargado deja su teléfono ligado; un trabajador entra con PIN y lo deja 5 minutos. ¿Se cierra solo?
12. Con el teléfono ligado, ¿se pueden abrir las pantallas del encargado sin su contraseña? (No debe.)

Si los doce pasan en sus teléfonos, la operación diaria está validada en campo.
