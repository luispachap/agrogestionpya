# AgroGestión 1.0 — tablero de cierre

Corte: sábado 21 de noviembre de 2026, noche. Fecha objetivo de entrega: lunes 23.
La guía para operar está en `docs/OPERACION-1.0.md`.

## Conclusión: NO LISTO todavía

No por lo que falló hoy —eso está corregido y probado— sino por tres cosas que no dependen de mí:

1. **Las correcciones de hoy no están publicadas.** En app.agroselectos.com sigue la versión anterior, con las fallas
   P0 y P1 de abajo. Publicar pide la autorización de Luis.
2. **Producción está vacía.** Una sola cuenta, cero personal, cero parcelas y la fecha de inicio sin declarar. No hay
   nada que «entregar funcionando» hasta que entren ustedes.
3. **Nada se ha probado en el rancho.** Todo lo de abajo es con datos inventados, en navegadores que imitan teléfonos
   y contra una nube de imitación. Yo no puedo entrar a producción con una cuenta ni tocar un teléfono.

**Qué lo vuelve LISTO, en este orden:** (a) autorizar la publicación de la versión candidata; (b) hacer el domingo la
prueba de 12 pasos de `OPERACION-1.0.md` §7 en sus teléfonos; (c) corregir lo que esa prueba destape.

**Qué se puede prometer para el lunes:** la operación diaria (alta de personal, checar, plan, reparto, cambios,
incidencias, aplicaciones, almacén básico, cierre de jornada, pagos) si la prueba del domingo pasa.
**Qué no:** que los 67 módulos estén validados. Los de la clase C no lo están.

## Alcance de la versión 1.0

Tres clases, según qué tan probado está cada módulo:

- **A · Núcleo.** Probado de punta a punta en el recorrido de entrega: con cuentas, dos aparatos, sin señal, cerrar
  sesión, recargar, aparato nuevo y respaldo.
- **B · Con prueba propia.** Cada módulo tiene su recorrido en navegador y sus pruebas de cálculo, pero no pasó por
  el recorrido integral con cuentas.
- **C · Sólo abre.** La pantalla abre sin tronar, vacía y con datos. Su funcionamiento no se validó en este cierre.
  **Queda fuera del compromiso de la 1.0.**

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

Todo lo marcado «corregido» tiene prueba con nombre y está en la rama, **sin publicar**.

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
| Pruebas de cálculo y reglas (`npm test`) | 1,221 de 1,221 |
| Base aislada, atacada directo (`npm run test:base`) | 116 de 116 |
| Función de lectura con IA, sin red ni gasto | 12 de 12 |
| Compilación | 223 módulos; el lector de PDF sale aparte |
| Recorridos en navegador de la batería (29) | Todos pasan; `entrega` 62, `sinsenal` 10 |
| Recorridos fuera de la batería (7: mensajes, lo dicho, rayas, mapa, satélite) | Todos pasan |
| Producción sin sesión | 6 de 6: no se lee, no se escribe, no se llama nada |
| Sitio publicado en Android y iPhone imitados | 18 de 18 |
| Producción contra la base de pruebas | 7 huellas iguales: 187 reglas, 50 funciones, 70 tablas, 173 candados, 200 permisos, 36 operaciones sensibles, quién puede llamar cada función |

Lo que **no** se pudo ejecutar: una sesión real en producción, un teléfono real, señal real del rancho, correos de
invitación reales, la cámara para credenciales y el toque de un aviso.

## Riesgos que quedan, aunque todo pase

- **Sin copias automáticas.** El plan gratuito no respalda la base. La copia es el archivo semanal.
- **Las fotos no van en el respaldo.**
- **El teléfono ligado guarda lo que ve la cuenta del encargado.** Por eso nunca se liga la de un administrador.
- **El PIN no es identidad.** Lo que mueve dinero se hace con cuenta, y la base lo exige.
- **La base se pausa** si pasan varios días sin uso (plan gratuito). Se reactiva sin perder nada.
- **Protección contra contraseñas filtradas apagada** en Supabase. Encenderla puede pedir un plan de pago: no se toca sin autorización.
- **Clase C sin validar.** Si alguien la usa el lunes, es bajo prueba.

## Estado de la publicación

| Qué | Dónde está |
|---|---|
| Quién aplicó y catálogo ampliado | **Publicado** en app.agroselectos.com (`dd4bea5`) |
| Correcciones P0, P1 y P2 de este cierre | En la rama `produccion/base-vigente`, **sin publicar** |
| Función de borrado puesta al día | **Instalada** en la base de producción |
| Permiso de organización | Sin otorgar: lo hace Luis para su cuenta |
