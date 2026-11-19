// ════════════════════════════════════════════════════════════════════════
//  MOVIMIENTOS DEL ALMACÉN — sacar algo NO es haberlo gastado
//
//  Siete cosas distintas que antes eran una sola ("salida"):
//
//    existencia     lo que hay físicamente en cada lugar
//    entrega        salió del almacén y lo trae alguien (alm_retiro)
//    custodia       quién lo trae y cuánto le queda — sale sola de lo demás
//    consumo        se gastó de verdad, y en qué (alm_consumo)
//    devolución     regresó al almacén (alm_devolucion)
//    traspaso       cambió de manos o se quedó con otro responsable (alm_traspaso)
//    ajuste         el conteo no coincide, se rompió, se perdió — con causa (alm_ajuste, alm_baja)
//
//  y aparte, mover de un lugar a otro sin que nadie lo traiga (alm_transferencia).
//
//  Reglas que no se rompen:
//  · La entrega baja la existencia del almacén pero NO genera costo. El costo
//    nace UNA vez, en el consumo, y se carga a lo que el consumo diga: parcela,
//    vehículo, actividad o uso general.
//  · Lo entregado y todavía sin cerrar está "con" alguien: tiene responsable y
//    saldo. No desaparece ni se da por gastado al final del día.
//  · La entrega NUNCA se bloquea por falta de existencia: el producto ya salió.
//    Se avisa y el saldo puede quedar en negativo. Cerrar de más sí se rechaza:
//    eso no es un hecho, es una cuenta que no sale.
//  · Una herramienta se presta y se devuelve; no se "consume". Si se pierde o se
//    rompe, es una baja con causa.
//  · El costo unitario se toma del artículo al momento de consumir. Si no tiene
//    costo, el consumo se registra igual y NO carga nada: se dice que falta.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, reglasDe } from "./eventos.js";
import { multiplicarDinero, sumarDinero } from "./calculos.js";

export const NAVE = "Nave";
export const T = { retiro: "alm_retiro", consumo: "alm_consumo", devolucion: "alm_devolucion", traspaso: "alm_traspaso", transferencia: "alm_transferencia", ajuste: "alm_ajuste", baja: "alm_baja", revision: "alm_revision" };
export const CAUSAS_AJUSTE = { conteo: "Diferencia de conteo", merma: "Merma (se echó a perder, se derramó)", caducidad: "Caducó", robo: "Robo o extravío", error: "Error de captura anterior", no_se_sabe: "No se sabe" };
export const CAUSAS_BAJA = { rota: "Se rompió", perdida: "Se perdió", desgaste: "Se acabó por uso", no_se_sabe: "No se sabe" };
export const DESTINOS = { parcela: "Parcela", vehiculo: "Vehículo o maquinaria", general: "Uso general del rancho" };
const PUEDE = ["admin", "encargado"];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r3 = (n) => Math.round(n * 1000) / 1000;
const costoDe = (articulo) => { const c = Number(articulo?.costo_unit); return c > 0 ? c : null; };
const destinoLimpio = (d) => (d && DESTINOS[d.tipo] ? { tipo: d.tipo, id: d.tipo === "general" ? null : d.id || null, nombre: d.nombre || "", actividad: String(d.actividad || "").trim() } : null);

// QR de un artículo: sólo su identificador. Sirve para escogerlo sin buscarlo.
export const textoDeArticulo = (articulo) => (articulo?.id ? `AGRO1:A:${articulo.id}` : "");
export function leerArticulo(texto, inventario) {
  const p = String(texto || "").trim().split(":");
  if (p.length < 3 || p[0] !== "AGRO1" || p[1] !== "A") return { ok: false, dice: "Ese código no es de un artículo del almacén." };
  const a = (inventario || []).find(x => x.id === p.slice(2).join(":"));
  return a ? { ok: true, articulo: a } : { ok: false, dice: "Ese artículo no está en este aparato." };
}

