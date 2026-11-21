// ════════════════════════════════════════════════════════════════════════
//  LA IA EN LA IMPORTACIÓN — sólo cuando los lectores gratuitos no pudieron
//
//  Aquí están las REGLAS (puras, probadas). La llamada de verdad la hace el
//  servidor (`supabase/functions/interpretar-documento`), que es donde vive la
//  llave y donde se lleva el presupuesto. Este módulo decide:
//
//   1. QUÉ documentos necesitan IA y cuáles no (`necesitaIA`). Un XML, un
//      Excel ordenado o un PDF con tabla no la necesitan NUNCA.
//   2. QUÉ se manda, lo menos posible (`pedidoDeHoja`): de una hoja
//      desordenada sólo viajan sus primeros renglones, y la IA sólo dice qué
//      columna es cada cosa — toda la hoja la lee después la app, gratis.
//   3. CÓMO entra lo que contestó (`hojasDeLectura`, `aprendidoDeLectura`): se
//      convierte a la MISMA forma que un Excel, así que pasa por el mismo
//      camino de siempre: duplicados, histórico, propuestas y confirmación.
//      La IA no registra nada: propone, igual que los demás lectores.
//   4. QUÉ TAN DE FIAR es (`revisarLectura`): la aritmética no la hace la IA,
//      la hace la app. Si los renglones no suman el total, si falta la fecha o
//      el importe, o si ella misma dijo que dudaba, queda «por revisar».
//   5. CUÁNTO COSTÓ y QUÉ TAN BIEN LEYÓ (`metricasDeIA`): por documento, y si
//      una persona lo aceptó tal cual, lo corrigió o lo descartó.
// ════════════════════════════════════════════════════════════════════════
import { aNumero, aFecha, normalizar } from "./lectura.js";
import { sumarDinero } from "./calculos.js";
import { T_DOC, bandejaDe, proponer } from "./importacion.js";
import { vigentes } from "./eventos.js";

export const NIVELES = { economico: "Económico", superior: "Superior (más caro, para lo difícil)" };
// Lo MÁS que puede costar una lectura, en millonésimas de dólar: lo mismo que aparta el servidor. Sirve para decirlo
// ANTES de gastar. (Precios por millón de unidades de texto, de la lista oficial del 20 nov 2026.)
export const PRECIOS = { economico: { modelo: "claude-haiku-5-5", entrada: 0.10, salida: 0.50, maxSalida: 12000 }, superior: { modelo: "claude-sonnet-5-5", entrada: 2, salida: 10, maxSalida: 12000 } };
export const costoMaximo = (nivel, { imagenes = 0, caracteres = 0 } = {}) => { const p = PRECIOS[nivel] || PRECIOS.economico; return Math.ceil((2500 + imagenes * 12000 + Math.ceil(caracteres / 2)) * p.entrada + p.maxSalida * p.salida); };
export const enDolares = (microusd) => { const d = (Number(microusd) || 0) / 1e6; return d === 0 ? "$0" : d < 0.01 ? `$${(Math.ceil(d * 1e4 - 1e-9) / 1e4).toFixed(4)}` : `$${d.toFixed(2)}`; };

/* ════════════ 1 · ¿ESTE DOCUMENTO NECESITA IA? ════════════ */
// Devuelve null (no la necesita, o no se puede) o { modo, porque }.
export function necesitaIA(doc) {
  if (!doc || ["incorporado", "descartado", "duplicado"].includes(doc.estado)) return null;
  if (doc.estado === "necesita_lectura") return { modo: "documento", via: doc.formato === "pdf" ? "paginas" : "imagen", porque: doc.formato === "pdf" ? "Es un escaneo: no trae texto que se pueda leer gratis." : "Es una foto: los lectores gratuitos no leen imágenes." };
  if (doc.estado !== "por_revisar") return null;
  if (doc.formato === "word_viejo" || doc.formato === "imagen") return null;   // una imagen ya leída con IA se reintenta con el nivel superior, no por aquí
  if ((doc.hojasSinReconocer || 0) > 0) return { modo: "hoja", via: "hoja", porque: "Trae una hoja cuyas columnas no se reconocen." };
  if (doc.sinEntender) return { modo: "documento", via: "texto", porque: "Se pudo abrir, pero no se reconoce qué es." };
  return null;
}

