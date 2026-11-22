// ════════════════════════════════════════════════════════════════════════
//  RESULTADO, INVENTARIO Y FLUJO — tres preguntas distintas
//
//    RESULTADO   ¿se ganó o se perdió? Los costos cuentan cuando se CAUSAN:
//                la mano de obra el día que se trabajó; el insumo el día que
//                se CONSUMIÓ (no el día que se compró); la maquinaria por lo
//                que de verdad costó, una sola vez.
//    INVENTARIO  ¿qué hay en el almacén y cuánto vale? Comprar no es gastar:
//                es cambiar dinero por mercancía. Lo que se compró y no se ha
//                usado está aquí, no en los costos.
//    FLUJO       ¿qué dinero entró y salió? Cuenta cuando se PAGA: la compra
//                el día que se hizo, la gente el día que se le entregó.
//
//  Reglas que evitan contar dos veces:
//   · Insumos: al resultado entra lo consumido (`costoInsumos` de las
//     actividades, que ya incluye lo que salió del almacén a una parcela),
//     el uso general del rancho, las mermas, y los AJUSTES DE VALUACIÓN
//     (lo que cambió después, aparte y con su causa). Las compras NO.
//   · Maquinaria: la cuota por hora que ya traen las actividades (costo
//     APLICADO) más lo que entra por la fuente de vehículos, que para una
//     máquina con cuota es sólo la DIFERENCIA contra su costo real, y para
//     las demás su costo real completo. Nunca cuota + real.
//     Por eso aquí NO se suman aparte el operador, el diésel ni el taller de
//     un vehículo: ya vienen dentro de esa fuente.
//   · Compras del personal: lo que es mercancía es inventario; sólo lo que no
//     lo es (un flete) es gasto, y mientras no esté valuada no es ninguno.
//   · Personal: lo otorgado/causado es costo; pagar nunca lo es.
//
//  Todas las pantallas leen de aquí.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, vivos } from "./calculos.js";
import { costoAFinanzas } from "./almacen.js";
import { vigentes } from "./eventos.js";
import { salidasDeCajaAlFlujo } from "./caja.js";