// ── Entregar ───────────────────────────────────────────────────────────────
export function entregar({ articulo, cantidad, de = NAVE, recibe, destino, nota = "", existencia, quien, cuando, fecha, capturado, azar }) {
  const q = num(cantidad); const avisos = [];
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador entrega del almacén." };
  if (!articulo?.id) return { ok: false, dice: "Falta decir qué se entrega." };
  if (!(q > 0)) return { ok: false, dice: "Falta decir cuánto." };
  if (!recibe?.nombre) return { ok: false, dice: "Falta decir quién lo recibe: sin responsable no hay a quién preguntarle después." };
  const d = destinoLimpio(destino);
  if (!articulo.esHerramienta && !d) avisos.push("No se dijo para qué es. Se entrega igual, pero al cerrar habrá que decir a qué se le carga.");
  if (existencia != null && q > existencia) avisos.push(`El almacén dice que hay ${r3(existencia)} y se están entregando ${q}. Se registra igual —ya salió— y la existencia queda en ${r3(existencia - q)}: o entró algo que nadie capturó, o salió más de lo anotado.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T.retiro, cuando, fecha, capturado, quien, azar,
    datos: { articuloId: articulo.id, articulo: articulo.nombre || "", unidad: articulo.unidad || "", cantidad: q, de, herramienta: !!articulo.esHerramienta,
      recibe: { tipo: recibe.tipo || "otro", id: recibe.id || null, nombre: String(recibe.nombre).trim() }, destino: d, nota: String(nota || "").trim() } }) };
}

// ── El estado: existencias que se movieron, lo que trae cada quien, y lo consumido ──
export function estadoDelAlmacen(eventos) {
  const evs = vigentes(eventos).filter(e => e.tipo.startsWith("alm_")).sort((a, b) => a.cuando.localeCompare(b.cuando) || a.capturado.localeCompare(b.capturado) || a.id.localeCompare(b.id));
  const deltas = new Map();                       // articuloId → Map(lugar → cuánto cambió)
  const mueve = (articuloId, lugar, d) => { if (!deltas.has(articuloId)) deltas.set(articuloId, new Map()); const m = deltas.get(articuloId); m.set(lugar, r3((m.get(lugar) || 0) + d)); };
  const lotes = new Map(); const consumos = []; const huerfanos = [];
  const abre = (e, cantidad, recibe, raiz) => lotes.set(e.id, { id: e.id, raiz: raiz?.raiz || e.id, articuloId: raiz?.articuloId || e.datos.articuloId, articulo: raiz?.articulo || e.datos.articulo, unidad: raiz?.unidad || e.datos.unidad,
    herramienta: raiz ? raiz.herramienta : !!e.datos.herramienta, cantidad, saldo: cantidad, usado: 0, devuelto: 0, traspasado: 0, baja: 0, recibe, destino: raiz ? raiz.destino : e.datos.destino,
    fecha: e.fecha, desde: e.cuando, entrego: e.quien?.nombre || "", revisado: null, evs: raiz ? [...raiz.evs, e.id] : [e.id] });
  for (const e of evs) {
    const d = e.datos;
    if (e.tipo === T.retiro) { mueve(d.articuloId, d.de || NAVE, -d.cantidad); abre(e, d.cantidad, d.recibe, null); continue; }
    if (e.tipo === T.transferencia) { mueve(d.articuloId, d.de, -d.cantidad); mueve(d.articuloId, d.a, d.cantidad); continue; }
    if (e.tipo === T.ajuste) { mueve(d.articuloId, d.lugar || NAVE, d.delta); continue; }
    if (e.tipo === T.consumo && !e.origen) {      // directo del almacén (combustible al tanque, por ejemplo)
      mueve(d.articuloId, d.de || NAVE, -d.cantidad);
      consumos.push({ ev: e.id, lote: null, articuloId: d.articuloId, articulo: d.articulo, unidad: d.unidad, cantidad: d.cantidad, destino: d.destino, costoUnit: d.costoUnit ?? null, costo: d.costoUnit ? multiplicarDinero(d.costoUnit, d.cantidad) : null, fecha: e.fecha, quien: e.quien?.nombre || "", evs: [e.id] });
      continue;
    }
    const l = lotes.get(e.origen);
    if (!l) { huerfanos.push(e.id); continue; }   // su entrega se canceló, o todavía no baja a este aparato
    const q = Math.min(d.cantidad, l.saldo);      // nunca más de lo que le queda (dos aparatos sin señal pueden cerrar lo mismo)
    if (q < d.cantidad) huerfanos.push(e.id);
    if (e.tipo === T.revision) { l.revisado = e.fecha; continue; }
    if (q <= 0) continue;
    l.saldo = r3(l.saldo - q);
    if (e.tipo === T.consumo) { l.usado = r3(l.usado + q); consumos.push({ ev: e.id, lote: l.id, articuloId: l.articuloId, articulo: l.articulo, unidad: l.unidad, cantidad: q, destino: d.destino || l.destino, costoUnit: d.costoUnit ?? null, costo: d.costoUnit ? multiplicarDinero(d.costoUnit, q) : null, fecha: e.fecha, quien: l.recibe.nombre, evs: [...l.evs, e.id] }); }
    else if (e.tipo === T.devolucion) { l.devuelto = r3(l.devuelto + q); mueve(l.articuloId, d.a || NAVE, q); }
    else if (e.tipo === T.traspaso) { l.traspasado = r3(l.traspasado + q); abre(e, q, d.recibe, l); }
    else if (e.tipo === T.baja) { l.baja = r3(l.baja + q); }
  }
  return { deltas, lotes: [...lotes.values()], consumos, huerfanos };
}

// Lo que hay en cada lugar: la existencia del catálogo (que mueven las entradas
// de siempre) más lo que movieron los eventos. Y aparte, lo que anda fuera con alguien.
export function existenciasDe(articulo, estado) {
  const m = estado.deltas.get(articulo.id) || new Map();
  const lugares = { [NAVE]: r3((Number(articulo.existencia) || 0) + (m.get(NAVE) || 0)) };
  for (const [lugar, d] of m) if (lugar !== NAVE) lugares[lugar] = d;
  const fuera = estado.lotes.filter(l => l.articuloId === articulo.id && l.saldo > 0);
  return { lugares, enAlmacenes: r3(Object.values(lugares).reduce((s, x) => s + x, 0)), conAlguien: r3(fuera.reduce((s, l) => s + l.saldo, 0)), quienes: fuera };
}
export const loQueTrae = (estado, filtro = () => true) => estado.lotes.filter(l => l.saldo > 0 && filtro(l));

// ── Cerrar lo entregado: cuánto se usó, cuánto regresó, cuánto se quedó con otro ──
// Devuelve TODOS los eventos del cierre, o ninguno. Lo que no se mencione se
// queda con quien lo trae.
export function cerrar({ lote, articulo, usado = 0, devuelto = 0, pasa = null, baja = null, destino = null, a = NAVE, quien, cuando, fecha, capturado, azar }) {
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador cierra lo entregado." };
  if (!lote) return { ok: false, dice: "Falta decir de qué entrega se trata." };
  const u = num(usado) || 0, d = num(devuelto) || 0, p = pasa ? num(pasa.cantidad) || 0 : 0, b = baja ? num(baja.cantidad) || 0 : 0;
  if ([u, d, p, b].some(x => x < 0)) return { ok: false, dice: "Las cantidades no pueden ser negativas." };
  if (u + d + p + b <= 0) return { ok: false, dice: "Falta decir qué pasó con lo entregado." };
  if (r3(u + d + p + b) > lote.saldo) return { ok: false, dice: `Le quedaban ${lote.saldo} ${lote.unidad} y se quiere cerrar ${r3(u + d + p + b)}. Revisa las cantidades.` };
  if (lote.herramienta && u > 0) return { ok: false, dice: "Una herramienta no se consume: se devuelve, se le pasa a otro, o se da de baja con su causa." };
  if (p > 0 && !pasa?.recibe?.nombre) return { ok: false, dice: "Falta decir con quién se queda." };
  if (b > 0 && !CAUSAS_BAJA[baja?.causa]) return { ok: false, dice: "Falta decir por qué se da de baja." };
  const dest = destinoLimpio(destino) || lote.destino;
  if (u > 0 && !dest) return { ok: false, dice: "Falta decir en qué se usó, para saber a qué se le carga." };
  const base = { cuando, fecha, capturado, quien, origen: lote.id };
  const eventos = []; const avisos = []; let k = 0;
  const nace = (tipo, relacion, datos) => eventos.push(nuevoEvento({ ...base, tipo, relacion, datos, azar: azar != null ? azar + (k++) / 1e9 : undefined }));
  if (u > 0) {
    const c = costoDe(articulo);
    if (!c) avisos.push(`"${lote.articulo}" no tiene costo capturado: el consumo queda registrado pero no le carga nada a su destino. Un costo que falta no es un cero.`);
    nace(T.consumo, "consume", { cantidad: u, destino: dest, costoUnit: c });
  }
  if (d > 0) nace(T.devolucion, "devuelve", { cantidad: d, a });
  if (p > 0) nace(T.traspaso, "traspasa", { cantidad: p, recibe: { tipo: pasa.recibe.tipo || "otro", id: pasa.recibe.id || null, nombre: String(pasa.recibe.nombre).trim() } });
  if (b > 0) nace(T.baja, "da_de_baja", { cantidad: b, causa: baja.causa, nota: String(baja.nota || "").trim() });
  return { ok: true, eventos, avisos };
}
// "Sigue con él": hoy se revisó y no cambió nada. No mueve nada; sólo quita el pendiente del día.
export const seQueda = ({ lote, quien, cuando, fecha, azar }) => (PUEDE.includes(quien?.rol)
  ? { ok: true, evento: nuevoEvento({ tipo: T.revision, cuando, fecha, quien, azar, origen: lote.id, relacion: "revisa", datos: { cantidad: 0, saldo: lote.saldo } }) }
  : { ok: false, dice: "Sólo un encargado o un administrador revisa lo entregado." });

// Consumo directo: sale del almacén y se gasta en el momento (diésel al tanque).
export function consumirDirecto({ articulo, cantidad, destino, de = NAVE, quien, cuando, fecha, capturado, azar }) {
  const q = num(cantidad); const dest = destinoLimpio(destino); const avisos = [];
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador registra un consumo." };
  if (!articulo?.id) return { ok: false, dice: "Falta decir qué se usó." };
  if (articulo.esHerramienta) return { ok: false, dice: "Una herramienta no se consume." };
  if (!(q > 0)) return { ok: false, dice: "Falta decir cuánto." };
  if (!dest) return { ok: false, dice: "Falta decir en qué se usó, para saber a qué se le carga." };
  const c = costoDe(articulo);
  if (!c) avisos.push(`"${articulo.nombre}" no tiene costo capturado: el consumo queda registrado pero no le carga nada a su destino.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T.consumo, cuando, fecha, capturado, quien, azar, datos: { articuloId: articulo.id, articulo: articulo.nombre || "", unidad: articulo.unidad || "", cantidad: q, de, destino: dest, costoUnit: c } }) };
}

