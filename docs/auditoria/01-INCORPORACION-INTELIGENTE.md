# Incorporación Inteligente — diseño y lugar en el plan

Fecha: 18 de noviembre de 2026 · Estado: **diseño, sin construir**

Módulo transversal para que el rancho meta su información con fotos, PDF, XML y
hojas de cálculo en vez de capturarla a mano. Este documento amplía el plan de
`00-DIAGNOSTICO.md`. Nada de aquí está implementado ni probado.

## 1. Por qué no puede ir antes de la estabilización

| Lo que el módulo necesita | Hoy | Se resuelve en |
|---|---|---|
| Guardar archivos originales | No existe almacenamiento de archivos; la base está pausada | Etapa 0 |
| Saber quién confirmó cada dato | No hay identidad por persona (PIN compartido, sesión falsificable) | Etapa 3 |
| Que una confirmación no se duplique ni se pierda | La sincronización pisa y duplica | Etapa 2 |
| Historial de correcciones | No hay bitácora | Etapa 3 |
| Llamar a un modelo de IA sin exponer la credencial | El asistente actual llama desde el teléfono sin credencial (hallazgo M-6) | Este módulo |

Montarlo sobre lo actual sería automatizar la entrada de datos a un sistema que
los pierde. Por eso queda como **Etapa 5-bis**: después de identidad y datos,
antes de los módulos de bodegas y expediente legal, que lo aprovechan.

## 2. Arquitectura

```
Teléfono (cámara / archivos)
   │  sube el original tal cual + su huella (SHA-256)
   ▼
Almacén privado de archivos ──► Cola de procesamiento (tabla en la base)
                                      │
                         Función en el servidor (guarda la credencial de IA)
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
   XML / Excel                  Imagen / PDF escaneado          Ambiguos
   lectura exacta,              lectura de texto + visión       modelo de lenguaje
   sin IA                       (modelo con visión)             solo para interpretar
        └─────────────────────────────┼──────────────────────────────┘
                                      ▼
                    Reglas fijas (código, no IA): sumas, impuestos,
                    unidades, duplicados, cotejo contra catálogos
                                      ▼
                    Propuesta con nivel A / B / C ──► Bandeja de Migue
                                      ▼
                    Registro definitivo + evidencia + bitácora
```

Decisiones de fondo:

- **La IA lee y propone; nunca calcula ni autoriza.** Los importes se recalculan
  con reglas (cantidad × precio = importe; suma de partidas = total; IVA). Si lo
  que leyó el modelo no cuadra, el documento baja a nivel B con la diferencia
  señalada. El modelo nunca «corrige» un número.
- **La credencial de IA vive en el servidor**, jamás en una variable `VITE_`
  (misma lección que el hallazgo C-2).
- **Si un campo no se pudo leer, queda vacío y se pregunta.** No se rellena.
- **Todo por lotes y reanudable:** cada archivo tiene su estado (recibido, en
  proceso, leído, en revisión, incorporado, descartado, con error) y se puede
  reintentar sin duplicar porque se identifica por su huella.

## 3. Datos nuevos (tablas)

| Tabla | Para qué |
|---|---|
| `documentos` | El original: huella, tipo detectado, quién lo subió, estado, empresa |
| `doc_extracciones` | Cada dato leído: campo, página o región, valor original, valor interpretado, confianza, estado |
| `doc_propuestas` | La acción sugerida (crear gasto, entrada de inventario, alta de proveedor…), su nivel y su resultado |
| `doc_criterios` | Lo aprendido de las confirmaciones de Migue, con alcance, autor, fecha y vigencia |
| `doc_accesos` | Quién vio o procesó cada documento y qué servicio externo lo recibió |

Todas llevan `empresa_id` desde el primer día (separación de empresas), aunque
hoy solo exista Agroselectos.

## 4. Duplicados y entidades repetidas (reglas, no IA)

**Documentos:** (1) misma huella de archivo = repetido seguro; (2) en facturas,
mismo folio fiscal (UUID del XML) = repetido seguro; (3) mismo proveedor + fecha
+ total = «posible repetido», a confirmación.

**Entidades** (proveedores, trabajadores, insumos, maquinaria): se compara en este
orden y nunca se crea una nueva en automático:

1. Identificador exacto (RFC, CURP, número de serie, placa).
2. Nombre normalizado (sin acentos, mayúsculas, sin «SA de CV», abreviaturas del
   catálogo: «Fosfonitrato» = «Fosfo»).
3. Parecido de escritura por encima de un umbral → se **propone** la coincidencia.
4. Sin coincidencia → se propone alta nueva, nivel B.

