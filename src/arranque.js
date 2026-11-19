// ════════════════════════════════════════════════════════════════════════
//  ARRANQUE LIMPIO — con qué empieza la operación, y con qué no
//
//  La base nueva empieza SIN movimientos. Lo único que puede venir de antes
//  son CATÁLOGOS (trabajadores, parcelas, proveedores...), y sólo los que Luis
//  y Migue aprueben uno por uno. Aquí están las reglas, puras y probadas:
//
//   · candidatosDeCatalogo — de un respaldo viejo saca SÓLO catálogos, sin PIN,
//     sin contraseñas, sin existencias, sin costos; junta repetidos y marca lo
//     que huele a prueba. No decide: propone y dice por qué duda.
//   · catalogoAprobado — convierte lo que la persona marcó "sí" en registros
//     nuevos, con id nuevo, sin PIN, y con la constancia de quién lo aprobó.
//   · revisarConteoInicial / revisarSaldoInicial — el inventario y los saldos
//     de arranque no se copian ni se inventan: se cuentan y se documentan.
// ════════════════════════════════════════════════════════════════════════
import { aCentavos } from "./calculos.js";

// Lo único que puede venir de antes, y qué columnas de cada uno.
// Lo que no está aquí NO se copia (PIN, existencias, costos, saldos, fotos).
export const CATALOGOS_QUE_PUEDEN_VENIR = {
  ranchos:      ["nombre", "hectareas", "lat", "lng"],
  parcelas:     ["nombre", "ubicacionId", "hectareas", "cultivo", "lat", "lng"],
  cultivos:     ["nombre", "variedad", "emoji"],
  trabajadores: ["nombre", "categoria", "codigoNomina", "sueldo_dia"],
  encargados:   ["nombre", "sueldo_dia"],
  agronomos:    ["nombre"],
  cuadrillas:   ["nombre", "miembros", "flete_dia"],
  maquinaria:   ["nombre", "tipo", "marca", "modelo", "placas", "serie"],
  proveedores:  ["nombre", "rfc", "telefono", "giro"],
  inventario:   ["nombre", "cat", "unidad", "ingredienteActivo", "reentradaDias", "carenciaDias"],  // el artículo, NO cuánto hay ni cuánto costó
};
// Jamás viajan, estén donde estén.
const PROHIBIDOS = /^(pin|password|contrasena|clave|token|hash|pin_.*|existencia|costo_unit|saldo|foto|ticket)$/i;

const normal = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const HUELE_A_PRUEBA = /\b(PRUEBA|TEST|DEMO|EJEMPLO|XXX+|ASDF?|QWERTY|BORRAR|FULANO|N\/A)\b|^(.)\2{2,}$|^\d+$/;

// Por qué dudar de un renglón. Vacío = no hay motivo a la vista (eso no lo
// vuelve verdadero: lo decide quien conoce el rancho).
export function dudasDe(tabla, fila) {
  const dudas = [];
  const n = normal(fila.nombre);
  if (!n) dudas.push("no tiene nombre");
  else if (n.length < 3) dudas.push("el nombre es demasiado corto");
  else if (HUELE_A_PRUEBA.test(n)) dudas.push("el nombre parece de prueba");
  if ((tabla === "trabajadores" || tabla === "encargados") && fila.sueldo_dia != null) {
    const s = Number(fila.sueldo_dia);
    if (!(s > 0)) dudas.push("sueldo en cero");
    else if (s < 100 || s > 3000) dudas.push(`sueldo fuera de lo usual (${s})`);
  }
  if (tabla === "parcelas" && !(Number(fila.hectareas) > 0)) dudas.push("sin hectáreas");
  return dudas;
}

// De una o varias fuentes viejas (respaldos de teléfonos, la lista que venía
// escrita en el código) arma la hoja de candidatos. `fuentes` = [{ nombre, datos }].
export function candidatosDeCatalogo(fuentes) {
  const hoja = [];
  for (const [tabla, columnas] of Object.entries(CATALOGOS_QUE_PUEDEN_VENIR)) {
    const porNombre = new Map();
    for (const f of fuentes || []) {
      for (const r of (f.datos && Array.isArray(f.datos[tabla]) ? f.datos[tabla] : [])) {
        if (!r || typeof r !== "object") continue;
        const limpio = {};
        for (const c of columnas) if (!PROHIBIDOS.test(c) && r[c] !== undefined && r[c] !== null && r[c] !== "") limpio[c] = r[c];
        const llave = normal(limpio.nombre) || `(sin nombre ${porNombre.size + 1})`;
        const previo = porNombre.get(llave);
        if (!previo) { porNombre.set(llave, { tabla, ...limpio, fuentes: [f.nombre], versiones: [limpio] }); continue; }
        if (!previo.fuentes.includes(f.nombre)) previo.fuentes.push(f.nombre);
        previo.versiones.push(limpio);
      }
    }
    for (const c of porNombre.values()) {
      const dudas = dudasDe(tabla, c);
      // El mismo nombre con datos distintos en dos fuentes: no se elige uno, se dice.
      const distintos = columnas.filter(col => col !== "nombre" && new Set(c.versiones.map(v => JSON.stringify(v[col] ?? null))).size > 1);
      if (distintos.length) dudas.push(`aparece con datos distintos en: ${distintos.join(", ")}`);
      const { versiones, ...fila } = c;
      hoja.push({ ...fila, veces: versiones.length, dudas, entra: "", correccion: "" });   // "entra" lo llena una persona
    }
  }
  return hoja;
}

