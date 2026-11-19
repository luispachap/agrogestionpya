// ════════════════════════════════════════════════════════════════════════
//  MOVIMIENTOS DEL ALMACÉN — la existencia se CALCULA, nadie la escribe
//
//  Cada cosa que le pasa a un artículo es un movimiento aparte, con su propio
//  identificador. La existencia de cada lugar sale de sumarlos en el orden en
//  que PASARON. Por eso dos aparatos sin señal no se pisan: cada uno agrega
//  sus movimientos, y al juntarse sale lo mismo sin importar cuál subió primero.
//
//    entrada        llegó al almacén (compra, producción)            alm_entrada
//    entrega        salió y lo trae alguien                           alm_retiro
//    custodia       quién lo trae y cuánto le queda — se calcula
//    consumo        se gastó de verdad, y en qué                      alm_consumo
//    devolución     regresó al almacén                                alm_devolucion
//    traspaso       cambió de responsable                             alm_traspaso
//    transferencia  cambió de bodega                                  alm_transferencia
//    merma          se echó a perder, se derramó — con causa          alm_ajuste
//    conteo         "a esta hora había TANTO" — con causa si no cuadra alm_conteo
//    baja           herramienta rota o perdida, con causa y valor     alm_baja
//
//  Reglas que no se rompen:
//  · Entregar NO es gastar. El costo nace UNA vez, en el consumo.
//  · UNA SOLA FUENTE por cada cantidad consumida. Lo que un trabajador reporta
//    en su actividad se toma de lo que ÉL trae del almacén; si el encargado
//    cierra esa misma entrega sin haber visto ese reporte, lo que se empalma
//    cuenta una vez (la actividad manda) y queda señalado.
//  · Un conteo no es "súmale la diferencia": es "había TANTO". La diferencia
//    se calcula contra lo que los movimientos decían a esa hora, así que un
//    movimiento que llega tarde de otro aparato la recalcula sola.
//  · Nada se bloquea por falta de existencia: el producto ya salió. Queda una
//    discrepancia a la vista, pendiente hasta que alguien la explique. No se
//    inventa una compra ni un ajuste para taparla.
//  · Una baja NO es un descuento. Qué pasa con el trabajador es otra decisión,
//    de una persona, y queda escrita aparte.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, reglasDe } from "./eventos.js";
import { multiplicarDinero, sumarDinero } from "./calculos.js";

export const NAVE = "Nave";
export const T = { entrada: "alm_entrada", retiro: "alm_retiro", consumo: "alm_consumo", devolucion: "alm_devolucion", traspaso: "alm_traspaso", transferencia: "alm_transferencia",
  merma: "alm_ajuste", conteo: "alm_conteo", costo: "alm_costo", baja: "alm_baja", revision: "alm_revision", resolucion: "alm_resolucion" };
export const CAUSAS_AJUSTE = { conteo: "Error de conteo o de captura anterior", merma: "Merma (se echó a perder, se derramó)", caducidad: "Caducó", robo: "Robo o extravío", inicial: "Inventario inicial", no_se_sabe: "No se sabe" };
export const CAUSAS_BAJA = { desgaste: "Desgaste normal", accidente: "Accidente", perdida: "Pérdida", intencional: "Daño intencional", otro: "Otro caso" };
export const DESTINOS = { parcela: "Parcela", vehiculo: "Vehículo o maquinaria", general: "Uso general del rancho" };
// Plazos para lo entregado que nadie ha cerrado. Son reglas del rancho: se cambian desde la app.
export const PLAZOS = { aviso_h: 24, escala_h: 72, aviso_largo_d: 7, escala_largo_d: 15 };
const PUEDE = ["admin", "encargado"];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r3 = (n) => Math.round(n * 1000) / 1000;
const costoDe = (articulo) => { const c = Number(articulo?.costo_unit); return c > 0 ? c : null; };
const destinoLimpio = (d) => (d && DESTINOS[d.tipo] ? { tipo: d.tipo, id: d.tipo === "general" ? null : d.id || null, nombre: d.nombre || "", actividad: String(d.actividad || "").trim() } : null);
const persona = (p) => ({ tipo: p.tipo || "otro", id: p.id || null, nombre: String(p.nombre || "").trim() });
const ficha = (a) => ({ articuloId: a.id, articulo: a.nombre || "", unidad: a.unidad || "" });
export const esDeUsoLargo = (a) => !!(a?.esHerramienta || a?.usoProlongado);
// El instante en que pasó: ahorita si es de hoy; a mediodía del rancho si se captura de un día anterior.
export const instanteDe = (fecha, hoy, ahora) => (!fecha || fecha >= hoy ? ahora : new Date(`${fecha}T12:00:00-06:00`).toISOString());

// ── ¿Cuándo pasó de verdad? ────────────────────────────────────────────────
// Un movimiento trae TRES fechas y no se confunden:
//   cuando      la de la operación, según el reloj del teléfono
//   capturado   cuándo se tecleó, según el mismo reloj
//   _recibido   cuándo lo recibió el servidor — ésa no la pone el teléfono
// y además `reloj.desfase`: cuánto difería ese teléfono de la hora del servidor
// la última vez que la comprobó. Con eso el orden NO depende de un reloj mal puesto:
//   · si se capturó en el momento y el teléfono traía la hora mal, se corrige con su desfase;
//   · nada pudo pasar DESPUÉS de que el servidor lo recibió: si lo dice, el reloj iba adelantado;
//   · lo capturado de un día anterior (a mediodía de ese día) se deja como se dijo.
// La corrección nunca es callada: queda en `nota` y sale en lo que hay que revisar.
export const TOLERANCIA_RELOJ_MS = 2 * 60000;
export function momentoDe(e) {
  const cu = Date.parse(e.cuando), cap = Date.parse(e.capturado || e.cuando);
  const enVivo = Math.abs(cap - cu) < 60000;
  const d = typeof e.reloj?.desfase === "number" ? e.reloj.desfase : null;
  const rec = e._recibido ? Date.parse(e._recibido) : null;
  let t = cu, nota = null;
  if (enVivo && d != null && Math.abs(d) > TOLERANCIA_RELOJ_MS) { t = cu + d; nota = d > 0 ? "atrasado" : "adelantado"; }
  if (rec != null && t > rec + TOLERANCIA_RELOJ_MS) { t = rec; nota = "adelantado"; }
  return { t, nota, movido: t - cu, comprobado: d != null || rec != null };
}