export function transferir({ articulo, cantidad, de, a, quien, cuando, fecha, azar }) {
  const q = num(cantidad);
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador mueve entre almacenes." };
  if (!articulo?.id || !(q > 0)) return { ok: false, dice: "Falta decir qué y cuánto." };
  if (!de || !a || de === a) return { ok: false, dice: "Falta decir de dónde a dónde." };
  return { ok: true, evento: nuevoEvento({ tipo: T.transferencia, cuando, fecha, quien, azar, datos: { articuloId: articulo.id, articulo: articulo.nombre || "", unidad: articulo.unidad || "", cantidad: q, de, a } }) };
}
// Ajuste: lo contado no coincide con lo que debería haber. Siempre con causa; "no se sabe" es una causa válida.
export function ajustar({ articulo, lugar = NAVE, contado, existencia, causa, nota = "", quien, cuando, fecha, azar }) {
  const c = num(contado);
  if (quien?.rol !== "admin") return { ok: false, dice: "Un ajuste de inventario sólo lo hace un administrador." };
  if (!articulo?.id) return { ok: false, dice: "Falta decir de qué artículo." };
  if (Number.isNaN(c) || c < 0) return { ok: false, dice: "Falta lo que se contó." };
  if (!CAUSAS_AJUSTE[causa]) return { ok: false, dice: "Un ajuste sin causa no se registra. Si no se sabe, se pone \"No se sabe\"." };
  const delta = r3(c - (Number(existencia) || 0));
  if (delta === 0) return { ok: false, dice: "Lo contado coincide: no hay nada que ajustar." };
  return { ok: true, evento: nuevoEvento({ tipo: T.ajuste, cuando, fecha, quien, azar, datos: { articuloId: articulo.id, articulo: articulo.nombre || "", unidad: articulo.unidad || "", lugar, delta, contado: c, habia: Number(existencia) || 0, causa, nota: String(nota || "").trim() } }) };
}

