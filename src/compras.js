// ════════════════════════════════════════════════════════════════════════
//  COMPRAS QUE HACE EL PERSONAL — una compra, un solo camino
//
//  El trabajador registra lo que compró y entrega su comprobante, aunque no
//  sepa el precio de cada cosa. De ahí en adelante la compra pasa por TRES
//  manos, y cada una hace una sola cosa:
//    1. se APRUEBA el gasto (que el dinero sí se gastó en eso)         → `compras`
//    2. se RECIBE lo que es para el almacén (que llegó, y cuánto)      → `alm_entrada` con `ref` a la compra
//    3. se VALÚA (cuánto costó cada cosa)                              → al recibir, o después con `alm_valuacion`
//  Mientras falte el precio, esa mercancía está PENDIENTE DE VALORACIÓN: está
//  en el estante, se puede usar, y no cuesta cero — todavía no se sabe.
//
//  El dinero de la compra cuenta UNA vez:
//    · en el flujo, completo, el día de la compra (ahí salió el dinero);
//    · en los resultados, sólo lo que NO es mercancía del almacén (un flete,
//      una refacción que se puso directo): la mercancía es inventario y se
//      vuelve costo cuando se consume;
//    · mientras no esté toda recibida y valuada no se sabe cuánto es de cada
//      cosa: el total queda como «por valuar», ni gasto ni inventario.
//  La entrada al almacén que nace de la compra NO es otra compra ni otro gasto.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, vivos } from "./calculos.js";

const n = (x) => Number(x) || 0;
export const esParaAlmacen = (compra) => !!compra?.afectaInventario && (compra.items || []).some(i => i.insumoId);

// En qué va una compra. `recibidas` = `estadoDelAlmacen(...).recibidas`.
export function estadoDeCompra(compra, recibidas = []) {
  const monto = n(compra.monto), mias = recibidas.filter(r => r.compraId === compra.id);
  if (compra.estado !== "aprobada") return { estado: compra.estado || "pendiente", paraAlmacen: esParaAlmacen(compra), partidas: [], gasto: null, inventario: 0, porValuar: 0, avisos: [] };
  if (!esParaAlmacen(compra)) return { estado: "gasto", paraAlmacen: false, partidas: [], gasto: monto, inventario: 0, porValuar: 0, avisos: [] };
  const partidas = (compra.items || []).map((it, i) => ({ i, ...it })).filter(it => it.insumoId).map(it => {
    const r = mias.find(x => x.i === it.i);
    return { i: it.i, insumoId: it.insumoId, nombre: it.nombre, unidad: it.unidad || "", pedida: n(it.cantidad), recibida: r ? r.cantidad : null, costoUnit: r?.costoUnit ?? null, valor: r?.valor ?? null, ev: r?.ev || null, recibio: r?.recibio || "", fecha: r?.fecha || "",
      difiere: r ? r.cantidad !== n(it.cantidad) : false };
  });
  const sinRecibir = partidas.filter(p => p.recibida == null).length, sinValuar = partidas.filter(p => p.recibida != null && p.valor == null).length;
  const inventario = sumarDinero(partidas.map(p => p.valor || 0)), avisos = [];
  const completo = sinRecibir === 0 && sinValuar === 0;
  if (completo && inventario > monto + 0.004) avisos.push(`Lo valuado (${inventario}) es más que el total del comprobante (${monto}). Revisa los precios: la diferencia no salió de esta compra.`);
  for (const p of partidas.filter(p => p.difiere)) avisos.push(`De ${p.nombre} se anotaron ${p.pedida} y llegaron ${p.recibida}.`);
  return { estado: sinRecibir ? "por_recibir" : sinValuar ? "por_valuar" : "completa", paraAlmacen: true, partidas, sinRecibir, sinValuar, inventario,
    // Lo que del comprobante no es mercancía (un flete, algo que no entra al almacén): gasto. Sólo se sabe con todo valuado.
    gasto: completo ? Math.max(0, sumarDinero(monto, -inventario)) : null,
    porValuar: completo ? 0 : sumarDinero(monto, -inventario), avisos };
}

// Todas las compras aprobadas, partidas en lo que cada una es. `enRango(fecha)` opcional.
export function repartoDeCompras(compras = [], recibidas = [], enRango = () => true) {
  const lista = compras.filter(c => c.estado === "aprobada" && enRango(c.fecha)).map(c => ({ compra: c, ...estadoDeCompra(c, recibidas) }));
  return { lista, pagado: sumarDinero(lista.map(x => n(x.compra.monto))), gasto: sumarDinero(lista.map(x => x.gasto || 0)), inventario: sumarDinero(lista.map(x => x.inventario)), porValuar: sumarDinero(lista.map(x => x.porValuar)),
    porRecibir: lista.filter(x => x.estado === "por_recibir"), sinValuar: lista.filter(x => x.estado === "por_valuar") };
}

// ¿Esto ya está capturado por otro lado? Mismo importe y fecha cercana (3 días): no bloquea, pregunta.
// `que`: { fecha, monto, id? }   `donde`: { compras, egresos, entradas_inv }
export function posibleDuplicado(que, { compras = [], egresos = [], entradas_inv = [] } = {}) {
  const m = n(que.monto); if (!(m > 0) || !que.fecha) return [];
  const cerca = (f) => f && Math.abs((new Date(`${f}T12:00:00Z`) - new Date(`${que.fecha}T12:00:00Z`)) / 86400000) <= 3;
  const igual = (x) => Math.abs(n(x) - m) < 0.005;
  return [
    ...compras.filter(c => c.id !== que.id && c.estado !== "rechazada" && igual(c.monto) && cerca(c.fecha)).map(c => ({ donde: "compra del personal", id: c.id, fecha: c.fecha, que: c.descripcion || "", monto: n(c.monto) })),
    ...vivos(egresos).filter(e => e.id !== que.id && igual(e.monto) && cerca(e.fecha)).map(e => ({ donde: "gasto capturado", id: e.id, fecha: e.fecha, que: e.concepto || "", monto: n(e.monto) })),
    ...entradas_inv.filter(e => e.id !== que.id && igual(e.costo_total) && cerca(e.fecha)).map(e => ({ donde: "entrada del almacén", id: e.id, fecha: e.fecha, que: e.concepto || e.nombre || "", monto: n(e.costo_total) })),
  ];
}
