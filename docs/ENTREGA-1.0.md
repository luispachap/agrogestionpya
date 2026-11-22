# AgroGestión 1.0 — tablero de cierre

> **Las cifras y estados vigentes NO están aquí.** La única fuente del estado de la versión 1.0 (módulos aprobados, defectos, pendientes y lo publicado) es `docs/ESTADO.json`, de donde se generan `docs/AUDITORIA-FUNCIONAL.md` y el tablero de cierre. Este documento se conserva como acta de su fecha; si algo aquí contradice a esos, vale lo de allá.

Corte: sábado 21 de noviembre de 2026, noche. Fecha objetivo de entrega: lunes 23.
La guía para operar está en `docs/OPERACION-1.0.md`.

## Conclusión: NO LISTO como sistema completo · listo para prueba de campo en la operación diaria

Actualizado el domingo 22 de noviembre. La evaluación completa, con qué se comprobó cada cosa, está en
`docs/EVALUACION-1.0.md`. En corto:

1. **El respaldo automático está ensayado en local y sin estrenar.** 26 comprobaciones de punta a punta con dos
   servidores de base de datos de verdad; falta el primer respaldo real y restaurarlo en un proyecto aislado de
   Supabase. Mientras tanto, **operar dinero en producción depende de que la base no falle**
   (`docs/RESPALDO-AUTOMATICO.md`). Faltan un repositorio privado y tres secretos, que sólo puede poner Luis.
2. **Nada se ha probado en el rancho.** La prueba de campo (`docs/PRUEBA-DEL-DOMINGO.md`) es la primera con
   teléfonos de verdad.
3. **Auditoría funcional de los 67 módulos** (`docs/AUDITORIA-FUNCIONAL.md`): 7 aprobados, 5 recorridos en parte
   (Bodega, con una corrida de ajo simulada completa) y 55 sin verificar con el criterio completo. Usarlos destapó
   13 defectos de dinero o de control, ya corregidos. Ninguno queda fuera.
4. **Producción está vacía.** Una cuenta, cero personal, fecha de inicio sin declarar.

**Qué lo vuelve LISTO:** (a) el respaldo real y su restauración ensayada; (b) la prueba de campo y corregir lo que
destape; (c) terminar la auditoría funcional — sigue aunque pase del lunes.

## Alcance de la versión 1.0

Tres clases, según qué tan probado está cada módulo:

- **A · Núcleo.** Probado de punta a punta en el recorrido de entrega: con cuentas, dos aparatos, sin señal, cerrar
  sesión, recargar, aparato nuevo y respaldo.
- **B · Con prueba propia.** Cada módulo tiene su recorrido en navegador y sus pruebas de cálculo, pero no pasó por
  el recorrido integral con cuentas.
- **C · Sólo abre.** La pantalla abre sin tronar, vacía y con datos. Su funcionamiento no se validó en este cierre.
  **No está excluido** (decisión de Luis, 21 nov): sigue en la auditoría funcional de los 67 módulos
  (`docs/AUDITORIA-FUNCIONAL.md`) y ahí se dice cuál ya se recorrió y cuál no.