const S = (l) => sumarDinero(l);
const n = (x) => Number(x) || 0;
// UN GASTO DE «INSUMOS» NO ES SIEMPRE UNA COMPRA PARA EL ALMACÉN. Puede ser cuatro cosas, y cada una se cuenta distinto:
//   inventario   entró al almacén: no es gasto todavía, se vuelve costo cuando se consume
//   produccion   se usó directo en producción (nunca pasó por el almacén): es costo ya
//   general      se usó en el rancho en general: gasto general
//   otro         no era un insumo: gasto, como cualquier otro
// Y si nadie lo ha dicho, está POR CLASIFICAR: no se supone que entró al almacén. No se cuenta como gasto ni como
// inventario hasta que una persona lo diga (el dinero sí salió: en el flujo va completo).
export const DESTINOS_DE_INSUMO = { inventario: "Entró al almacén (se cuenta cuando se use)", produccion: "Se usó directo en producción", general: "Uso general del rancho", otro: "No es un insumo: es otro gasto" };
export function claseDeInsumo(e) {
  if (!e || e.categoria !== "insumos") return null;
  if (e.vehiculoId) return "vehiculo";                       // va en la cuenta de ese vehículo
  if (DESTINOS_DE_INSUMO[e.destinoInsumo]) return e.destinoInsumo;
  if (e.parcelaId) return "produccion";                      // se dijo para qué parcela fue
  if (e.solicitudId || e.entradaInvId) return "inventario";  // nació junto con su entrada al almacén
  return "por_clasificar";
}
export const esCompraDeAlmacen = (e) => claseDeInsumo(e) === "inventario";
// LA MISMA COMPRA NO SALE DOS VECES DEL FLUJO. Una entrada con costo capturada en Inventario cuenta, ella sola, como
// dinero que salió. Si esa compra además está como gasto de insumos (pagada de la caja chica o capturada en Finanzas),
// el mismo dinero salía dos veces y «lo comprado para el almacén» se inflaba. No se adivina: se PROPONE el gasto que
// coincide (mismo importe, a tres días o menos, que no sea ya de otra entrada) y una persona dice «es la misma».
// Dos compras distintas del mismo importe también coinciden: por eso no se liga solo.
const diasDe = (a, b) => Math.abs((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 86400000);
export function gastosDeLaMismaCompra(entrada, { egresos = [], entradas_inv = [] } = {}) {
  const m = costoAFinanzas(entrada); if (!(m > 0) || !entrada?.fecha) return [];
  const tomados = new Set(entradas_inv.filter(x => x && x.egresoId && x.id !== entrada.id).map(x => x.egresoId));
  return vivos(egresos).filter(e => ["inventario", "por_clasificar"].includes(claseDeInsumo(e)) && !e.solicitudId && !e.entradaInvId && !tomados.has(e.id)
    && Math.abs(n(e.monto) - m) < 0.005 && e.fecha && diasDe(e.fecha, entrada.fecha) <= 3);
}
// Decir «es la misma»: la entrada deja de contar como dinero aparte (cuenta el gasto) y el gasto queda como compra de
// almacén, apuntándose uno al otro. Devuelve los dos registros como hay que guardarlos; no toca existencias ni costos.
export function ligarEntradaAGasto(entrada, egreso, quien = {}, fecha = "") {
  if (!entrada?.id || !egreso?.id) return { ok: false, dice: "Falta la entrada o el gasto." };
  if (entrada.yaEsEgreso) return { ok: false, dice: "Esa entrada ya está ligada a un gasto." };
  const por = { id: quien.id || "", nombre: quien.nombre || "", fecha };
  return { ok: true, entrada: { ...entrada, yaEsEgreso: true, egresoId: egreso.id, ligadoPor: por },
    egreso: { ...egreso, destinoInsumo: "inventario", entradaInvId: entrada.id } };
}
// Las entradas que todavía tienen un gasto con el que podrían ser la misma compra (para avisar donde se lee el dinero).
export const comprasQuizaDobles = ({ egresos = [], entradas_inv = [] } = {}) => entradas_inv.filter(e => gastosDeLaMismaCompra(e, { egresos, entradas_inv }).length > 0);
export const insumosPorClasificar = (egresos = []) => vivos(egresos).filter(e => claseDeInsumo(e) === "por_clasificar");

//   actividades   las que cuentan (`actividadesContables`)
//   indirectos    lo de `juntarFuentes`
//   compras       lo de `repartoDeCompras` (compras.js)
//   almacen       { consumoGeneral, ajustesValuacion (parcelas), ajustesGenerales, mermas, valor, sinValor } — ya en dinero
export function resultadoDelRancho({ ingresos = [], egresos = [], entradas_inv = [], actividades = [], indirectos = null, compras = null, almacen = {} }) {
  const deFuente = (f) => !indirectos ? 0 : sumarDinero(S((indirectos.partes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.pendientes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.noProduccion || []).filter(p => p.fuente === f).map(p => p.monto)));
  const clase = (e) => claseDeInsumo(e);
  const gastos = vivos(egresos).filter(e => !e.vehiculoId && !["inventario", "por_clasificar"].includes(clase(e)) && !(clase(e) === "produccion" && !e.parcelaId));
  const directos = vivos(egresos).filter(e => clase(e) === "produccion" && !e.parcelaId), sinClase = insumosPorClasificar(egresos);
  const produccion = [
    { clave: "mo", nombre: "Mano de obra en parcelas y bodega", monto: S(actividades.map(a => n(a.costoMO))) },
    { clave: "insumos", nombre: "Insumos consumidos", monto: S(actividades.map(a => n(a.costoInsumos))), nota: "cuentan cuando se usan, no cuando se compran" },
    // Un gasto capturado CON parcela es costo de esa parcela: antes salía revuelto con los gastos generales.
    { clave: "gastos_parcela", nombre: "Gastos capturados a una parcela", monto: S(gastos.filter(e => e.parcelaId).map(e => n(e.monto))), nota: "refacciones, servicios, insumos de una aplicación: lo que se capturó diciendo para qué parcela fue" },
    { clave: "insumos_directos", nombre: "Insumos comprados y usados directo en producción", monto: S(directos.map(e => n(e.monto))), nota: "no pasaron por el almacén y no dicen parcela" },
    { clave: "ajustes_insumos", nombre: "Ajustes de valuación de insumos", monto: n(almacen.ajustesValuacion), nota: "consumos en parcelas cuyo costo se supo o cambió después; el original no se toca. Los de un vehículo van en la cuenta de ese vehículo" },
    { clave: "maq_cuota", nombre: "Maquinaria: aplicado por cuota por hora", monto: S(actividades.map(a => n(a.costoMaq))) },
    { clave: "vehiculos", nombre: "Maquinaria y vehículos: costo real fuera de la cuota", monto: deFuente("vehiculos"), nota: "operador, combustible, mantenimiento y depreciación; de las máquinas con cuota, sólo la diferencia" },
    { clave: "personal", nombre: "Personal: pagado sin actividad en parcela", monto: deFuente("personal"), nota: "permisos, descansos, esperas, días de encargados" },
    { clave: "prestaciones", nombre: "Prestaciones que se generaron", monto: deFuente("prestaciones"), nota: "aguinaldo, vacaciones y prima; cuentan cuando se ganan" },
    { clave: "bonos", nombre: "Bonos e incentivos otorgados", monto: deFuente("bonos"), nota: "cuentan cuando se otorgan, no cuando se pagan" },
    { clave: "bajas", nombre: "Bajas: prima de antigüedad e indemnizaciones", monto: deFuente("bajas") },
  ];
  const generales = [
    { clave: "gastos", nombre: "Gastos generales capturados", monto: S(gastos.filter(e => !e.parcelaId).map(e => n(e.monto))), nota: "los que no dicen parcela; sin las compras para el almacén, los insumos por clasificar ni los gastos de vehículos" },
    { clave: "compras", nombre: "Compras del personal que no son mercancía", monto: n(compras?.gasto) },
    { clave: "consumo_general", nombre: "Insumos de uso general del rancho", monto: n(almacen.consumoGeneral) },
    { clave: "ajustes_generales", nombre: "Ajustes de valuación de insumos de uso general", monto: n(almacen.ajustesGenerales) },
    { clave: "mermas", nombre: "Mermas y faltantes del almacén", monto: n(almacen.mermas) },
  ];
  const lineas = [...produccion, ...generales];
  const totalIngresos = S(vivos(ingresos).map(g => n(g.monto))), totalEgresos = S(lineas.map(l => l.monto));
  // El inventario: no es gasto. Lo comprado para el almacén que todavía no se usa está aquí.
  const comprado = sumarDinero(S(vivos(egresos).filter(esCompraDeAlmacen).map(e => n(e.monto))), S(entradas_inv.map(costoAFinanzas)), n(compras?.inventario));
  const inventario = { valor: n(almacen.valor), sinValor: almacen.sinValor || [], comprado, porValuar: n(compras?.porValuar) };
  // Lo que nadie ha dicho qué fue: ni gasto ni inventario todavía. Va aparte, a la vista, para que alguien lo clasifique.
  const porClasificar = { monto: S(sinClase.map(e => n(e.monto))), n: sinClase.length };
  return { ingresos: totalIngresos, produccion, generales, lineas, costos: S(produccion.map(l => l.monto)), gastos: S(generales.map(l => l.monto)), egresos: totalEgresos, utilidad: sumarDinero(totalIngresos, -totalEgresos), inventario, porClasificar };
}

export const COBROS_SIN_DINERO = ["especie", "contra deuda"];
// Lo que entró y salió de dinero, mes por mes.
//   eventos    todos (pagos al personal, de prestaciones, de bajas y de bonos; entregas de préstamos; abonos)
//   prestamos  los de la tabla de antes (los que nacen de eventos ya vienen por su entrega y se ignoran aquí)
//   cajachica  los movimientos de caja chica. El fondo que entra y los traspasos NO son flujo del rancho (el dinero
//              sólo cambió de bolsa). Una salida se cuenta UNA vez: por su gasto ligado, por el pago o préstamo al que
//              está ligada, o —si no tiene ninguno— aquí, como «por clasificar» o «por ligar» (src/caja.js).
export function flujoDeEfectivo({ ingresos = [], egresos = [], compras = [], entradas_inv = [], creditos = [], eventos = [], prestamos = [], cajachica = [], hoy = "" }) {
  const meses = new Map();
  const reg = (fecha, lado, clase, monto) => {
    if (!(monto > 0)) return;
    const k = (fecha || hoy || "").slice(0, 7); if (!k) return;
    if (!meses.has(k)) meses.set(k, { mes: k, ingresos: 0, egresos: 0, detalle: {} });
    const m = meses.get(k); m[lado] = sumarDinero(m[lado], monto); m.detalle[clase] = sumarDinero(m.detalle[clase] || 0, monto);
  };
  // Una venta cobrada en especie, o a cuenta de una deuda que se tenía con ese cliente, es venta (va al resultado)
  // pero NO es dinero que entra: se cobró con mercancía o bajando una deuda. Contarla en el flujo lo inflaba.
  let sinDinero = 0;
  for (const g of vivos(ingresos)) {
    if (COBROS_SIN_DINERO.includes(g.metodo)) { sinDinero = sumarDinero(sinDinero, n(g.monto)); continue; }
    reg(g.fecha, "ingresos", "ventas", n(g.monto));
  }
  for (const e of vivos(egresos)) reg(e.fecha, "egresos", esCompraDeAlmacen(e) ? "almacen" : "gastos", n(e.monto));
  // La compra del personal sale completa el día que se hizo. Lo que de ella entra al almacén NO sale otra vez.
  for (const c of compras) if (c.estado === "aprobada") reg(c.fecha, "egresos", "compras", n(c.monto));
  for (const e of entradas_inv) reg(e.fecha, "egresos", "almacen", costoAFinanzas(e));
  for (const cr of vivos(creditos)) {
    if (cr.formaPago === "dinero") reg(cr.fecha, "ingresos", "creditos", n(cr.monto));
    // Un abono sin tipo es de dinero (así los guardaba la pantalla Deudas, y por eso no salían en el flujo). El que se
    // pagó en especie o con cosecha no es dinero que sale. Y el cancelado no cuenta.
    for (const ab of vivos(cr.abonos || [])) if ((ab.tipo || "dinero") === "dinero") reg(ab.fecha, "egresos", "abonos_creditos", n(ab.monto));
  }
  for (const e of vigentes(eventos)) {
    const m = n(e.datos?.monto);
    if (e.tipo === "pago_personal") reg(e.fecha, "egresos", "pagos_personal", m);
    else if (e.tipo === "pago_prestacion") reg(e.fecha, "egresos", "pagos_prestaciones", m);
    else if (e.tipo === "pago_baja") reg(e.fecha, "egresos", "pagos_bajas", m);
    else if (e.tipo === "pago_bono") reg(e.fecha, "egresos", "pagos_bonos", m);
    else if (e.tipo === "prestamo_entrega") reg(e.fecha, "egresos", "prestamos_entregados", m);
    // Un abono que sale de lo que ganó en la semana no es dinero que entra: ya se le entregó de menos. Sólo el abono aparte.
    else if (e.tipo === "abono_prestamo" && !e.datos?.semana) reg(e.fecha, "ingresos", "abonos_prestamos", m);
  }
  for (const p of vivos(prestamos)) if (!p._deEventos) reg(p.fecha, "egresos", "prestamos_entregados", n(p.monto));
  for (const c of salidasDeCajaAlFlujo(cajachica, { egresos, eventos })) reg(c.fecha, "egresos", c.clase, c.monto);
  const lista = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  let acumulado = 0;
  for (const m of lista) { m.neto = sumarDinero(m.ingresos, -m.egresos); acumulado = sumarDinero(acumulado, m.neto); m.acumulado = acumulado; }
  return { meses: lista, ingresos: S(lista.map(m => m.ingresos)), egresos: S(lista.map(m => m.egresos)), neto: acumulado, ventasSinDinero: sinDinero };
}
export const NOMBRE_DE_FLUJO = { ventas: "ingresos capturados", creditos: "créditos recibidos", abonos_prestamos: "abonos de préstamos al personal", gastos: "gastos capturados", compras: "compras del personal", almacen: "compras para el almacén",
  abonos_creditos: "abonos a créditos", pagos_personal: "pagos al personal", pagos_prestaciones: "pagos de prestaciones", pagos_bajas: "pagos de bajas", pagos_bonos: "pagos de bonos", prestamos_entregados: "préstamos entregados al personal",
  caja_por_clasificar: "salidas de caja chica por clasificar", caja_por_ligar: "salidas de caja chica por ligar a su préstamo o pago" };
