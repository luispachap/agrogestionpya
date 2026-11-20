// ════════════════════════════════════════════════════════════════════════
//  EL RESULTADO Y EL FLUJO — dos preguntas distintas, una sola cuenta cada una
//
//  Antes cada pantalla sumaba por su lado: el inicio usaba la mano de obra ya
//  depurada y Finanzas la tecleada, así que la «utilidad» no era la misma en
//  las dos; y ninguna contaba lo que se le paga a la gente sin que sea trabajo
//  en una parcela (permisos, el día de un encargado, prestaciones, bajas, el
//  rato del operador). Y el «flujo de efectivo» contaba la mano de obra el día
//  que se trabajó, no el día que se pagó, y no veía préstamos ni pagos.
//
//    RESULTADO (lo que se ganó o se perdió): los costos cuentan cuando se
//      causan. La mano de obra, el día que se trabajó.
//    FLUJO (lo que entró y salió de dinero): cuenta cuando se paga. La mano
//      de obra, el día que se registró el pago. Un préstamo entregado es
//      dinero que salió y no es gasto; un abono en efectivo, dinero que entró.
//
//  Las dos se calculan aquí y todas las pantallas leen de aquí.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, vivos } from "./calculos.js";
import { costoAFinanzas } from "./almacen.js";
import { vigentes } from "./eventos.js";

const S = (l) => sumarDinero(l);
const n = (x) => Number(x) || 0;

//   actividades   las que cuentan (`actividadesContables`): ya sin lo capturado dos veces
//   indirectos    lo de `juntarFuentes`
//   partesMO      `manoDeObraEventos.partes` (para el rato del operador en un vehículo)
export function resultadoDelRancho({ ingresos = [], egresos = [], compras = [], entradas_inv = [], actividades = [], indirectos = null, partesMO = [] }) {
  const deFuente = (f) => !indirectos ? 0 : sumarDinero(S((indirectos.partes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.pendientes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.noProduccion || []).filter(p => p.fuente === f).map(p => p.monto)));
  const lineas = [
    { clave: "mo", nombre: "Mano de obra en parcelas y bodega", monto: S(actividades.map(a => n(a.costoMO))) },
    { clave: "personal", nombre: "Personal: pagado sin actividad en parcela", monto: deFuente("personal"), nota: "permisos, descansos, esperas, días de encargados" },
    { clave: "operador", nombre: "Personal: tiempo de operadores en vehículos", monto: S(partesMO.filter(p => p.vehiculoId).map(p => n(p.monto))) },
    { clave: "prestaciones", nombre: "Prestaciones que se generaron", monto: deFuente("prestaciones"), nota: "aguinaldo, vacaciones y prima; cuentan cuando se ganan, no cuando se pagan" },
    { clave: "bajas", nombre: "Bajas: prima de antigüedad e indemnizaciones", monto: deFuente("bajas") },
    { clave: "maq", nombre: "Maquinaria (costo por hora de las actividades)", monto: S(actividades.map(a => n(a.costoMaq))) },
    { clave: "almacen", nombre: "Compras para el almacén", monto: S(entradas_inv.map(costoAFinanzas)) },
    { clave: "compras", nombre: "Compras hechas por el personal", monto: S(compras.filter(c => c.estado === "aprobada").map(c => n(c.monto))) },
    { clave: "gastos", nombre: "Otros gastos capturados", monto: S(vivos(egresos).map(e => n(e.monto))) },
  ];
  const totalIngresos = S(vivos(ingresos).map(g => n(g.monto))), totalEgresos = S(lineas.map(l => l.monto));
  return { ingresos: totalIngresos, lineas, egresos: totalEgresos, utilidad: sumarDinero(totalIngresos, -totalEgresos) };
}

// Lo que entró y salió de dinero, mes por mes.
//   eventos    todos (de aquí salen los pagos al personal, de prestaciones y de bajas, las entregas de préstamos y los abonos)
//   prestamos  los de la tabla de antes (los que nacen de eventos ya vienen por su entrega y se ignoran aquí)
export function flujoDeEfectivo({ ingresos = [], egresos = [], compras = [], entradas_inv = [], creditos = [], eventos = [], prestamos = [], hoy = "" }) {
  const meses = new Map();
  const reg = (fecha, lado, clase, monto) => {
    if (!(monto > 0)) return;
    const k = (fecha || hoy || "").slice(0, 7); if (!k) return;
    if (!meses.has(k)) meses.set(k, { mes: k, ingresos: 0, egresos: 0, detalle: {} });
    const m = meses.get(k); m[lado] = sumarDinero(m[lado], monto); m.detalle[clase] = sumarDinero(m.detalle[clase] || 0, monto);
  };
  for (const g of vivos(ingresos)) reg(g.fecha, "ingresos", "ventas", n(g.monto));
  for (const e of vivos(egresos)) reg(e.fecha, "egresos", "gastos", n(e.monto));
  for (const c of compras) if (c.estado === "aprobada") reg(c.fecha, "egresos", "compras", n(c.monto));
  for (const e of entradas_inv) reg(e.fecha, "egresos", "almacen", costoAFinanzas(e));
  for (const cr of vivos(creditos)) {
    if (cr.formaPago === "dinero") reg(cr.fecha, "ingresos", "creditos", n(cr.monto));
    for (const ab of cr.abonos || []) if (ab.tipo === "dinero") reg(ab.fecha, "egresos", "abonos_creditos", n(ab.monto));
  }
  for (const e of vigentes(eventos)) {
    const m = n(e.datos?.monto);
    if (e.tipo === "pago_personal") reg(e.fecha, "egresos", "pagos_personal", m);
    else if (e.tipo === "pago_prestacion") reg(e.fecha, "egresos", "pagos_prestaciones", m);
    else if (e.tipo === "pago_baja") reg(e.fecha, "egresos", "pagos_bajas", m);
    else if (e.tipo === "prestamo_entrega") reg(e.fecha, "egresos", "prestamos_entregados", m);
    // Un abono que sale de lo que ganó en la semana no es dinero que entra: ya se le entregó de menos. Sólo el abono aparte.
    else if (e.tipo === "abono_prestamo" && !e.datos?.semana) reg(e.fecha, "ingresos", "abonos_prestamos", m);
  }
  for (const p of vivos(prestamos)) if (!p._deEventos) reg(p.fecha, "egresos", "prestamos_entregados", n(p.monto));
  const lista = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  let acumulado = 0;
  for (const m of lista) { m.neto = sumarDinero(m.ingresos, -m.egresos); acumulado = sumarDinero(acumulado, m.neto); m.acumulado = acumulado; }
  return { meses: lista, ingresos: S(lista.map(m => m.ingresos)), egresos: S(lista.map(m => m.egresos)), neto: acumulado };
}
export const NOMBRE_DE_FLUJO = { ventas: "ingresos capturados", creditos: "créditos recibidos", abonos_prestamos: "abonos de préstamos al personal", gastos: "gastos capturados", compras: "compras del personal", almacen: "compras para el almacén",
  abonos_creditos: "abonos a créditos", pagos_personal: "pagos al personal", pagos_prestaciones: "pagos de prestaciones", pagos_bajas: "pagos de bajas", prestamos_entregados: "préstamos entregados al personal" };