// QR de un artículo: sólo su identificador. Sirve para escogerlo sin buscarlo.
export const textoDeArticulo = (articulo) => (articulo?.id ? `AGRO1:A:${articulo.id}` : "");
export function leerArticulo(texto, inventario) {
  const p = String(texto || "").trim().split(":");
  if (p.length < 3 || p[0] !== "AGRO1" || p[1] !== "A") return { ok: false, dice: "Ese código no es de un artículo del almacén." };
  const a = (inventario || []).find(x => x.id === p.slice(2).join(":"));
  return a ? { ok: true, articulo: a } : { ok: false, dice: "Ese artículo no está en este aparato." };
}

// ── Entra ──────────────────────────────────────────────────────────────────
export function entrada({ articulo, cantidad, lugar = NAVE, costoUnit = null, concepto = "", ref = null, quien, cuando, fecha, capturado, azar }) {
  const q = num(cantidad);
  if (!articulo?.id || !(q > 0)) return { ok: false, dice: "Falta decir qué entró y cuánto." };
  return { ok: true, evento: nuevoEvento({ tipo: T.entrada, cuando, fecha, capturado, quien, azar, datos: { ...ficha(articulo), cantidad: q, lugar, ...(Number(costoUnit) > 0 ? { costoUnit: Number(costoUnit) } : {}), concepto: String(concepto || "").trim(), ...(ref ? { ref } : {}) } }) };
}
// Lo que las pantallas de siempre hacían con "súmale / réstale": ahora es un
// movimiento. Lo que resta desde una actividad NO lleva costo aquí: su costo ya
// va en la actividad (ésa es su fuente), y aquí queda quién lo usó para poder
// empatarlo con lo que trae del almacén.
export function movimientoDeSiempre({ articulo, delta, movimiento = {}, usadoPor = null, quien, cuando, fecha, azar }) {
  const d = num(delta);
  if (!articulo?.id || !d) return null;
  if (d > 0) return entrada({ articulo, cantidad: d, costoUnit: movimiento.costoUnit, concepto: movimiento.concepto || "Entrada", ref: movimiento.ref, quien, cuando, fecha, azar }).evento;
  const destino = movimiento.vehiculoId ? { tipo: "vehiculo", id: movimiento.vehiculoId, nombre: "", actividad: "" } : movimiento.parcelaId ? { tipo: "parcela", id: movimiento.parcelaId, nombre: "", actividad: "" } : { tipo: "general", id: null, nombre: "", actividad: "" };
  return nuevoEvento({ tipo: T.consumo, cuando, fecha, quien, azar, datos: { ...ficha(articulo), cantidad: -d, de: NAVE, destino, via: "actividad", usadoPor: persona(usadoPor || quien), ...(costoDe(articulo) ? { costoVisto: costoDe(articulo) } : {}), concepto: String(movimiento.concepto || "").trim(), ...(movimiento.actividadId ? { actividadId: movimiento.actividadId } : {}) } });
}

// Fijar el costo de un artículo "de aquí en adelante" (una corrección a mano).
// No toca lo que ya se consumió: eso se quedó con el costo que tenía.
export function fijarCosto({ articulo, costoUnit, motivo = "", quien, cuando, fecha, azar }) {
  const c = num(costoUnit);
  if (!articulo?.id || !(c > 0)) return { ok: false, dice: "Falta el costo." };
  return { ok: true, evento: nuevoEvento({ tipo: T.costo, cuando, fecha, quien, azar, datos: { ...ficha(articulo), costoUnit: c, motivo: String(motivo || "").trim() } }) };
}