// Lo que la persona aprobó, listo para entrar. Sólo lo marcado "sí"
// expresamente: una casilla en blanco es NO.
export function catalogoAprobado(hoja, { aprobadoPor, fecha, espacio, nuevoId }) {
  if (!aprobadoPor || !fecha) return { ok: false, dice: "Falta quién aprueba y en qué fecha.", registros: {} };
  const registros = {}, fuera = [];
  for (const fila of hoja || []) {
    const si = /^(s[ií]|x|✓|1|true)$/i.test(String(fila.entra || "").trim());
    if (!si) { fuera.push(fila); continue; }
    const columnas = CATALOGOS_QUE_PUEDEN_VENIR[fila.tabla];
    if (!columnas) { fuera.push(fila); continue; }
    const r = { id: nuevoId(fila.tabla) };
    for (const c of columnas) if (!PROHIBIDOS.test(c) && fila[c] !== undefined && fila[c] !== "") r[c] = fila[c];
    if (String(fila.correccion || "").trim()) r.nombre = String(fila.correccion).trim();
    if (!normal(r.nombre)) { fuera.push(fila); continue; }
    r.origen = { de: "catálogo validado", aprobadoPor, fecha, fuentes: fila.fuentes || [] };
    if (espacio) r._espacio = espacio;
    if (fila.tabla === "inventario") { r.existencia = 0; r.costo_unit = 0; }   // cuánto hay lo dice el conteo, no un respaldo
    (registros[fila.tabla] = registros[fila.tabla] || []).push(r);
  }
  // Las parcelas son de un rancho. Si se aprobó UNO solo, son de ése; si hay
  // varios (o ninguno) no se adivina: quedan sin rancho y se asignan en la app.
  const unRancho = (registros.ranchos || []).length === 1 ? registros.ranchos[0].id : null;
  let parcelasSinRancho = 0;
  for (const p of registros.parcelas || []) { if (unRancho) p.ranchoId = unRancho; else parcelasSinRancho++; }
  return { ok: true, registros, entran: Object.values(registros).reduce((s, l) => s + l.length, 0), fuera: fuera.length, parcelasSinRancho, dice: "" };
}

/* ════════════ CON QUÉ SE ABRE ════════════ */

// El inventario inicial sale de un conteo físico. Sin fecha, lugar y
// responsable no es un conteo: es un número que alguien escribió.
export function revisarConteoInicial({ fecha, ubicacion, responsable, renglones }) {
  const falta = [];
  if (!fecha) falta.push("la fecha del conteo");
  if (!String(ubicacion || "").trim()) falta.push("dónde se contó");
  if (!String(responsable || "").trim()) falta.push("quién contó");
  const filas = (renglones || []).filter(r => r && r.insumoId);
  if (filas.length === 0) falta.push("al menos un artículo contado");
  const malos = filas.filter(r => r.contado === "" || r.contado == null || !(Number(r.contado) >= 0));
  if (malos.length) falta.push(`${malos.length} artículo(s) sin cantidad contada (cero se escribe: 0)`);
  return { ok: falta.length === 0, falta, dice: falta.length ? `Falta: ${falta.join("; ")}.` : "" };
}

// El saldo inicial de una bolsa (banco, tarjeta, efectivo): con fecha de
// corte, responsable y evidencia. Sin evidencia se puede GUARDAR —un saldo sin
// papel sigue siendo mejor que ninguno— pero queda marcado y no se disfraza.
export function revisarSaldoInicial({ bolsaId, fechaCorte, monto, responsable, evidencia }) {
  const falta = [];
  if (!bolsaId) falta.push("de qué cuenta o caja es");
  if (!fechaCorte) falta.push("la fecha de corte");
  if (monto === "" || monto == null || !Number.isFinite(Number(monto))) falta.push("el saldo (si es cero, se escribe 0)");
  if (!String(responsable || "").trim()) falta.push("quién lo captura");
  const sinEvidencia = !evidencia;
  return {
    ok: falta.length === 0, falta, sinEvidencia,
    centavos: falta.length === 0 ? aCentavos(Number(monto)) : null,
    dice: falta.length ? `Falta: ${falta.join("; ")}.`
      : sinEvidencia ? "Se guarda, pero SIN evidencia: queda marcado así hasta que se adjunte el estado de cuenta o el arqueo." : "",
  };
}

// ¿Este registro es de antes o de después del inicio oficial?
export function respectoAlInicio(fechaRegistro, inicio) {
  if (!inicio) return { seSabe: false, dice: "Todavía no se declara la fecha de inicio de operaciones." };
  if (!fechaRegistro) return { seSabe: false, dice: "El registro no trae fecha." };
  return { seSabe: true, antes: fechaRegistro < inicio, dice: fechaRegistro < inicio ? `Es anterior al inicio de operaciones (${inicio}).` : "" };
}
