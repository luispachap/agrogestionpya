// ============================================================
//  AgroGestión — Leer el estado de cuenta del banco
//
//  Hoy la app NO SABE cuánto hay en el banco: ni saldos, ni movimientos, ni
//  cortes. Todo se captura a mano, a criterio de quien se acuerde, y nadie ha
//  comparado nunca la app contra el banco. Migue transfiere $180,000 el 12 de
//  marzo, lo captura el 18 con fecha del 18 y redondeado — el banco cobró
//  $180,032.
//
//  ─────────────────────────────────────────────────────────────
//  LA IDEA QUE SOSTIENE TODO: EL ESTADO DE CUENTA SE VALIDA SOLO
//  ─────────────────────────────────────────────────────────────
//  De dos formas:
//
//      saldo inicial + Σ abonos − Σ cargos = saldo final
//      saldo anterior + abono − cargo      = saldo del renglón
//
//  La segunda es la valiosa: la primera dice que ALGO está mal; la segunda
//  dice CUÁL RENGLÓN. Un error de lectura rompe la cadena exactamente donde
//  ocurrió.
//
//  **Por eso la lectura NUNCA se da por buena sin verificar.** Si no cuadra,
//  el estado se marca NO CONFIABLE y NO ENTRA. Es preferible pedir otro
//  archivo que conciliar contra cifras inventadas.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · NO se conecta al banco. NO pide claves ni token. NO guarda credenciales
//    de banca en línea de nadie. Se sube un archivo que un humano descargó.
//  · NO corrige el renglón que no cuadró. Lo señala y ahí se queda.
//  · NO clasifica el gasto: eso es otra pantalla y otra decisión.
//  · NO deja editar ni borrar un movimiento del banco. El banco es la verdad.
//  · NO concilia solo: propone con el criterio a la vista y espera un sí.
//
//  Se empieza por Excel/CSV, no por PDF: casi todos los bancos mexicanos lo
//  dan, `excelLoader` ya existe, y entra sin dependencias nuevas, sin backend
//  y funcionando en el celular. El PDF, después, y sólo para el banco que no
//  dé otra cosa.
//
//  Sus pruebas están en src/banco.test.js.
// ============================================================

import { aCentavos, aPesos, sumarDinero } from "./calculos.js";
import { normalizar, aNumero, aFecha } from "./lectura.js";

/* ════════════ LA CUENTA, ENMASCARADA ════════════ */

// Se conservan los últimos cuatro dígitos: bastan para identificarla y no
// sirven para nada más. El número completo no se guarda en ningún lado.
export function enmascararCuenta(cuenta) {
  const d = String(cuenta || "").replace(/\D/g, "");
  if (!d) return "";
  return "****" + d.slice(-4);
}

// Con qué se reconoce que es el MISMO estado de cuenta, para no cargarlo dos
// veces. Cargarlo doble duplicaría todos sus movimientos.
export const claveEstado = ({ banco, cuenta, periodo }) =>
  [normalizar(banco), enmascararCuenta(cuenta), String(periodo || "").trim()].join("|");

/* ════════════ ENCONTRAR LAS COLUMNAS ════════════ */

// Cada banco pone los encabezados a su manera. Se buscan por lo que dicen, no
// por su posición: la columna 3 de BBVA no es la columna 3 de Banorte.
const SINONIMOS = {
  fecha: ["FECHA", "FECHA DE OPERACION", "FECHA OPERACION", "F. OPERACION", "FECHA MOVIMIENTO"],
  concepto: ["CONCEPTO", "DESCRIPCION", "DESCRIPCIÓN", "REFERENCIA AMPLIA", "DETALLE", "MOVIMIENTO"],
  referencia: ["REFERENCIA", "REF", "FOLIO", "NO. REFERENCIA"],
  cargo: ["CARGO", "CARGOS", "RETIRO", "RETIROS", "DEBE", "DEBITO", "DÉBITO"],
  abono: ["ABONO", "ABONOS", "DEPOSITO", "DEPOSITOS", "DEPÓSITO", "DEPÓSITOS", "HABER", "CREDITO", "CRÉDITO"],
  saldo: ["SALDO", "SALDO OPERACION", "SALDO FINAL", "BALANCE"],
};

