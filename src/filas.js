// ════════════════════════════════════════════════════════════════════════
//  FILAS — cómo se convierte un registro de la app en un renglón de la base,
//  y de regreso. Salió de dataApi.js para poder usarlo y probarlo sin nube
//  (lo usa también la herramienta que prepara los catálogos validados).
// ════════════════════════════════════════════════════════════════════════

// ------------------------------------------------------------
//  Separar campos: algunas columnas viven aparte del JSON.
//  El resto de los campos del objeto van dentro de "datos".
// ------------------------------------------------------------
export const COLUMNAS_REALES = {
  ranchos:        ["id", "nombre"],
  parcelas:       ["id", "ranchoId", "nombre", "cultivo"],
  cultivos:       ["id", "nombre"],
  siembras:       ["id", "parcelaId", "cultivoId", "estado"],
  trabajadores:   ["id", "nombre", "pin"],
  encargados:     ["id", "nombre", "pin"],
  agronomos:      ["id", "nombre", "pin"],
  cuadrillas:     ["id", "nombre", "pin"],
  externos:       ["id", "nombre", "estado"],
  maquinaria:     ["id", "nombre"],
  inventario:     ["id", "nombre", "cat"],
  actividades:    ["id", "parcelaId", "fecha", "tipo"],
  cosechas:       ["id", "parcelaId"],
  aplicaciones:   ["id", "parcelaId", "fecha"],
  ingresos:       ["id", "fecha"],
  egresos:        ["id", "fecha", "parcelaId"],
  compras:        ["id", "estado"],
  entradas_inv:   ["id"],
  tareas:         ["id", "asignadoA", "estado"],
  bonificaciones: ["id"],
  incidencias:    ["id", "estado"],
  prestamos:      ["id", "estado"],
  cajachica:      ["id"],
  creditos:       ["id", "estado"],
  proveedores:    ["id", "nombre"],
  ciclos:         ["id", "estado"],
  asistencia:     ["id", "fecha", "trabajadorId"],
  envios_bodega:  ["id", "parcelaId", "fecha", "cultivo"],
  solicitudes_compra: ["id", "estado"],
  bitacora:       ["id"],
  avances_fase:   ["id"],
  embarques:      ["id"],
  terminados:     ["id"],
  corridas:       ["id"],
  estibas:        ["id"],
  config_seguridad: ["id"],
  config_contpaqi: ["id"],
  lecturas:        ["id", "tipo", "estado", "fecha"],
  patrones_lectura:["id", "emisor", "tipo"],
  estados_cuenta:  ["id", "banco", "cuenta", "periodo", "confiable"],
  titulares:       ["id", "nombre", "rfc"],
  bolsas:          ["id", "nombre", "tipo", "titularId"],
  aportaciones:    ["id", "titularId", "tipo", "fecha"],
  animales:        ["id", "arete", "sexo", "potreroId"],
  pesajes:         ["id", "animalId", "fecha"],
  tratamientos:    ["id", "animalId", "fecha", "producto"],
  potreros:        ["id", "nombre"],
  auditoria:       ["id", "fecha", "tabla", "registroId", "accion", "quien"],
  // Lo que Fito o Gera mandan hacer. "estado" y "asignadoA" van como columna
  // real porque la pregunta de todos los dias es "que traigo pendiente yo".
  indicaciones:    ["id", "fecha", "tipo", "estado", "parcelaId", "asignadoA"],
  // El chat. "estado" aparte para poder sacar los pendientes de confirmar sin
  // bajar todo el hilo.
  chat:            ["id", "fecha", "tipo", "estado", "deQuien"],
  // Los vuelos del dron, por parcela y por fecha: asi se arma la linea del tiempo.
  vuelos:          ["id", "fecha", "parcelaId"],
  // Lo que pasó, una sola vez. El resto del evento (quién, cuándo, datos) va en el JSON.
  eventos:         ["id", "tipo", "fecha", "estado"],
  config_emisor: ["id"],
  control_corrida: ["id"],
};

// Diccionario: nombre en la app (camelCase) → nombre en SQL (snake_case)
const MAP_COL = {
  ranchoId:     "rancho_id",
  parcelaId:    "parcela_id",
  cultivoId:    "cultivo_id",
  asignadoA:    "asignado_a",
  trabajadorId: "trabajador_id",
  cat:          "categoria",
};
const inv = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
const MAP_COL_INV = inv(MAP_COL);

const aSql = k => MAP_COL[k] || k;
const aApp = k => MAP_COL_INV[k] || k;

// ------------------------------------------------------------
//  Convertir un objeto de la app → fila SQL
// ------------------------------------------------------------
export function objetoAFila(tabla, obj) {
  const reales = COLUMNAS_REALES[tabla] || ["id"];
  const fila = {};
  const datos = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === "_actualizado" || k === "_borrado") continue; // metadatos locales, no se suben
    if (reales.includes(k)) fila[aSql(k)] = v;
    else datos[k] = v;
  }
  fila.datos = datos;
  fila.actualizado = new Date().toISOString();
  return fila;
}

// ------------------------------------------------------------
//  Convertir una fila SQL → objeto de la app
// ------------------------------------------------------------
export function filaAObjeto(fila) {
  // creado_por / subido_por los pone la base (qué cuenta lo subió): no son
  // datos del registro y no deben regresar a la nube dentro de él.
  // borrado es la lápida: alguien lo borró.
  const { datos, actualizado, creado_por, subido_por, borrado, ...resto } = fila || {};
  const obj = {};
  for (const [k, v] of Object.entries(resto)) {
    if (v === null || v === undefined) continue;
    obj[aApp(k)] = v;
  }
  if (datos && typeof datos === "object") Object.assign(obj, datos);
  // Conservar el timestamp de la nube para poder resolver conflictos entre dispositivos
  // (merge por registro: gana el más reciente). Se guarda aparte para no chocar con datos.
  if (actualizado) obj._actualizado = actualizado;
  if (borrado) obj._borrado = borrado;
  return obj;
}