| Módulo (pantallas) | Clase | Prueba ejecutada | Resultado | Riesgo pendiente |
|---|---|---|---|---|
| Entrada y cuentas (entrar, invitar, perfiles) | A | `entrega` 62, `cuentas` 24, `entrada` 17, `humo` 9 | Pasa | Sin probar con correos reales de los demás |
| Alta de personal (Equipo) | A | `entrega`, `acceso.test` 27 | Pasa, tras corregir | — |
| Parcelas y ranchos | A | `entrega` | Pasa | Lista fija de ubicaciones heredada (P2) |
| Checador y Jornadas | A | `entrega`, `checador` 22 | Pasa | Lector de credencial con cámara: sin probar en teléfono |
| El día: plan y reparto hablado | A | `entrega`, `plan` 14 | Pasa, tras corregir | Entiende «deshierbar» como «limpiar» (P2) |
| Equipos de trabajo (asignar, cambiar) | A | `entrega`, `cuadrillas` 28, `reasignacion` 20 | Pasa | Criterios de jornada sin validar con Miguel |
| El día: Jornada y su cierre | A | `entrega`, `jornada` 13 | Pasa | Igual |
| Mensajes → AgroGestión (incidencias dichas) | A | `entrega`, `dicho` 30 | Pasa | — |
| Aplicaciones | A | `entrega`, `ejecutores` 10 | Pasa | — |
| Registrar compra de insumo | A | `entrega` | Pasa | — |
| Pagos al personal: cálculo y pago | A | `entrega`, `pagos` 33, `sensibles` 15 | Pasa | — |
| Respaldo y recuperación | A | `entrega` (6 pasos) | Pasa, tras rehacerlo | Pérdida total del proyecto: sin ensayo completo |
| Sin señal y teléfono compartido | A | `sinsenal` 10, `entrega`, `campo` 13, `dosaparatos` 15 | Pasa | Sólo en teléfonos imitados |
| Permisos en la base | A | `test:base` 116, paridad 7/7, sin sesión 6/6 | Pasa | — |
| Almacén: entregas, conteo, mermas, inventario | B | `almacen` 55, `dosaparatos` 15 | Pasa | — |
| Cuadrillas eventuales | B | `eventuales` 20, `cuadrillas` 28 | Pasa | Participación individual: sólo diseño |
| Prestaciones, bonos, bajas, cierre de semana | B | `prestaciones` 49, `bajas` 34, `decisiones` 25 | Pasa | Cifras legales: las confirma una persona |
| Cierre de mes y Resultados | B | `mes` 11, `cruces` 14, `escenario.test` | Pasa | Políticas pendientes de Luis (reparto de generales) |
| Mensajes entre personas | B | `mensajes` 23, `mensajes_movil` 33 | Pasa | Avisos al teléfono: sin probar el toque real |
| Importar documentos y lectura con IA | B | `importar` 19, `ia` 16, `rayas` 25, `excel_rayas` 26 | Pasa | No es parte de la operación diaria |
| Organización y catálogo de actividades | B | `organizacion` 24 | Pasa | Sin permiso otorgado; estructura sin validar |
| Mapa y satélite | B | `mapa` 22, `satelite` 22 | Pasa | Sin límites reales cargados |
| Papeles y archivos | B | `archivos` 9 | Pasa | Lectura por foto depende de la llave de IA |
| Bodega y ajo: corrida, estibas, terminado, embarque, consignaciones, comercialización | C | Abren (`entrega`, `recorrido` 25) | Abre | Sin validar. No es temporada de corrida |
| Finanzas clásicas: Finanzas, Movimientos, Caja chica, Banco, Socios, Deudas, Semana, ContPAQi, Temporadas | C | Abren; cálculo con pruebas (`banco` 21, `socios` 18) | Abre | Sin recorrido con cuentas |
| Paneles: ¿Alcanza?, Resumen, ¿Cómo vamos?, Mano de obra, Reportes, Operación | C | Abren; `vigilancia.test` 14 | Abre | Sin datos reales, enseñan ceros |
| Campo heredado: Registrar actividad, Registro de varios, Tareas, Indicaciones, Reportar, Mis días, Pase de lista, Asistencia, Aprobar externos | C | Abren | Abre | Camino anterior al checador; no mezclar con él |
| Agronomía: Hoja de Fito, Variedades, Calendario, Cosechas, Rendimiento, Estado de parcelas, Dron, Ganado | C | Abren; cálculo con pruebas | Abre | Sin validar con Fito |
| Compras del personal, Solicitudes, Proveedores | C | Abren; `compras.test` 6 | Abre | — |
| Seguridad, Subir catálogos, Bitácora, Credenciales | C | Abren | Abre | Subir catálogos es de la etapa anterior |