## 5. Los tres niveles, gobernados por una tabla de reglas

| Nivel | Cuándo | Qué pasa |
|---|---|---|
| A — alta confianza | Lectura exacta (XML/Excel) o imagen que cuadra aritméticamente, entidad con identificador exacto, y el tipo de dato está en la lista de «no críticos» | Entra como **borrador** visible, sin efecto en saldos ni dinero |
| B — confirmación | Asociación ambigua, datos que se contradicen, campos faltantes, entidad nueva | Pregunta agrupada a Migue |
| C — autorización | Mueve inventario oficial, dinero, registros laborales, borra algo o no se puede deshacer | Requiere a una persona con ese permiso; queda firmado en bitácora |

Qué operación cae en qué nivel lo decide una tabla del sistema editable solo por
dirección, no el modelo. Por defecto, **todo lo económico y laboral es C**.

## 6. Aprendizaje

Cada confirmación guarda un criterio: «proveedor X + concepto Y → insumo Z,
parcela W». Se reutiliza solo si proveedor **y** concepto coinciden; no se
extiende a otros proveedores ni a conceptos parecidos. Cada criterio muestra
cuántas veces se aplicó y se puede editar o revocar; revocarlo no altera lo ya
incorporado, pero lo deja marcado para revisión.

## 7. Protección

- Archivos en almacén privado, cifrados en tránsito y en reposo; se abren con
  enlaces temporales, nunca públicos.
- Acceso por rol desde la base. Documentos laborales (contratos, identificaciones,
  recibos) en categoría aparte, visible solo para dirección y finanzas.
- Interruptor por categoría: «este tipo de documento **no** sale a un servicio de
  IA externo». Con el interruptor apagado se captura a mano con el original a la vista.
- Plazos de conservación por tipo y borrado con registro.

## 8. Experiencia

1. **Subir**: cámara o selección múltiple; no se pide clasificar nada.
2. **Ver avance**: «38 de 120 leídos, 3 repetidos, 2 ilegibles».
3. **Resolver**: preguntas agrupadas, las de más dinero primero. Una sola respuesta
   resuelve todas las iguales («estas 14 notas son de Gasolinera X: ¿todas a
   Combustible?»).
4. **Confirmar** borradores por bloque, con el original al lado.
5. **Consultar** qué ya está incorporado y de qué documento salió cada dato.
6. **Reanudar** donde se quedó, en cualquier teléfono.

## 9. Prueba vertical (lo primero que se construye)

Foto de ticket → lectura → clasificación → asociación → confirmación → gasto
guardado → consulta con su evidencia y bitácora.

Se acepta si, con un lote de prueba:

| Medida | Meta inicial (a ajustar con datos reales) |
|---|---|
| Total del ticket leído correctamente | ≥ 95% en fotos nítidas |
| Ningún gasto guardado con total distinto al del papel | 100% (los que no cuadran deben caer a B) |
| Repetidos detectados | 100% por huella; se mide el caso «misma nota, otra foto» |
| Entidades duplicadas creadas | 0 |
| Costo por documento y tiempo contra captura manual | Se **miden**; no tengo cifra confiable hoy |

Lote de prueba, sintético y anonimizado: fotos borrosas, tickets arrugados,
repetidos, manuscritos, conceptos ambiguos, unidades incompatibles (kg/bulto/L),
documentos que se contradicen, fechas viejas, proveedores de nombre parecido,
archivos dañados. Los documentos reales que ya compartiste (hoja manuscrita de
ventas del día, tablas de fertirriego, reporte de caja) sirven de molde para
fabricar los sintéticos; no se usan tal cual porque traen nombres de clientes.

Después de pasar esa prueba: facturas XML → inventarios → maquinaria →
trabajadores → histórico.

## 10. Costo

Sin cifra firme. Componentes: almacenamiento de archivos (incluido en el plan de
pago de la base hasta cierto volumen) y uso del modelo de IA por documento, que
depende del proveedor y del tamaño de la imagen. Los XML y hojas de cálculo
cuestan cero de IA. El costo real por documento es un entregable de la prueba
vertical, y se pondrá un tope mensual configurable.

## 11. Decisiones que necesito

1. **¿Qué puede salir a un servicio de IA externo?** Propongo: tickets y facturas
   sí; documentos laborales e identificaciones no, hasta que lo autorices.
2. **¿Quién autoriza el nivel C?** ¿Migue solo, o dinero por encima de cierto
   monto también requiere a tu papá?
3. **¿Con qué proveedor de IA?** Implica abrir una cuenta de pago por uso.
4. **¿Cuánto histórico vale la pena meter?** ¿Solo el ciclo actual o años atrás?