/* ════════════ 2 · LO QUE SE MANDA (lo menos posible) ════════════ */
const celda = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
const SENSIBLE = [/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g, /\b\d{11}\b/g, /\b\d{16,18}\b/g];   // CURP, NSS, tarjeta o CLABE
export const sinDatosSensibles = (t) => SENSIBLE.reduce((s, re) => s.replace(re, "▮▮▮"), String(t ?? ""));
// De una hoja sólo viajan los primeros renglones, con el número de cada columna. Los datos completos no salen del aparato.
export function pedidoDeHoja(filas, { renglones = 30, columnas = 14 } = {}) {
  const lineas = [];
  for (let i = 0; i < Math.min((filas || []).length, 200) && lineas.length < renglones; i++) {
    const f = (filas[i] || []).slice(0, columnas); if (!f.some(c => celda(c))) continue;
    lineas.push(`r${i}: ${f.map((c, k) => `c${k}=${sinDatosSensibles(celda(c))}`).join(" | ")}`);
  }
  return lineas.join("\n");
}
export const pedidoDeTexto = (texto, max = 12000) => sinDatosSensibles(String(texto || "").slice(0, max));

/* ════════════ 3 · LO QUE CONTESTÓ, EN LA FORMA DE SIEMPRE ════════════ */
const ENCABEZADOS = {
  nomina: ["Nombre", "Fecha", "Importe", "Días", "Puesto"], raya: ["Fecha", "Nombre", "Claves", "Cultivo", "Importe", "Observaciones"], personal: ["Nombre", "Puesto", "Sueldo diario", "Fecha de ingreso"],
  combustible: ["Fecha", "Vehículo", "Litros", "Importe"], actividades: ["Fecha", "Actividad", "Parcela", "Trabajador", "Importe"],
  gastos: ["Fecha", "Proveedor", "Concepto", "Total", "Folio"], proveedores: ["Proveedor", "Concepto"],
};
const UN_GASTO = ["ticket", "factura", "nota"];
const t = (v) => sinDatosSensibles(String(v ?? "").replace(/\s+/g, " ").trim());
// Una lectura de documento → hojas (como las de un Excel) para `proponer`. Un ticket es UN gasto: su total, no sus artículos.
export function hojasDeLectura(lectura) {
  const l = lectura || {}, r = Array.isArray(l.renglones) ? l.renglones : [];
  if (UN_GASTO.includes(l.clase)) {
    const concepto = r.map(x => t(x.concepto)).filter(Boolean).slice(0, 4).join(" · ").slice(0, 120) || ({ ticket: "Compra de mostrador", factura: "Factura", nota: "Nota" })[l.clase];
    return [{ nombre: "Leído con IA", filas: [ENCABEZADOS.gastos, [t(l.fecha), t(l.emisor), concepto, t(l.total), t(l.folio)]] }];
  }
  const filaDe = { raya: x => [t(x.fecha) || t(l.fecha), t(x.nombre), t(x.claves), t(x.cultivo), t(x.importe), t(x.observacion)], nomina: x => [t(x.nombre), t(x.fecha) || t(l.fecha), t(x.importe), t(x.dias), t(x.puesto)], personal: x => [t(x.nombre), t(x.puesto), t(x.importe), t(x.fecha)],
    combustible: x => [t(x.fecha) || t(l.fecha), t(x.vehiculo), t(x.litros), t(x.importe)], actividades: x => [t(x.fecha) || t(l.fecha), t(x.concepto), t(x.parcela), t(x.nombre), t(x.importe)],
    gastos: x => [t(x.fecha) || t(l.fecha), t(x.nombre) || t(l.emisor), t(x.concepto), t(x.importe), ""], proveedores: x => [t(x.nombre), t(x.concepto)] }[l.clase];
  if (!filaDe) return [];
  return [{ nombre: "Leído con IA", filas: [ENCABEZADOS[l.clase], ...r.map(filaDe)] }];
}
// Una lectura de hoja (qué columna es cada cosa) → un «aprendido» provisional para esos encabezados. NO se guarda como
// aprendido de verdad hasta que una persona confirma el documento: sólo se aprende de lo confirmado.
const CAMPOS_VALIDOS = ["fecha", "nombre", "puesto", "sueldo", "ingreso", "dias", "importe", "proveedor", "concepto", "litros", "vehiculo", "horometro", "parcela", "actividad", "personas", "folio", "periodo", "claves", "cultivo"];
export function aprendidoDeLectura(lectura, filas) {
  const l = lectura || {}, i = Number.parseInt(l.renglon_encabezado, 10);
  if (!ENCABEZADOS[l.clase]) return { ok: false, dice: l.clase === "estado_cuenta" ? "La IA dice que es un estado de cuenta del banco: se sube en la pantalla Banco." : "La IA tampoco reconoció qué es esta hoja." };
  if (!Number.isInteger(i) || i < 0 || i >= (filas || []).length) return { ok: false, dice: "La IA no supo decir en qué renglón están los encabezados." };
  const ancho = Math.max(...filas.slice(i, i + 5).map(f => (f || []).length)), mapa = {};
  for (const c of CAMPOS_VALIDOS) { const n = Number.parseInt(String(l.columnas?.[c] ?? "").replace(/^c/i, ""), 10); if (Number.isInteger(n) && n >= 0 && n < ancho && !Object.values(mapa).includes(n)) mapa[c] = n; }
  return { ok: true, clase: l.clase, i, encabezados: (filas[i] || []).map(x => String(x ?? "").trim()), mapa };
}