// Devuelve qué encabezado corresponde a cada campo, y CUÁLES no encontró.
// Sin fecha, sin saldo o sin al menos un movimiento no se puede validar nada,
// y eso se dice en vez de leer a medias.
export function detectarColumnas(encabezados) {
  const norm = (encabezados || []).map(h => normalizar(h));
  const mapa = {};
  const faltan = [];
  for (const [campo, nombres] of Object.entries(SINONIMOS)) {
    const i = norm.findIndex(h => h && nombres.some(n => h === n || h.startsWith(n)));
    if (i >= 0) mapa[campo] = i;
    else if (["fecha", "saldo"].includes(campo)) faltan.push(campo);
  }
  if (mapa.cargo === undefined && mapa.abono === undefined) faltan.push("cargo o abono");
  return {
    mapa, faltan,
    sirve: faltan.length === 0,
    porque: faltan.length === 0
      ? "Se reconocieron las columnas del archivo."
      : `Al archivo le faltan columnas que hacen falta para poder validarlo: ${faltan.join(", ")}. Pídele al banco el Excel o CSV con los movimientos completos.`,
  };
}

/* ════════════ LEER LOS MOVIMIENTOS ════════════ */

// Devuelve { movimientos, descartadas }.
//
// Lo de "descartadas" NO es un detalle: un renglón que se cae en silencio es
// dinero que desaparece del estado de cuenta sin que nadie se entere, y la
// validación aritmética ni siquiera lo nota si el saldo inicial se tomó del
// primer renglón que SÍ sobrevivió. Por eso todo lo que se salta se reporta
// con su razón, y un archivo con renglones descartados no es confiable.
export function leerMovimientos(filas, mapa) {
  const movs = [];
  const descartadas = [];
  for (const [n, f] of (filas || []).entries()) {
    const fecha = aFecha(f[mapa.fecha]);
    const saldo = aNumero(f[mapa.saldo]);
    // Un renglón sin fecha NI saldo suele ser un encabezado repetido o el pie
    // del archivo: ése sí se salta, y no cuenta como movimiento en cero.
    if (!fecha && saldo === null) continue;
    const cargo = mapa.cargo !== undefined ? (aNumero(f[mapa.cargo]) || 0) : 0;
    const abono = mapa.abono !== undefined ? (aNumero(f[mapa.abono]) || 0) : 0;
    if (!fecha) {
      // Trae saldo pero no se le entendió la fecha: eso NO se calla.
      descartadas.push({
        renglon: n + 1, porque: `No se entendió la fecha ("${f[mapa.fecha]}")`,
        crudo: f, saldo,
      });
      continue;
    }
    movs.push({
      fecha,
      concepto: String(mapa.concepto !== undefined ? f[mapa.concepto] : "").trim(),
      referencia: String(mapa.referencia !== undefined ? f[mapa.referencia] : "").trim(),
      cargo: Math.abs(aPesos(aCentavos(cargo))),
      abono: Math.abs(aPesos(aCentavos(abono))),
      saldo,
    });
  }
  return { movimientos: movs, descartadas };
}

/* ════════════ LA VALIDACIÓN QUE DECIDE ════════════ */