## Lo que se encontró hoy

Todo lo marcado «corregido» tiene prueba con nombre y **ya está publicado** (`d3e0498`). Lo que destapó después la auditoría funcional está en `docs/AUDITORIA-FUNCIONAL.md`.

### P0 — ponían en riesgo datos, dinero o seguridad

| # | Qué pasaba | Estado | Evidencia |
|---|---|---|---|
| 1 | Con señal mala, lo capturado se quedaba en el teléfono sin reintentarse; al quinto intento se apartaba hasta que alguien picara «reintentar» | Corregido | `sincroniza.test`, `entrega` «sin señal… suben solas» |
| 2 | Restaurar un respaldo descontaba dos veces lo consumido del almacén (de $2,800 a $1,600) y no ponía nada en la nube | Corregido | `entrega` «restaurar en un rancho vacío deja TODO igual» |
| 3 | La pantalla de Respaldo ofrecía «Borrar TODO» y «Poner inventario en cero»; borraba el aparato y decía «listo» aunque la base lo rechazara | Quitado | `entrega` «ya no ofrece borrar datos» |
| 4 | Un teléfono que abrió la app una sola vez con señal la encontraba en blanco sin señal | Corregido | `sinsenal` 10/10 |
| 5 | En producción, una función de la base no era la del repositorio (sin daño posible: los eventos tienen su propio candado) | Puesta al día | Paridad: 7 huellas iguales |

### P1 — impedían completar una operación esencial

| # | Qué pasaba | Estado | Evidencia |
|---|---|---|---|
| 6 | Lo que capturaba otro aparato (plan, gente nueva, aplicaciones) sólo llegaba al salir y volver a entrar | Corregido | `entrega` «le llegó… SIN salir» |
| 7 | Un doble toque en «Mandarla» duplicaba el plan del día | Corregido | `entrega` «un doble toque no lo duplica» |
| 8 | El alta aceptaba un PIN repetido (deja sin entrar a los dos), nombre vacío y no limpiaba el formulario | Corregido | `acceso.test`, `entrega` |
| 9 | El sueldo de alguien recién dado de alta salía como «estimado» en todos sus costos | Corregido | `calculos.test` |
| 10 | «Salir» podía quedarse colgado sin señal o en un navegador recién instalado | Corregido | `entrega` «al cerrar sesión…» |
| 11 | En un teléfono compartido, quien entraba con PIN se quedaba adentro para el siguiente | Corregido | `acceso.test`, `entrega` «se cierra sola» |

### P2 — corregidos de paso

Aviso rojo falso de «PINs de fábrica activos»; texto que decía que una compra de insumo «se refleja como egreso»;
recordatorios de Seguridad de la etapa anterior; dos pruebas con falsas alarmas.

### P2 — pendientes, no bloquean

- «Nueva parcela» trae una lista fija de ubicaciones heredada. Hay que decidir si se queda.
- El reparto hablado entiende «deshierbar» como «limpiar la parcela», y repite «con Fulano» dos veces.
- El insumo aplicado cuenta una sola vez, pero en Resultados sale bajo «Gastos capturados» y no bajo «Insumos consumidos».
- Una aplicación registrada por un administrador queda anotada con el perfil «agrónomo».
- Quien entra como externo sin PIN se crea con un sueldo fijo escrito en el código.
- Mientras una subida falla, la pantalla dice «Sincronizando…» en vez de decir que está reintentando.
- El archivo principal pesa 2.7 MB: la primera carga con mala señal es lenta.
- Especialidades iniciales «declaradas» por trabajador: no existe todavía. Va a la 1.1.
- En producción quedan los datos de la prueba de avisos (1 conversación, 3 mensajes). Hay que retirarlos.

## Pruebas ejecutadas