// ── La conciliación del día: sólo lo que hay que ver ───────────────────────
// No es un cuestionario: lo que ya se cerró no aparece. Sale lo que sigue fuera
// y nadie ha revisado hoy, y primero lo que lleva más días.
export function porCerrar(estado, { hoy }) {
  const dias = (f) => Math.round((new Date(hoy + "T12:00:00Z") - new Date(f + "T12:00:00Z")) / 86400000);
  const abiertos = loQueTrae(estado).map(l => ({ ...l, dias: dias(l.fecha), revisadoHoy: l.revisado === hoy }));
  const pendientes = abiertos.filter(l => !l.revisadoHoy).sort((a, b) => b.dias - a.dias || a.recibe.nombre.localeCompare(b.recibe.nombre));
  return { pendientes, yaRevisados: abiertos.filter(l => l.revisadoHoy), deOtrosDias: pendientes.filter(l => l.dias > 0).length, herramientas: abiertos.filter(l => l.herramienta) };
}

// ── El costo, una sola vez: en el consumo ──────────────────────────────────
export function costoDeConsumos(estado, { desde, hasta } = {}) {
  const lista = estado.consumos.filter(c => (!desde || c.fecha >= desde) && (!hasta || c.fecha <= hasta));
  const con = lista.filter(c => c.costo != null);
  const de = (tipo) => sumarDinero(con.filter(c => c.destino?.tipo === tipo).map(c => c.costo));
  return { consumos: lista, total: sumarDinero(con.map(c => c.costo)), aParcelas: de("parcela"), aVehiculos: de("vehiculo"), general: de("general"), sinCosto: lista.filter(c => c.costo == null) };
}
// Para los reportes de costo por parcela que ya existían. Lo de vehículos y lo general NO va aquí.
export function actividadesDeAlmacen(consumos) {
  return consumos.filter(c => c.destino?.tipo === "parcela" && c.destino.id && c.costo != null).map(c => ({
    id: `alm:${c.ev}`, _deEventos: c.evs, fecha: c.fecha, parcelaId: c.destino.id, tipo: c.destino.actividad || "Insumos",
    registradoPor: { tipo: "almacen", id: "almacen", nombre: c.quien }, insumos: [{ id: c.articuloId, nombre: c.articulo, cantidad: c.cantidad, unidad: c.unidad, costo: c.costo }],
    costoInsumos: c.costo, costoMO: 0, costoMaq: 0, costoTotal: c.costo,
  }));
}