// Renglón por renglón: saldo anterior + abono − cargo = saldo del renglón.
// Al centavo. Devuelve EL PRIMER renglón que rompe la cadena, que es donde
// de verdad ocurrió el error — los de abajo sólo lo arrastran.
export function validarEstado({ saldoInicial, saldoFinal, movimientos, descartadas }) {
  const movs = movimientos || [];
  const perdidas = descartadas || [];
  if (movs.length === 0) {
    return { confiable: false, porque: "El archivo no trae ningún movimiento.", renglonMalo: null, descartadas: perdidas };
  }
  // Si se cayó aunque sea un renglón, el archivo NO es confiable — aunque lo
  // que quedó encadene perfecto. Un renglón perdido es dinero que desaparece
  // sin que nadie se entere.
  if (perdidas.length > 0) {
    return {
      confiable: false, renglonMalo: null, descartadas: perdidas,
      porque: `Hay ${perdidas.length} renglón(es) del archivo que no se pudieron leer (el ${perdidas.map(d => d.renglon).join(", ")}: ${perdidas[0].porque}). Este archivo NO entra: lo que quedó puede cuadrar solo y aun así faltar dinero. Pide otro archivo al banco.`,
    };
  }
  const si = aNumero(saldoInicial);
  const sf = aNumero(saldoFinal);

  // ── Cadena renglón por renglón
  let anterior = si;
  let renglonMalo = null;
  let cadenaRevisada = false;
  if (si !== null) {
    cadenaRevisada = true;
    for (let i = 0; i < movs.length; i++) {
      const m = movs[i];
      if (m.saldo === null) continue;   // ese renglón no trae saldo corrido
      const esperado = aCentavos(anterior) + aCentavos(m.abono) - aCentavos(m.cargo);
      if (esperado !== aCentavos(m.saldo)) {
        renglonMalo = {
          i, fecha: m.fecha, concepto: m.concepto,
          saldoAnterior: aPesos(aCentavos(anterior)),
          abono: m.abono, cargo: m.cargo,
          saldoQueDice: m.saldo, saldoQueDeberia: aPesos(esperado),
          diferencia: aPesos(aCentavos(m.saldo) - esperado),
        };
        break;
      }
      anterior = m.saldo;
    }
  }

  // ── Cuadre global
  const totalAbonos = sumarDinero(movs.map(m => m.abono));
  const totalCargos = sumarDinero(movs.map(m => m.cargo));
  const calculado = (si === null) ? null : sumarDinero(si, totalAbonos, -totalCargos);
  const cuadraGlobal = (calculado === null || sf === null) ? null : aCentavos(calculado) === aCentavos(sf);

  const confiable = renglonMalo === null && cuadraGlobal === true;

  let porque;
  if (renglonMalo) {
    porque = `El renglón ${renglonMalo.i + 1} (${renglonMalo.fecha} · ${renglonMalo.concepto || "sin concepto"}) rompe la cadena: con saldo anterior de ${renglonMalo.saldoAnterior}, abono ${renglonMalo.abono} y cargo ${renglonMalo.cargo}, debería quedar en ${renglonMalo.saldoQueDeberia}, pero dice ${renglonMalo.saldoQueDice}. Este archivo NO entra: pide otro al banco.`;
  } else if (cuadraGlobal === false) {
    porque = `Los renglones encadenan bien, pero el total no cuadra: ${si} + ${totalAbonos} − ${totalCargos} da ${calculado}, y el estado dice ${sf}. Este archivo NO entra.`;
  } else if (cuadraGlobal === null) {
    porque = si === null
      ? "No se encontró el saldo inicial, así que no se puede comprobar nada. Sin comprobar, el archivo NO entra."
      : "No se encontró el saldo final, así que no se puede comprobar el total. Sin comprobar, el archivo NO entra.";
  } else {
    porque = `Cuadra al centavo: ${movs.length} movimientos, ${totalAbonos} de abonos y ${totalCargos} de cargos, de ${si} a ${sf}.`;
  }

  return {
    confiable, renglonMalo, cuadraGlobal, cadenaRevisada,
    totalAbonos, totalCargos, saldoCalculado: calculado,
    movimientos: movs.length,
    porque,
  };
}

/* ════════════ CONCILIAR CONTRA LO YA CAPTURADO ════════════ */