/* ════════════ 4 · ¿QUÉ TAN DE FIAR ES? ════════════ */
// La aritmética y las comprobaciones las hace la app, no la IA. Devuelve los motivos por los que una persona debe mirarlo.
export function revisarLectura(lectura, { cortada = false } = {}) {
  const l = lectura || {}, motivos = [];
  if (l.clase === "ilegible") return { confiable: false, sirve: false, motivos: ["La IA dice que no se alcanza a leer."] };
  if (l.clase === "otro") return { confiable: false, sirve: false, motivos: ["La IA no reconoció qué documento es."] };
  if (l.clase === "estado_cuenta") return { confiable: false, sirve: false, motivos: ["Es un estado de cuenta del banco: se sube en la pantalla Banco, que comprueba los saldos."] };
  if (cortada) motivos.push("El documento es largo y la lectura se cortó: pueden faltar renglones.");
  if (l.confianza === "baja") motivos.push("La IA dijo que no está segura de lo que leyó.");
  else if (l.confianza === "media") motivos.push("La IA dijo que hubo partes dudosas.");
  for (const x of l.no_se_leyo || []) motivos.push(`No se alcanzó a leer: ${t(x)}.`);
  for (const x of l.avisos || []) motivos.push(t(x));
  const r = Array.isArray(l.renglones) ? l.renglones : [], total = aNumero(l.total);
  if (UN_GASTO.includes(l.clase)) {
    if (!(total > 0)) motivos.push("No se leyó el total.");
    if (!aFecha(l.fecha)) motivos.push("No se leyó la fecha.");
    const importes = r.map(x => aNumero(x.importe)).filter(x => x != null);
    if (total > 0 && importes.length >= 2 && importes.length === r.length) {
      const suma = sumarDinero(importes), sub = aNumero(l.subtotal);
      if (Math.abs(suma - total) > 0.05 && !(sub > 0 && Math.abs(suma - sub) <= 0.05)) motivos.push(`Los renglones suman ${suma} y el total leído es ${total}: hay que comparar contra el papel.`);
    }
  } else {
    if (r.length === 0) motivos.push("No trae ningún renglón.");
    const sinImporte = ["nomina", "gastos"].includes(l.clase) ? r.filter(x => !(aNumero(x.importe) > 0)).length : 0;
    if (sinImporte) motivos.push(`${sinImporte} renglón(es) sin importe legible: no se proponen.`);
    if (total > 0 && r.length) { const suma = sumarDinero(r.map(x => aNumero(x.importe) || 0)); if (Math.abs(suma - total) > 0.05) motivos.push(`Los renglones suman ${suma} y el total del documento dice ${total}.`); }
  }
  return { confiable: motivos.length === 0, sirve: true, motivos: [...new Set(motivos)].slice(0, 12) };
}