reglasDe(T.retiro, (e) => [{ clase: "sale_del_almacen", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, lugar: e.datos.de || NAVE }, { clase: "queda_con", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, responsable: e.datos.recibe.nombre }]);
reglasDe(T.consumo, (e) => [{ clase: "consumo", cantidad: e.datos.cantidad, destino: e.datos.destino || null, monto: e.datos.costoUnit ? multiplicarDinero(e.datos.costoUnit, e.datos.cantidad) : null }]);
reglasDe(T.devolucion, (e) => [{ clase: "regresa_al_almacen", cantidad: e.datos.cantidad, lugar: e.datos.a || NAVE }]);
reglasDe(T.traspaso, (e) => [{ clase: "queda_con", cantidad: e.datos.cantidad, responsable: e.datos.recibe.nombre }]);
reglasDe(T.transferencia, (e) => [{ clase: "cambia_de_lugar", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, de: e.datos.de, a: e.datos.a }]);
reglasDe(T.ajuste, (e) => [{ clase: "ajuste", articuloId: e.datos.articuloId, delta: e.datos.delta, causa: e.datos.causa }]);
reglasDe(T.baja, (e) => [{ clase: "baja", cantidad: e.datos.cantidad, causa: e.datos.causa }]);
reglasDe(T.revision, () => []);

// ── El puente con el inventario de siempre ─────────────────────────────────
// El catálogo guarda un número (`existencia`) que mueven las entradas, las
// compras y el conteo. Los eventos NO lo tocan: lo que movieron se le suma al
// enseñarlo. Así todas las pantallas de antes ven la existencia de verdad sin
// que el mismo movimiento quede guardado en dos lados.
export function conExistenciaReal(inventario, estado) {
  return (inventario || []).map(a => {
    const x = existenciasDe(a, estado); const movido = r3(x.lugares[NAVE] - (Number(a.existencia) || 0));
    const otros = Object.fromEntries(Object.entries(x.lugares).filter(([l]) => l !== NAVE));
    if (movido === 0 && x.conAlguien === 0 && Object.keys(otros).length === 0) return a;
    return { ...a, existencia: x.lugares[NAVE], _movido: movido, _conAlguien: x.conAlguien, _otrosLugares: otros };
  });
}
// Y al revés: cuando una pantalla de antes guarda el artículo (una compra le
// suma, un conteo lo fija), se le quita lo que pusieron los eventos, para que
// al volver a enseñarlo no se cuente dos veces.
export function paraGuardarArticulo(a) {
  if (!a || a._movido == null) return a;
  const { _movido, _conAlguien, _otrosLugares, ...resto } = a;
  return { ...resto, existencia: r3((Number(resto.existencia) || 0) - _movido) };
}