| Qué | Resultado |
|---|---|
| Pruebas de cálculo y reglas (`npm test`) | 1,253 de 1,253 |
| Base aislada, atacada directo (`npm run test:base`) | 152 de 152 (16 de restauración, 12 del respaldo automático, 8 de la auditoría) |
| Respaldo y restauración de punta a punta, en local (`sh pruebas/respaldo_local/ensayo.sh`) | 26 de 26 |
| Función de lectura con IA, sin red ni gasto | 12 de 12 |
| Compilación | 225 módulos; el lector de PDF sale aparte |
| Recorridos en navegador de la batería (32) | Todos pasan; `entrega` 68, `sinsenal` 10, `auditoria_dinero` 37, `auditoria_proveedores` 27, `auditoria_bodega` 46 |
| Producción sin sesión | 6 de 6: no se lee, no se escribe, no se llama nada |
| Sitio publicado en Android y iPhone imitados | 18 de 18 |
| Producción contra la base de pruebas, después de instalar las hojas 53 y 54 | 7 huellas iguales: 188 reglas, 52 funciones, 72 tablas, 173 candados, 200 permisos, 36 operaciones sensibles, quién puede llamar cada función |

Lo que **no** se pudo ejecutar: una sesión real en producción, un teléfono real, señal real del rancho, correos de
invitación reales, la cámara para credenciales y el toque de un aviso.

## Riesgos que quedan, aunque todo pase

- **Sin copias automáticas TODAVÍA.** El respaldo de cada noche está preparado (`docs/RESPALDO-AUTOMATICO.md`) y
  sin estrenar. Hasta el ensayo real, la única copia es el archivo que se baja a mano.
- **Las fotos no van en el respaldo manual.** En el automático sí.
- **Recuperar en otro proyecto tiene un paso sin ensayar:** decirle a la base copiada su nombre nuevo.
- **El teléfono ligado guarda lo que ve la cuenta del encargado.** Por eso nunca se liga la de un administrador.
- **El PIN no es identidad.** Lo que mueve dinero se hace con cuenta, y la base lo exige.
- **La base se pausa** si pasan varios días sin uso (plan gratuito). Se reactiva sin perder nada.
- **Protección contra contraseñas filtradas apagada** en Supabase. Encenderla puede pedir un plan de pago: no se toca sin autorización.
- **Clase C sin validar.** Si alguien la usa el lunes, es bajo prueba.

## Estado de la publicación

| Qué | Dónde está |
|---|---|
| Correcciones P0, P1 y P2 del cierre | **Publicado** (`d3e0498`) |
| Restaurar conserva quién autorizó y cuándo; nadie inventa autorizaciones (hoja 53 + firma) | **Instalada** en la base y **publicado** (`a7b8e4a`), 21 nov |
| Caja chica: sólo se corrige el concepto; cancelar arrastra su gasto; gasto de parcela ya no sale como general | **Publicado** (`a7b8e4a`) |
| Caja chica: clases de salida (gasto general, de parcela, inventario, préstamo, pago, traspaso, por clasificar) | **Publicado** (`d169a5e`), 22 nov |
| Abonos a créditos: se cancelan en vez de borrarse, salen en el flujo, y dos teléfonos ya no se pisan | **Publicado** (`6ce96fd`), 22 nov |
| Banco, Socios y ¿Alcanza? fuera del encargado (hoja 54) | **Instalada** en la base y **publicado** (`7b3e610`), 22 nov |
| Corrida que no se pierde al salir de la pantalla; ventas sin dinero fuera del flujo; ajuste de ajo terminado con motivo | En la rama, probado; **sin publicar: pide autorización** |
| Respaldo automático | Herramientas en la rama, ensayadas en local; **sin estrenar** |
| Punto de regreso de la app | Despliegue anterior `dpl_59DgNTyzKbMMk1ZUzXKRWgBR8AoZ` (`6ce96fd`); antes, `dpl_A3yNVCoznNSnZPyxEECydxUNykRe` (`d169a5e`) |
| Permiso de organización | Sin otorgar: lo hace Luis para su cuenta |