/* ════════════ 5 · CUÁNTO COSTÓ Y QUÉ TAN BIEN LEYÓ ════════════ */
// Todo sale de los eventos de la bandeja: cada lectura con IA deja `ia` en su `doc_leido`, y cada incorporación dice
// si la persona aceptó todo lo propuesto (`ia.sinCambios`).
export function metricasDeIA(eventos = []) {
  const v = vigentes(eventos), docs = new Map(bandejaDe(eventos).map(d => [d.id, d]));
  const lecturas = v.filter(e => e.tipo === T_DOC.leido && e.datos.ia).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  const porDoc = new Map();
  for (const e of lecturas) { const x = porDoc.get(e.datos.docId) || { docId: e.datos.docId, microusd: 0, lecturas: 0, niveles: [] }; x.microusd += Number(e.datos.ia.microusd) || 0; x.lecturas++; x.niveles.push(e.datos.ia.nivel); x.ultima = e.datos.ia; x.estadoLeido = e.datos.estado; porDoc.set(e.datos.docId, x); }
  const filas = [...porDoc.values()].map(x => {
    const d = docs.get(x.docId) || {}, inc = v.find(e => e.tipo === T_DOC.incorporado && e.datos.docId === x.docId);
    const resultado = d.estado === "incorporado" ? (inc?.datos.ia?.sinCambios === false ? "con_cambios" : "correcto") : d.estado === "descartado" ? "descartado" : x.ultima?.sirve === false ? "no_pudo" : "pendiente";
    return { ...x, nombre: d.nombre || "", clase: d.clase || "", resultado, revision: x.ultima?.revision || [], confiable: !!x.ultima?.confiable, modelo: x.ultima?.modelo || "" };
  });
  const cuenta = (k) => filas.filter(f => f.resultado === k).length, decididos = cuenta("correcto") + cuenta("con_cambios") + cuenta("descartado") + cuenta("no_pudo");
  const microusd = filas.reduce((s, f) => s + f.microusd, 0);
  return { documentos: filas.length, lecturas: lecturas.length, microusd, promedio: filas.length ? Math.round(microusd / filas.length) : 0,
    correctos: cuenta("correcto"), conCambios: cuenta("con_cambios"), descartados: cuenta("descartado"), noPudo: cuenta("no_pudo"), pendientes: cuenta("pendiente"),
    pidieronRevision: filas.filter(f => !f.confiable).length,
    // Sin documentos ya decididos por una persona no hay tasa: un 100 % sobre cero es una mentira.
    tasa: decididos ? Math.round(cuenta("correcto") / decididos * 100) : null, decididos,
    superior: filas.filter(f => f.niveles.includes("superior")).length, filas: filas.sort((a, b) => b.microusd - a.microusd) };
}
export const NOMBRE_DE_RESULTADO = { correcto: "Aceptado tal cual", con_cambios: "Aceptado con cambios", descartado: "Descartado por una persona", no_pudo: "La IA no pudo", pendiente: "Falta que alguien lo confirme" };
// El estado del presupuesto, en palabras. `p` = lo que contesta `presupuesto_ia()` de la base.
export function estadoDelPresupuesto(p) {
  if (!p || p.tope == null) return { seSabe: false, dice: "No se pudo consultar el presupuesto de IA. Sin saberlo, no se manda nada a leer." };
  const usado = (Number(p.gastado) || 0) + (Number(p.apartado) || 0), queda = Math.max(0, Number(p.tope) - usado);
  return { seSabe: true, tope: Number(p.tope), gastado: Number(p.gastado) || 0, queda, agotado: queda <= 0, lecturas: Number(p.lecturas) || 0,
    dice: `Autorizado ${enDolares(p.tope)} · gastado ${enDolares(p.gastado)} en ${p.lecturas || 0} lectura(s) · queda ${enDolares(queda)}` };
}