// Un movimiento del banco se empareja con un gasto o ingreso que ya está en
// la app. Devuelve los CRITERIOS en palabras — "importe exacto + el nombre
// del proveedor en el concepto + 3 días de diferencia" — porque eso Migue lo
// juzga de un vistazo, y un "92 %" no le sirve a nadie.
//
// Y **una factura o un gasto se concilia UNA SOLA VEZ**: dos depósitos del
// mismo importe podrían "pagar" ambos lo mismo y el ingreso se duplicaría.
export function proponerConciliacion({ movimiento, candidatos, yaConciliados = [], toleranciaDias = 5 }) {
  const usados = new Set(yaConciliados);
  const monto = movimiento.cargo > 0 ? movimiento.cargo : movimiento.abono;
  const esSalida = movimiento.cargo > 0;
  const concepto = normalizar(movimiento.concepto);
  const propuestas = [];

  for (const c of candidatos || []) {
    if (usados.has(c.id)) continue;              // ya se concilió con otra cosa
    if (aCentavos(c.monto) !== aCentavos(monto)) continue;  // el importe manda
    const criterios = [{ ok: true, dice: "importe exacto" }];

    const nombre = normalizar(c.proveedor || c.cliente || "");
    if (nombre && concepto.includes(nombre)) criterios.push({ ok: true, dice: `el nombre "${c.proveedor || c.cliente}" aparece en el concepto del banco` });

    if (c.fecha && movimiento.fecha) {
      const d = Math.abs(Math.round((new Date(movimiento.fecha + "T00:00:00") - new Date(c.fecha + "T00:00:00")) / 86400000));
      if (d > toleranciaDias) continue;
      criterios.push({ ok: true, dice: d === 0 ? "el mismo día" : `${d} día(s) de diferencia` });
    }
    propuestas.push({ candidato: c, criterios, dice: criterios.map(x => x.dice).join(" + ") });
  }

  // Varios candidatos con el mismo importe: NO elige. Dos pagos iguales al
  // mismo proveedor el mismo día también cuadran perfecto.
  if (propuestas.length > 1) {
    return {
      hay: true, varias: true, propuestas,
      porque: `Hay ${propuestas.length} movimientos capturados que cuadran igual de bien con este cobro. Elige tú cuál es: dos pagos del mismo importe también cuadran perfecto.`,
    };
  }
  if (propuestas.length === 1) {
    return { hay: true, varias: false, propuesta: propuestas[0], esSalida, porque: propuestas[0].dice };
  }
  return {
    hay: false, esSalida,
    porque: `Ningún ${esSalida ? "egreso" : "ingreso"} capturado cuadra con este movimiento de ${monto}. Puede que falte capturarlo.`,
  };
}

/* ════════════ ¿A DÓNDE SE FUE CADA PESO? ════════════ */

// La pregunta no es "¿cuáles movimientos tienen factura?" — ésa es la
// pregunta chica. Al cierre, el 100 % de los movimientos debe estar
// EXPLICADO, aunque la explicación sea "retiro sin comprobante".
//
// Cada peso queda en uno de tres estados. Y "sin explicación" quiere decir
// que falta información, NO que falte dinero, y la pantalla lo dice con esas
// palabras.
export const ESTADOS_PESO = ["explicado", "explicado sin comprobante", "SIN EXPLICACIÓN"];

export function aDondeSeFue(movimientos) {
  const filas = (movimientos || []).map(m => {
    const monto = m.cargo > 0 ? m.cargo : m.abono;
    let estado;
    if (m.conciliadoCon) estado = m.tieneComprobante === false ? "explicado sin comprobante" : "explicado";
    else if (m.explicacion) estado = "explicado sin comprobante";
    else estado = "SIN EXPLICACIÓN";
    return { ...m, monto, estado };
  });
  const suma = (e) => sumarDinero(filas.filter(f => f.estado === e).map(f => f.monto));
  const sinExplicar = filas.filter(f => f.estado === "SIN EXPLICACIÓN");
  return {
    filas,
    porEstado: Object.fromEntries(ESTADOS_PESO.map(e => [e, suma(e)])),
    sinExplicar,
    // Cuántos, no un porcentaje: "quedan 3 movimientos por explicar, por
    // $230,000" se entiende; "94 % explicado" no dice qué falta.
    dice: sinExplicar.length === 0
      ? `Todos los movimientos están explicados.`
      : `Quedan ${sinExplicar.length} movimiento(s) sin explicación, por ${suma("SIN EXPLICACIÓN")}. Que falte la explicación NO quiere decir que falte el dinero: quiere decir que nadie le ha puesto nombre todavía.`,
  };
}