// ── Entregar ───────────────────────────────────────────────────────────────
export function entregar({ articulo, cantidad, de = NAVE, recibe, destino, nota = "", revisarEl = null, existencia, quien, cuando, fecha, capturado, azar }) {
  const q = num(cantidad); const avisos = [];
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador entrega del almacén." };
  if (!articulo?.id) return { ok: false, dice: "Falta decir qué se entrega." };
  if (!(q > 0)) return { ok: false, dice: "Falta decir cuánto." };
  if (!recibe?.nombre) return { ok: false, dice: "Falta decir quién lo recibe: sin responsable no hay a quién preguntarle después." };
  if (revisarEl && revisarEl < fecha) return { ok: false, dice: "La fecha para revisarlo no puede ser anterior a la entrega." };
  const d = destinoLimpio(destino);
  if (!articulo.esHerramienta && !d) avisos.push("No se dijo para qué es. Se entrega igual, pero al cerrar habrá que decir a qué se le carga.");
  if (existencia != null && q > existencia) avisos.push(`El almacén dice que hay ${r3(existencia)} y se están entregando ${q}. Se registra igual —ya salió— y queda como discrepancia pendiente de revisar: o entró algo que nadie capturó, o salió más de lo anotado.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T.retiro, cuando, fecha, capturado, quien, azar,
    datos: { ...ficha(articulo), cantidad: q, de, herramienta: !!articulo.esHerramienta, largo: esDeUsoLargo(articulo), recibe: persona(recibe), destino: d, nota: String(nota || "").trim(), ...(revisarEl ? { revisarEl } : {}) } }) };
}

// ── El estado: se arma recorriendo los movimientos en el orden en que pasaron ──
// `inventario` es el catálogo tal como está guardado: su `existencia` es sólo
// el punto de partida (lo que había antes de que existieran los movimientos).
export function estadoDelAlmacen(eventos, inventario = []) {
  const todos = vigentes(eventos).filter(e => e.tipo.startsWith("alm_"));
  const mom = new Map(todos.map(e => [e.id, momentoDe(e)]));
  const evs = todos.filter(e => e.tipo !== T.resolucion).sort((a, b) => mom.get(a.id).t - mom.get(b.id).t || a.capturado.localeCompare(b.capturado) || a.id.localeCompare(b.id));
  const relojes = todos.filter(e => mom.get(e.id).nota).map(e => ({ ev: e.id, clase: "reloj", tipo: e.tipo, articulo: e.datos.articulo || "", fecha: e.fecha, quien: e.quien?.nombre || "", nota: mom.get(e.id).nota, minutos: Math.round(Math.abs(mom.get(e.id).movido) / 60000) }));
  const resueltas = new Map(); for (const e of todos) if (e.tipo === T.resolucion && e.origen) resueltas.set(e.origen, { texto: e.datos.texto, por: e.quien?.nombre || "", cuando: e.cuando, ev: e.id });
  const saldos = new Map();                       // articuloId → Map(lugar → cuánto hay)
  const de = (id) => { if (!saldos.has(id)) saldos.set(id, new Map()); return saldos.get(id); };
  for (const a of inventario || []) if (a?.id) de(a.id).set(NAVE, Number(a.existencia) || 0);
  // LA VALUACIÓN. El costo promedio también se calcula: cada compra conserva su
  // cantidad, su precio y su fecha, y el promedio sale de recorrerlas en orden.
  // No depende de cuál teléfono subió al último.
  const prom = new Map(); for (const a of inventario || []) if (a?.id && Number(a.costo_unit) > 0) prom.set(a.id, Number(a.costo_unit));
  const compras = [];
  const enInventario = (id) => { let n = 0; for (const x of de(id).values()) n += x; for (const l of lotes.values()) if (l.articuloId === id) n += l.saldo; return n; };
  const hay = (id, lugar) => de(id).get(lugar) || 0;
  const mueve = (id, lugar, d) => de(id).set(lugar, r3(hay(id, lugar) + d));
  const lotes = new Map(); const consumos = []; const huerfanos = []; const discrepancias = []; const ajustes = []; const bajas = []; const empalmes = []; const conteos = [];
  // Sacar sin que alcance: se hace, y queda anotado con cuánto faltaba.
  const saca = (e, id, lugar, q) => { const h = hay(id, lugar); if (q > h) discrepancias.push({ ev: e.id, clase: "sin_existencia", articuloId: id, articulo: e.datos.articulo, unidad: e.datos.unidad, lugar, habia: h, salieron: q, faltaban: r3(q - Math.max(h, 0)), fecha: e.fecha, quien: e.quien?.nombre || "", resuelta: resueltas.get(e.id) || null }); mueve(id, lugar, -q); };
  const abre = (e, cantidad, recibe, raiz) => lotes.set(e.id, { id: e.id, raiz: raiz?.raiz || e.id, articuloId: raiz?.articuloId || e.datos.articuloId, articulo: raiz?.articulo || e.datos.articulo, unidad: raiz?.unidad || e.datos.unidad,
    herramienta: raiz ? raiz.herramienta : !!e.datos.herramienta, largo: raiz ? raiz.largo : !!(e.datos.largo || e.datos.herramienta), cantidad, saldo: cantidad, usado: 0, usadoAct: 0, empalmado: 0, devuelto: 0, traspasado: 0, baja: 0, recibe, destino: raiz ? raiz.destino : e.datos.destino,
    fecha: e.fecha, desde: e.cuando, entrego: e.quien?.nombre || "", revisado: null, proxima: e.datos.revisarEl || null, cierres: [], evs: raiz ? [...raiz.evs, e.id] : [e.id] });
  // Cada consumo guarda el costo con que se CAPTURÓ (el original, que no se toca) y,
  // aparte, lo que valía a esa hora con todo lo que hoy se sabe.
  const anota = (c, e) => { c.promedioEntonces = prom.get(c.articuloId) ?? null; c.costoVisto = e.datos.costoUnit ?? e.datos.costoVisto ?? null; c.t = mom.get(e.id).t; c.capturado = e.capturado; consumos.push(c); return c; };
  for (const e of evs) {
    const d = e.datos;
    if (e.tipo === T.entrada) {
      if (Number(d.costoUnit) > 0) {
        const habia = Math.max(enInventario(d.articuloId), 0), antes = prom.get(d.articuloId);
        // Sin existencia (o sin costo anterior), el costo es el de esta compra. Si no, el promedio ponderado.
        prom.set(d.articuloId, antes == null || habia <= 0 ? d.costoUnit : (habia * antes + d.cantidad * d.costoUnit) / (habia + d.cantidad));
        compras.push({ ev: e.id, articuloId: d.articuloId, cantidad: d.cantidad, costoUnit: d.costoUnit, fecha: e.fecha, t: mom.get(e.id).t, capturado: e.capturado, promedioDespues: prom.get(d.articuloId) });
      }
      mueve(d.articuloId, d.lugar || NAVE, d.cantidad); continue;
    }
    if (e.tipo === T.costo) { prom.set(d.articuloId, d.costoUnit); continue; }
    if (e.tipo === T.retiro) { saca(e, d.articuloId, d.de || NAVE, d.cantidad); abre(e, d.cantidad, d.recibe, null); continue; }
    if (e.tipo === T.transferencia) { saca(e, d.articuloId, d.de, d.cantidad); mueve(d.articuloId, d.a, d.cantidad); continue; }
    if (e.tipo === T.merma) { mueve(d.articuloId, d.lugar || NAVE, d.delta); ajustes.push({ ev: e.id, clase: "merma", articuloId: d.articuloId, articulo: d.articulo, unidad: d.unidad, lugar: d.lugar || NAVE, diferencia: d.delta, causa: d.causa, nota: d.nota || "", fecha: e.fecha, quien: e.quien?.nombre || "" }); continue; }
    if (e.tipo === T.conteo) {
      const lugar = d.lugar || NAVE; const calculado = hay(d.articuloId, lugar); const dif = r3(d.contado - calculado);
      de(d.articuloId).set(lugar, d.contado);
      conteos.push({ ev: e.id, articuloId: d.articuloId, lugar, fecha: e.fecha, cuando: e.cuando, contado: d.contado, quien: e.quien?.nombre || "" });
      if (dif !== 0) ajustes.push({ ev: e.id, clase: "conteo", articuloId: d.articuloId, articulo: d.articulo, unidad: d.unidad, lugar, diferencia: dif, calculado, contado: d.contado, causa: d.causa || "no_se_sabe", nota: d.nota || "", fecha: e.fecha, quien: e.quien?.nombre || "",
        // Quien contó vio otra diferencia: después llegó un movimiento de otro aparato. La causa que puso era para aquélla.
        cambio: d.diferenciaVista != null && r3(d.diferenciaVista) !== dif ? { vista: d.diferenciaVista } : null, sinCausa: !d.causa, resuelta: resueltas.get(e.id) || null });
      continue;
    }
    if (e.tipo === T.consumo && !e.origen) {
      let q = d.cantidad; const evsDe = [e.id];
      if (d.via === "actividad" && d.usadoPor?.id) {
        // 1 · De lo que esa persona TRAE del almacén (lo más viejo primero).
        for (const l of lotes.values()) { if (q <= 0) break; if (l.articuloId !== d.articuloId || l.recibe.id !== d.usadoPor.id || l.saldo <= 0 || l.herramienta) continue;
          const t = Math.min(q, l.saldo); l.saldo = r3(l.saldo - t); l.usado = r3(l.usado + t); l.usadoAct = r3(l.usadoAct + t); q = r3(q - t); evsDe.push(l.id); }
        // 2 · De una entrega suya que ESE DÍA ya se cerró como "se usó": es lo mismo, capturado dos veces. Cuenta una: la actividad.
        for (const l of lotes.values()) { if (q <= 0) break; if (l.articuloId !== d.articuloId || l.recibe.id !== d.usadoPor.id) continue;
          for (const c of l.cierres) { if (q <= 0) break; if (c.fecha !== e.fecha || c.cantidad <= 0) continue;
            const t = Math.min(q, c.cantidad); c.cantidad = r3(c.cantidad - t); c.costo = c.costoUnit ? multiplicarDinero(c.costoUnit, c.cantidad) : null; q = r3(q - t); l.usadoAct = r3(l.usadoAct + t); l.empalmado = r3(l.empalmado + t);
            empalmes.push({ ev: e.id, con: c.ev, lote: l.id, articuloId: l.articuloId, articulo: l.articulo, unidad: l.unidad, cantidad: t, fecha: e.fecha, quien: d.usadoPor.nombre }); evsDe.push(l.id); } }
      }
      // 3 · Lo demás, directo del almacén.
      if (q > 0) saca(e, d.articuloId, d.de || NAVE, q);
      anota({ ev: e.id, lote: null, articuloId: d.articuloId, articulo: d.articulo, unidad: d.unidad, cantidad: d.cantidad, destino: d.destino, costoUnit: d.costoUnit ?? null, costo: d.costoUnit ? multiplicarDinero(d.costoUnit, d.cantidad) : null,
        enActividad: d.via === "actividad", actividadId: d.actividadId || null, fecha: e.fecha, quien: d.usadoPor?.nombre || e.quien?.nombre || "", evs: evsDe }, e);
      continue;
    }
    const l = lotes.get(e.origen);
    if (!l) { huerfanos.push({ ev: e.id, clase: "sin_entrega", fecha: e.fecha, quien: e.quien?.nombre || "", resuelta: resueltas.get(e.id) || null }); continue; }   // su entrega se canceló, o todavía no baja a este aparato
    if (e.tipo === T.revision) { l.revisado = e.fecha; l.proxima = d.proxima || null; continue; }
    let pedido = d.cantidad;
    if (e.tipo === T.consumo) {
      // Lo que el trabajador ya reportó en su actividad y quien cierra NO vio: es lo mismo. No se cuenta otra vez.
      const noVisto = Math.max(0, r3(l.usadoAct - (Number(d.yaReportado) || 0) - l.empalmado)); const t = Math.min(pedido, noVisto);
      if (t > 0) { l.empalmado = r3(l.empalmado + t); pedido = r3(pedido - t); empalmes.push({ ev: e.id, con: null, lote: l.id, articuloId: l.articuloId, articulo: l.articulo, unidad: l.unidad, cantidad: t, fecha: e.fecha, quien: l.recibe.nombre }); }
    }
    const q = Math.min(pedido, l.saldo);          // nunca más de lo que le queda (dos aparatos sin señal pueden cerrar lo mismo)
    if (q < pedido) huerfanos.push({ ev: e.id, clase: "de_mas", lote: l.id, articulo: l.articulo, unidad: l.unidad, pedia: pedido, cupo: q, fecha: e.fecha, quien: e.quien?.nombre || "", resuelta: resueltas.get(e.id) || null });
    l.saldo = r3(l.saldo - q);
    if (e.tipo === T.consumo) { l.usado = r3(l.usado + q); const c = anota({ ev: e.id, lote: l.id, articuloId: l.articuloId, articulo: l.articulo, unidad: l.unidad, cantidad: q, destino: d.destino || l.destino, costoUnit: d.costoUnit ?? null, costo: d.costoUnit ? multiplicarDinero(d.costoUnit, q) : null, enActividad: false, actividadId: null, fecha: e.fecha, quien: l.recibe.nombre, evs: [...l.evs, e.id] }, e); l.cierres.push(c); }
    else if (q <= 0) continue;
    else if (e.tipo === T.devolucion) { l.devuelto = r3(l.devuelto + q); mueve(l.articuloId, d.a || NAVE, q); }
    else if (e.tipo === T.traspaso) { l.traspasado = r3(l.traspasado + q); abre(e, q, d.recibe, l); }
    else if (e.tipo === T.baja) { l.baja = r3(l.baja + q); bajas.push({ ev: e.id, lote: l.id, articuloId: l.articuloId, articulo: l.articulo, unidad: l.unidad, cantidad: q, responsable: l.recibe.nombre, causa: d.causa, nota: d.nota || "", valor: d.valorUnit ? multiplicarDinero(d.valorUnit, q) : null, evidencia: d.evidencia || null, fecha: e.fecha, quien: e.quien?.nombre || "", resuelta: resueltas.get(e.id) || null }); }
  }
  // Dos conteos del mismo artículo en el mismo lugar y día que no dicen lo mismo: vale el último, pero se enseña.
  const porDia = new Map(); for (const c of conteos) { const k = `${c.articuloId}|${c.lugar}|${c.fecha}`; porDia.set(k, [...(porDia.get(k) || []), c]); }
  const conteosDistintos = [...porDia.values()].filter(g => new Set(g.map(c => c.contado)).size > 1).map(g => ({ ev: g[g.length - 1].ev, clase: "conteos_distintos", articuloId: g[0].articuloId, lugar: g[0].lugar, fecha: g[0].fecha, dicen: g.map(c => ({ contado: c.contado, quien: c.quien })), resuelta: resueltas.get(g[g.length - 1].ev) || null }));
  // Lo que hoy está en negativo, aunque el movimiento que lo causó ya no se distinga.
  const negativos = []; for (const [id, m] of saldos) for (const [lugar, n] of m) if (n < 0) negativos.push({ articuloId: id, lugar, hay: n });
  // Conteos con la hora todavía sin comprobar (el teléfono nunca la ha cotejado y el servidor aún no lo recibe).
  const conteosSinHora = evs.filter(e => e.tipo === T.conteo && !mom.get(e.id).comprobado).map(e => e.id);
  return { saldos, lotes: [...lotes.values()], consumos: consumos.filter(c => c.cantidad > 0 || c.enActividad), huerfanos, discrepancias, ajustes, bajas, empalmes, conteos, conteosDistintos, negativos,
    promedios: prom, compras, relojes, conteosSinHora };
}

// Lo que hay en cada lugar, y aparte lo que anda fuera con alguien.
export function existenciasDe(articulo, estado) {
  const m = estado.saldos.get(articulo.id) || new Map();
  const lugares = { [NAVE]: m.get(NAVE) ?? (Number(articulo.existencia) || 0) };
  for (const [lugar, d] of m) if (lugar !== NAVE) lugares[lugar] = d;
  const fuera = estado.lotes.filter(l => l.articuloId === articulo.id && l.saldo > 0);
  return { lugares, enAlmacenes: r3(Object.values(lugares).reduce((s, x) => s + x, 0)), conAlguien: r3(fuera.reduce((s, l) => s + l.saldo, 0)), quienes: fuera };
}
export const loQueTrae = (estado, filtro = () => true) => estado.lotes.filter(l => l.saldo > 0 && filtro(l));

// ── Cerrar lo entregado ────────────────────────────────────────────────────
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
  if (b > 0 && baja.causa === "otro" && !String(baja.nota || "").trim()) return { ok: false, dice: "Si es otro caso, hay que escribir qué pasó." };
  const dest = destinoLimpio(destino) || lote.destino;
  if (u > 0 && !dest) return { ok: false, dice: "Falta decir en qué se usó, para saber a qué se le carga." };
  const base = { cuando, fecha, capturado, quien, origen: lote.id };
  const eventos = []; const avisos = []; let k = 0; const c = costoDe(articulo);
  const nace = (tipo, relacion, datos) => eventos.push(nuevoEvento({ ...base, tipo, relacion, datos, azar: azar != null ? azar + (k++) / 1e9 : undefined }));
  if (u > 0) {
    if (!c) avisos.push(`"${lote.articulo}" no tiene costo capturado: el consumo queda registrado pero no le carga nada a su destino. Un costo que falta no es un cero.`);
    // `yaReportado`: lo que quien cierra VIO que el trabajador ya había reportado. Con eso se sabe después si lo que cierra es aparte o es lo mismo.
    nace(T.consumo, "consume", { cantidad: u, destino: dest, costoUnit: c, yaReportado: lote.usadoAct || 0 });
  }
  if (d > 0) nace(T.devolucion, "devuelve", { cantidad: d, a });
  if (p > 0) nace(T.traspaso, "traspasa", { cantidad: p, recibe: persona(pasa.recibe) });
  if (b > 0) {
    const valor = Number(baja.valorUnit) > 0 ? Number(baja.valorUnit) : c;
    if (!valor) avisos.push("No se sabe cuánto vale: la baja queda sin valor, no en cero.");
    nace(T.baja, "da_de_baja", { cantidad: b, causa: baja.causa, nota: String(baja.nota || "").trim(), valorUnit: valor, ...(baja.evidencia ? { evidencia: baja.evidencia } : {}) });
  }
  return { ok: true, eventos, avisos };
}
// "Sigue en uso / sigue con él": se revisó y no cambió nada. No es consumo ni
// devolución; sólo dice cuándo se vuelve a preguntar.
export function seQueda({ lote, proxima = null, quien, cuando, fecha, azar }) {
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador revisa lo entregado." };
  if (proxima && proxima < fecha) return { ok: false, dice: "La próxima revisión no puede ser una fecha que ya pasó." };
  return { ok: true, evento: nuevoEvento({ tipo: T.revision, cuando, fecha, quien, azar, origen: lote.id, relacion: "revisa", datos: { cantidad: 0, saldo: lote.saldo, ...(proxima ? { proxima } : {}) } }) };
}

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
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T.consumo, cuando, fecha, capturado, quien, azar, datos: { ...ficha(articulo), cantidad: q, de, destino: dest, costoUnit: c } }) };
}

export function transferir({ articulo, cantidad, de, a, quien, cuando, fecha, azar }) {
  const q = num(cantidad);
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador mueve entre almacenes." };
  if (!articulo?.id || !(q > 0)) return { ok: false, dice: "Falta decir qué y cuánto." };
  if (!de || !a || de === a) return { ok: false, dice: "Falta decir de dónde a dónde." };
  return { ok: true, evento: nuevoEvento({ tipo: T.transferencia, cuando, fecha, quien, azar, datos: { ...ficha(articulo), cantidad: q, de, a } }) };
}
// Merma: se sabe que se perdió tanto, sin contar todo. Siempre con causa.
export function merma({ articulo, lugar = NAVE, cantidad, causa, nota = "", quien, cuando, fecha, azar }) {
  const q = num(cantidad);
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Una merma la registra un encargado o un administrador." };
  if (!articulo?.id || !(q > 0)) return { ok: false, dice: "Falta decir de qué artículo y cuánto." };
  if (!String(causa || "").trim()) return { ok: false, dice: "Una merma sin causa no se registra. Si no se sabe, se pone \"no se sabe\"." };
  return { ok: true, evento: nuevoEvento({ tipo: T.merma, cuando, fecha, quien, azar, datos: { ...ficha(articulo), lugar, delta: -q, causa: String(causa).trim(), nota: String(nota || "").trim() } }) };
}
// Conteo: "a esta hora, en este lugar, había TANTO". Si no cuadra con lo que
// se ve en ese momento, lleva causa. No guarda una diferencia para sumar:
// guarda lo contado, y la diferencia se calcula.
export function contar({ articulo, lugar = NAVE, contado, existencia, causa = "", nota = "", responsable = "", quien, cuando, fecha, azar }) {
  const c = num(contado);
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "El conteo lo registra un encargado o un administrador." };
  if (!articulo?.id) return { ok: false, dice: "Falta decir de qué artículo." };
  if (Number.isNaN(c) || c < 0) return { ok: false, dice: "Falta lo que se contó." };
  const dif = r3(c - (Number(existencia) || 0));
  if (dif !== 0 && !String(causa || "").trim()) return { ok: false, dice: "No cuadra, y un ajuste sin causa no se registra. Si no se sabe, se pone \"no se sabe\"." };
  return { ok: true, diferencia: dif, evento: nuevoEvento({ tipo: T.conteo, cuando, fecha, quien, azar, datos: { ...ficha(articulo), lugar, contado: c, diferenciaVista: dif, ...(dif !== 0 ? { causa: String(causa).trim() } : {}), nota: String(nota || "").trim(), ...(responsable ? { responsable: String(responsable).trim() } : {}) } }) };
}
// Dejar escrito qué se resolvió sobre una discrepancia, un cierre que no cupo o
// una baja. No mueve existencias ni dinero: es la explicación, con nombre.
export function resolver({ evId, texto, quien, cuando, fecha, azar }) {
  if (quien?.rol !== "admin") return { ok: false, dice: "Esto lo revisa un administrador." };
  if (!evId) return { ok: false, dice: "Falta decir qué se está revisando." };
  if (!String(texto || "").trim()) return { ok: false, dice: "Falta escribir qué se revisó y qué se decidió." };
  return { ok: true, evento: nuevoEvento({ tipo: T.resolucion, cuando, fecha, quien, azar, origen: evId, relacion: "resuelve", datos: { texto: String(texto).trim() } }) };
}

// ── Lo entregado que sigue fuera, con sus plazos ───────────────────────────
// hoy · se revisa al cierre del día        aviso · pasó el primer plazo
// escalado · pasó el segundo               en_uso · alguien dijo "sigue con él" hasta tal fecha
export function porCerrar(estado, { hoy, ahora, plazos = PLAZOS }) {
  const P = { ...PLAZOS, ...plazos }; const t = new Date(ahora || `${hoy}T23:59:00-06:00`).getTime();
  const dias = (f) => Math.round((new Date(hoy + "T12:00:00Z") - new Date(f + "T12:00:00Z")) / 86400000);
  const abiertos = loQueTrae(estado).map(l => {
    const horas = (t - new Date(l.desde).getTime()) / 3600000;
    const [aviso, escala] = l.largo ? [P.aviso_largo_d * 24, P.escala_largo_d * 24] : [P.aviso_h, P.escala_h];
    const enUso = !!l.proxima && l.proxima > hoy;                     // se dijo cuándo volver a preguntar, y todavía no llega
    const vencida = !!l.proxima && l.proxima <= hoy && l.revisado !== hoy;
    const nivel = enUso ? "en_uso" : horas >= escala ? "escalado" : horas >= aviso || vencida ? "aviso" : "hoy";
    return { ...l, dias: dias(l.fecha), horas: Math.floor(horas), revisadoHoy: l.revisado === hoy, nivel, vencida };
  });
  const orden = { escalado: 0, aviso: 1, hoy: 2, en_uso: 3 };
  const pendientes = abiertos.filter(l => !l.revisadoHoy && l.nivel !== "en_uso").sort((a, b) => orden[a.nivel] - orden[b.nivel] || b.horas - a.horas);
  return { abiertos, pendientes, yaRevisados: abiertos.filter(l => l.revisadoHoy || l.nivel === "en_uso"), deOtrosDias: pendientes.filter(l => l.dias > 0).length,
    avisos: abiertos.filter(l => l.nivel === "aviso"), escalados: abiertos.filter(l => l.nivel === "escalado"), herramientas: abiertos.filter(l => l.herramienta) };
}
// A quién le toca enterarse: al que lo trae y al encargado desde el primer
// plazo; al administrador cuando se pasa el segundo.
export function avisosPara(pendientes, persona) {
  const mios = pendientes.abiertos.filter(l => l.recibe.id && l.recibe.id === persona?.id);
  if (persona?.rol === "admin") return { mios, lista: pendientes.escalados, nivel: "escalado" };
  if (persona?.rol === "encargado") return { mios, lista: [...pendientes.escalados, ...pendientes.avisos], nivel: "aviso" };
  return { mios, lista: mios.filter(l => l.nivel === "aviso" || l.nivel === "escalado"), nivel: "aviso" };
}

// ── Lo que alguien tiene que ver: discrepancias y conflictos, sin resolver ──
export function porRevisar(estado) {
  const lista = [
    ...estado.discrepancias.map(d => ({ ...d, dice: `Salieron ${d.salieron} ${d.unidad} de ${d.articulo} de ${d.lugar} y sólo había ${r3(d.habia)}: faltaban ${d.faltaban}. O entró algo que nadie capturó, o salió más de lo anotado.` })),
    ...estado.huerfanos.map(h => ({ ...h, dice: h.clase === "de_mas" ? `Se quiso cerrar ${h.pedia} ${h.unidad} de ${h.articulo} y sólo quedaban ${h.cupo}: dos personas cerraron la misma entrega. Sólo cuenta lo que cabía.` : "Hay un cierre de una entrega que se canceló o que todavía no llega a este aparato. No cuenta." })),
    ...estado.conteosDistintos.map(c => ({ ...c, dice: `Dos conteos del mismo día en ${c.lugar} no dicen lo mismo (${c.dicen.map(x => `${x.contado} por ${x.quien}`).join("; ")}). Vale el último.` })),
    ...estado.ajustes.filter(a => a.cambio).map(a => ({ ...a, clase: "conteo_cambio", dice: `En el conteo de ${a.articulo} (${a.lugar}) se vio una diferencia de ${a.cambio.vista} y, con movimientos que llegaron después de otro aparato, quedó en ${a.diferencia}. La causa que se puso era para la primera.` })),
  ];
  return { pendientes: lista.filter(x => !x.resuelta), resueltas: lista.filter(x => x.resuelta), empalmes: estado.empalmes, negativos: estado.negativos, relojes: estado.relojes || [], conteosSinHora: estado.conteosSinHora || [] };
}

// ── El costo, una sola vez ─────────────────────────────────────────────────
// Lo consumido desde una actividad NO trae costo aquí: su costo ya va en la
// actividad. Aquí cuenta lo cerrado en una entrega y lo usado directo.
export function costoDeConsumos(estado, { desde, hasta } = {}) {
  const lista = estado.consumos.filter(c => (!desde || c.fecha >= desde) && (!hasta || c.fecha <= hasta));
  const propios = lista.filter(c => !c.enActividad); const con = propios.filter(c => c.costo != null);
  const de = (tipo) => sumarDinero(con.filter(c => c.destino?.tipo === tipo).map(c => c.costo));
  return { consumos: lista, total: sumarDinero(con.map(c => c.costo)), aParcelas: de("parcela"), aVehiculos: de("vehiculo"), general: de("general"), sinCosto: propios.filter(c => c.costo == null && c.cantidad > 0) };
}
// ── Lo que cambió DESPUÉS: una compra anterior que se capturó tarde ────────
// El consumo se queda con el costo con que se capturó: ése es el original y no
// se altera. Si hoy, con una compra que llegó después, ese mismo consumo
// valdría otra cosa, la diferencia sale AQUÍ, con su causa, como un ajuste
// aparte. Nunca se mezcla con el original ni se aplica a escondidas.
export function ajustesDeValuacion(estado, { desde, hasta } = {}) {
  const lista = [];
  for (const c of estado.consumos) {
    if ((desde && c.fecha < desde) || (hasta && c.fecha > hasta) || !(c.cantidad > 0) || c.promedioEntonces == null) continue;
    const original = c.costoVisto != null ? multiplicarDinero(c.costoVisto, c.cantidad) : null, recalculado = multiplicarDinero(c.promedioEntonces, c.cantidad);
    if (original != null && Math.abs(recalculado - original) < 0.01) continue;
    const tardias = estado.compras.filter(k => k.articuloId === c.articuloId && k.t <= c.t && k.capturado > c.capturado);
    lista.push({ ev: c.ev, articuloId: c.articuloId, articulo: c.articulo, unidad: c.unidad, cantidad: c.cantidad, fecha: c.fecha, destino: c.destino, enActividad: c.enActividad, actividadId: c.actividadId,
      original, recalculado, diferencia: Math.round((recalculado - (original || 0)) * 100) / 100, compras: tardias.map(k => k.ev),
      porque: original == null ? "Cuando se capturó, el artículo no tenía costo. Ahora ya se sabe cuánto costaba." : tardias.length ? `Después se capturó una compra del ${tardias[tardias.length - 1].fecha}, anterior a este consumo, que cambia lo que costaba ese día.` : "Se capturó con un costo distinto al que tenía el artículo ese día (se registró después, o se corrigió el costo)." });
  }
  return { lista, total: sumarDinero(lista.map(a => a.diferencia)) };
}

// Para los reportes de costo por parcela que ya existían. Lo de vehículos y lo general NO va aquí.
export function actividadesDeAlmacen(consumos) {
  return consumos.filter(c => !c.enActividad && c.destino?.tipo === "parcela" && c.destino.id && c.costo != null && c.cantidad > 0).map(c => ({
    id: `alm:${c.ev}`, _deEventos: c.evs, fecha: c.fecha, parcelaId: c.destino.id, tipo: c.destino.actividad || "Insumos",
    registradoPor: { tipo: "almacen", id: "almacen", nombre: c.quien }, insumos: [{ id: c.articuloId, nombre: c.articulo, cantidad: c.cantidad, unidad: c.unidad, costo: c.costo }],
    costoInsumos: c.costo, costoMO: 0, costoMaq: 0, costoTotal: c.costo,
  }));
}
// Las mermas y ajustes, valuados. "No se sabe" va aparte: es la que hay que bajar.
export function resumenDeAjustes(estado, inventario, { desde, hasta } = {}) {
  const costo = new Map((inventario || []).map(a => [a.id, Number(a.costo_unit) || 0]));
  const lista = estado.ajustes.filter(a => a.causa !== "inicial" && (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta)).map(a => ({ ...a, valor: multiplicarDinero(costo.get(a.articuloId) || 0, Math.abs(a.diferencia)) }));
  const porCausa = {}; for (const a of lista.filter(x => x.diferencia < 0)) porCausa[a.causa] = sumarDinero(porCausa[a.causa] || 0, a.valor);
  return { lista, porCausa, faltante: sumarDinero(Object.values(porCausa)), sinSaber: sumarDinero(porCausa.no_se_sabe || 0, porCausa["no se sabe"] || 0), sobrantes: lista.filter(x => x.diferencia > 0) };
}
// Las salidas, en la forma que ya entendía el aviso de "cuándo se acaba".
export function salidasParaPrediccion(estado) {
  return [...estado.consumos.filter(c => !c.lote && c.cantidad > 0).map(c => ({ id: `ev:${c.ev}`, insumoId: c.articuloId, cantidad: -c.cantidad, fecha: c.fecha, esVale: true })),
    ...estado.lotes.filter(l => !l.herramienta && l.raiz === l.id).map(l => ({ id: `ev:${l.id}`, insumoId: l.articuloId, cantidad: -r3(l.cantidad - l.devuelto), fecha: l.fecha, esVale: true })).filter(m => m.cantidad < 0)];
}

// ── El puente con las pantallas de siempre ─────────────────────────────────
// El catálogo guarda en `existencia` sólo el punto de partida, y NADIE lo
// vuelve a escribir. Todas las pantallas ven la existencia calculada.
export function conExistenciaReal(inventario, estado) {
  return (inventario || []).map(a => {
    const x = existenciasDe(a, estado); const movido = r3(x.lugares[NAVE] - (Number(a.existencia) || 0));
    const otros = Object.fromEntries(Object.entries(x.lugares).filter(([l]) => l !== NAVE));
    const p = estado.promedios?.get(a.id); const costoCambio = p != null && p !== (Number(a.costo_unit) || 0);
    if (movido === 0 && x.conAlguien === 0 && Object.keys(otros).length === 0 && !costoCambio) return a;
    return { ...a, existencia: x.lugares[NAVE], ...(costoCambio ? { costo_unit: p, _costoBase: Number(a.costo_unit) || 0 } : {}), _movido: movido, _conAlguien: x.conAlguien, _otrosLugares: otros };
  });
}
// Al guardar un artículo desde cualquier pantalla, la existencia que queda es
// la que ya estaba guardada: el catálogo no es por donde se mueve el inventario.
export function paraGuardarArticulo(a, guardado) {
  if (!a) return a;
  const { _movido, _conAlguien, _otrosLugares, _costoBase, ...resto } = a;
  // Ni la existencia ni el costo se guardan desde aquí: los dos se calculan de los movimientos.
  if (guardado) return { ...resto, existencia: Number(guardado.existencia) || 0, costo_unit: guardado.costo_unit ?? 0 };
  const base = _movido == null ? resto : { ...resto, existencia: r3((Number(resto.existencia) || 0) - _movido) };
  return _costoBase == null ? base : { ...base, costo_unit: _costoBase };
}

reglasDe(T.entrada, (e) => [{ clase: "entra_al_almacen", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, lugar: e.datos.lugar || NAVE }]);
reglasDe(T.retiro, (e) => [{ clase: "sale_del_almacen", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, lugar: e.datos.de || NAVE }, { clase: "queda_con", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, responsable: e.datos.recibe.nombre }]);
reglasDe(T.consumo, (e) => [{ clase: "consumo", cantidad: e.datos.cantidad, destino: e.datos.destino || null, monto: e.datos.costoUnit ? multiplicarDinero(e.datos.costoUnit, e.datos.cantidad) : null }]);
reglasDe(T.devolucion, (e) => [{ clase: "regresa_al_almacen", cantidad: e.datos.cantidad, lugar: e.datos.a || NAVE }]);
reglasDe(T.traspaso, (e) => [{ clase: "queda_con", cantidad: e.datos.cantidad, responsable: e.datos.recibe.nombre }]);
reglasDe(T.transferencia, (e) => [{ clase: "cambia_de_lugar", articuloId: e.datos.articuloId, cantidad: e.datos.cantidad, de: e.datos.de, a: e.datos.a }]);
reglasDe(T.merma, (e) => [{ clase: "merma", articuloId: e.datos.articuloId, delta: e.datos.delta, causa: e.datos.causa }]);
reglasDe(T.conteo, (e) => [{ clase: "conteo", articuloId: e.datos.articuloId, lugar: e.datos.lugar || NAVE, contado: e.datos.contado }]);
reglasDe(T.baja, (e) => [{ clase: "baja", cantidad: e.datos.cantidad, causa: e.datos.causa }]);
reglasDe(T.costo, (e) => [{ clase: "costo_fijado", articuloId: e.datos.articuloId, costoUnit: e.datos.costoUnit }]);
reglasDe(T.revision, () => []);
reglasDe(T.resolucion, () => []);