/* ════════════ 6 · DE LA RESPUESTA DEL SERVIDOR AL RESULTADO DE SIEMPRE ════════════ */
// `respuesta` = lo que contestó el servidor ({ ok, modo, lectura, cortada, uso, deMemoria } o { error, dice }).
// Devuelve { resultado, ia, aprendido? } listo para anotar en la bandeja, o { error } si no hubo lectura.
//   doc        el documento de la bandeja (con sus `hojas` originales si es una hoja)
//   contexto   el mismo de `proponer`
export function resultadoConIA(doc, respuesta, contexto = {}) {
  if (!respuesta?.ok) return { error: respuesta?.dice || "No se pudo leer con IA.", motivo: respuesta?.error || "fallo", ia: respuesta?.uso ? { ...respuesta.uso, sirve: false } : null };
  const uso = respuesta.uso || {}, base = { modelo: uso.modelo || "", nivel: uso.nivel || "economico", microusd: Number(uso.microusd) || 0, entrada: uso.entrada ?? null, salida: uso.salida ?? null, deMemoria: !!respuesta.deMemoria };
  if (respuesta.modo === "hoja") {
    const hoja = (doc.hojas || [])[doc.hojaIA ?? 0], a = aprendidoDeLectura(respuesta.lectura, hoja?.filas || []);
    if (!a.ok) return { resultado: { ...proponer(doc, contexto), }, ia: { ...base, confianza: respuesta.lectura?.confianza || "", confiable: false, sirve: false, revision: [a.dice] }, dice: a.dice };
    const firma = a.encabezados.map(e => normalizar(e)).filter(Boolean).join("|");
    const provisional = [...(contexto.aprendidos || []).filter(x => x.firma !== firma), { firma, clase: a.clase, mapa: a.mapa }];
    const res = proponer({ ...doc, viaIA: true }, { ...contexto, aprendidos: provisional });
    const motivos = [...(respuesta.lectura.confianza === "alta" ? [] : [`La IA dijo que su confianza al reconocer las columnas es ${respuesta.lectura.confianza}.`]), ...(respuesta.lectura.avisos || []).map(t)];
    const confiable = motivos.length === 0 && res.descartadas.length === 0;
    res.excepciones = [`Las columnas de «${hoja?.nombre || "la hoja"}» las reconoció la IA (${Object.entries(a.mapa).map(([k, c]) => `${k}: «${a.encabezados[c] || `columna ${c + 1}`}»`).join(", ")}). Revisa que sean ésas antes de incorporar.`, ...motivos, ...res.excepciones.filter(e => !/no se reconoce/.test(e))];
    return { resultado: res, ia: { ...base, modo: "hoja", confianza: respuesta.lectura.confianza, confiable, sirve: true, revision: motivos }, aprendido: { encabezados: a.encabezados, clase: a.clase, mapa: a.mapa } };
  }
  const rev = revisarLectura(respuesta.lectura, { cortada: !!respuesta.cortada });
  const ia = { ...base, modo: "documento", clase: respuesta.lectura?.clase || "", confianza: respuesta.lectura?.confianza || "", confiable: rev.confiable, sirve: rev.sirve, revision: rev.motivos };
  if (!rev.sirve) return { resultado: { estado: "por_revisar", clase: "desconocido", periodo: null, propuestas: [], descartadas: [], excepciones: rev.motivos, hojas: [], uuid: null, total: 0, resumen: `Leído con IA: ${rev.motivos[0]}` }, ia };
  const res = proponer({ id: doc.id, nombre: doc.nombre, huella: doc.huella, formato: "excel", hojas: hojasDeLectura(respuesta.lectura), viaIA: true }, contexto);
  res.excepciones = [...rev.motivos, ...res.excepciones];
  res.resumen = `Leído con IA · ${res.resumen}`;
  // Leyó, pero de lo leído no salió nada que proponer (por ejemplo, sin total): que lo vea una persona.
  if (res.estado === "sin_uso") res.estado = "por_revisar";
  return { resultado: res, ia };
}
