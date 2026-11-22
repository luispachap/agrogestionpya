// ============================================================
//  AgroGestión — El almacén: salidas, mermas y conteo
//
//  La entrada ya mueve el costo promedio ponderado (`costoPromedio` en
//  lectura.js). Aquí va el otro lado:
//
//  1. LA SALIDA CARGA EL PROMEDIO, NO EL ÚLTIMO PRECIO
//     Urea a $580 el bulto en marzo y a $940 en agosto; salen 40 bultos a la
//     parcela 7 — ¿cargó $23,200 o $37,600? Ninguno: el promedio de lo que de
//     verdad hay en la bodega.
//
//  2. EL VALE NUNCA BLOQUEA LA SALIDA
//     El producto YA SALIÓ. Negarlo en la app sólo logra que nadie capture y
//     que el sistema se vuelva mentira. Se avisa que el saldo no alcanza y se
//     registra igual, marcado.
//
//  3. UNA MERMA SIN CAUSA NO ES UNA MERMA
//     Un "ajuste −30 bultos" sin decir por qué es dinero que se fue sin que
//     nadie explicara nada, y en dos meses es costumbre.
//
//  4. EL CONTEO A CIEGAS
//     El conteo en que el capturista VE el saldo del sistema no es un conteo,
//     es una copia. Aquí se captura primero lo contado y sólo después se
//     enseña la diferencia — y el saldo NO se ajusta solo.
//
//  Sus pruebas están en src/almacen.test.js.
// ============================================================

import { aCentavos, aPesos, sumarDinero, multiplicarDinero, fmt, fechaLocal } from "./calculos.js";

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ 1 · LO QUE CUESTA LO QUE SALE ════════════ */

// Lo que sale se carga al COSTO PROMEDIO del insumo, no al último precio que
// se pagó ni al primero.
//
// Si el insumo no tiene costo registrado, NO se inventa uno: la salida se
// registra igual (el producto ya salió) pero con el costo en null y diciendo
// que falta. Un costo inventado se arrastra a todas las parcelas del año.
export function costoDeSalida({ insumo, cantidad }) {
  const c = num(insumo?.costo_unit);
  const q = num(cantidad);
  if (q === null || q <= 0) {
    return { costoUnit: c, costoTotal: null, completo: false, porque: "No se dijo cuánto salió." };
  }
  if (c === null || c === 0) {
    return {
      costoUnit: null, costoTotal: null, cantidad: q, completo: false,
      porque: `De "${insumo?.nombre || "este insumo"}" no hay costo registrado, así que esta salida no le carga nada a la parcela. El movimiento sí queda; lo que falta es el costo.`,
    };
  }
  return {
    costoUnit: c, costoTotal: multiplicarDinero(c, q), cantidad: q, completo: true,
    porque: `${q} × ${fmt(c)} (costo promedio de la bodega).`,
  };
}

/* ════════════ 2 · EL VALE DE SALIDA ════════════ */

export const DESTINOS_SALIDA = ["parcela", "maquinaria", "ganado", "obra", "otro"];

// Arma el vale. **NUNCA bloquea**: el producto ya salió del almacén, y negar
// el registro no lo devuelve al estante — sólo logra que nadie capture.
//
// Lo que sí hace: avisar cuando el saldo no alcanza, y marcarlo. Un saldo que
// se va a negativo es información: o entró mercancía que nadie capturó, o
// salió más de lo que se anotó.
export function valeDeSalida({ insumo, cantidad, destino, destinoId, quien, fecha, motivo }) {
  const q = num(cantidad);
  const avisos = [];
  const existencia = num(insumo?.existencia) ?? 0;

  if (q === null || q <= 0) {
    return { sirve: false, avisos: ["Falta decir cuánto salió."], vale: null, bloquea: false };
  }
  if (!destino) avisos.push("No se dijo a dónde va. El vale se guarda igual, pero después nadie va a saber a qué parcela cargarlo.");
  if (!quien) avisos.push("No se dijo quién lo sacó.");
  if (q > existencia) {
    avisos.push(`El almacén dice que hay ${existencia} y se están sacando ${q}. Se registra igual —el producto ya salió— y el saldo va a quedar en ${existencia - q}. Ese negativo es información: o entró algo que nadie capturó, o salió más de lo anotado.`);
  }

  const costo = costoDeSalida({ insumo, cantidad: q });
  if (!costo.completo) avisos.push(costo.porque);

  return {
    // "sirve" quiere decir que se puede guardar, y casi siempre es que sí.
    sirve: true,
    // NUNCA. Está aquí explícito para que nadie lo cambie sin darse cuenta.
    bloquea: false,
    avisos,
    vale: {
      insumoId: insumo?.id, nombre: insumo?.nombre, unidad: insumo?.unidad,
      cantidad: q, destino: destino || null, destinoId: destinoId || null,
      quien: quien || null, fecha: fecha || fechaLocal(), motivo: motivo || null,
      costoUnit: costo.costoUnit, costoTotal: costo.costoTotal,
      dejaNegativo: q > existencia,
      existenciaAntes: existencia,
    },
  };
}

/* ════════════ 3 · MERMAS CON NOMBRE ════════════ */

export const CAUSAS_MERMA = [
  "se echó a perder", "se derramó", "caducó", "se rompió el envase",
  "diferencia de conteo", "robo", "no se sabe",
];

// Un ajuste de inventario SIEMPRE lleva causa. "No se sabe" es una causa
// válida y honesta; dejarlo en blanco no lo es.
//
// Y se separa a propósito lo que se explicó de lo que no: si todo cae en el
// mismo montón, en dos meses el "no se sabe" es costumbre y nadie lo mira.
export function clasificarAjuste({ delta, causa, nota }) {
  const d = num(delta);
  if (d === null || d === 0) {
    return { sirve: false, porque: "Un ajuste de cero no es un ajuste." };
  }
  const c = String(causa || "").trim();
  if (!c) {
    return {
      sirve: false,
      porque: 'Falta la causa. Un "ajuste de −30 bultos" sin decir por qué es dinero que se fue sin que nadie explicara nada, y en dos meses es costumbre. Si de verdad no se sabe, elige "no se sabe": eso también es una respuesta.',
    };
  }
  return {
    sirve: true, delta: d, causa: c, nota: nota || null,
    // Se marca aparte lo que quedó sin explicación de verdad.
    sinExplicar: c === "no se sabe",
    porque: d < 0 ? `Faltaron ${Math.abs(d)}: ${c}.` : `Sobraron ${d}: ${c}.`,
  };
}

// El resumen que sirve: cuánto se fue en mermas al año y en qué. Lo que está
// en "no se sabe" va aparte, porque es lo que hay que bajar.
export function resumenMermas({ movimientos, insumos }) {
  const costoDe = new Map((insumos || []).map(i => [i.id, num(i.costo_unit) ?? 0]));
  const ajustes = (movimientos || []).filter(m => m && m.esAjuste);
  const porCausa = {};
  let total = 0;
  for (const a of ajustes) {
    const c = a.causa || "no se sabe";
    const valor = multiplicarDinero(costoDe.get(a.insumoId) || 0, Math.abs(num(a.cantidad) || 0));
    porCausa[c] = sumarDinero(porCausa[c] || 0, valor);
    total = sumarDinero(total, valor);
  }
  const sinSaber = porCausa["no se sabe"] || 0;
  return {
    total, porCausa, sinSaber, cuantos: ajustes.length,
    dice: ajustes.length === 0
      ? "No hay ajustes de inventario registrados."
      : `${ajustes.length} ajuste(s) por ${fmt(total)}.${sinSaber > 0 ? ` De eso, ${fmt(sinSaber)} está en "no se sabe" — ése es el que hay que bajar.` : ""}`,
  };
}

/* ════════════ 4 · EL CONTEO A CIEGAS ════════════ */

// El conteo en que el capturista VE el saldo del sistema no es un conteo, es
// una copia: la cabeza acomoda el número al que ya está en la pantalla.
//
// Por eso el flujo es: primero se captura lo contado, y SÓLO DESPUÉS se
// enseña lo que decía el sistema y la diferencia. Esta función es la segunda
// mitad — la primera es que la pantalla no enseñe el saldo antes.
export function compararConteo({ contado, insumo }) {
  const c = num(contado);
  const s = num(insumo?.existencia) ?? 0;
  if (c === null) {
    return { hay: false, porque: "No se capturó lo contado." };
  }
  const dif = Math.round((c - s) * 1000) / 1000;
  return {
    hay: true, contado: c, sistema: s, diferencia: dif,
    // El saldo NO se ajusta solo. La diferencia es un ajuste con causa, y esa
    // causa la pone una persona.
    ajustaSolo: false,
    cuadra: dif === 0,
    porque: dif === 0
      ? `Cuadra: se contaron ${c} y el sistema dice ${s}.`
      : `Se contaron ${c} y el sistema dice ${s}: ${dif > 0 ? "sobran" : "faltan"} ${Math.abs(dif)}. Para que cuadre hay que registrar un ajuste, y el ajuste lleva causa.`,
  };
}

// Los insumos que llevan más tiempo sin contarse. Un almacén que nunca se
// cuenta tiene un saldo que es una suposición, no un dato.
export function loQueFaltaContar({ insumos, conteos, hoy, cadaDias = 90 }) {
  const dia = hoy || fechaLocal();
  const ultimo = new Map();
  for (const c of conteos || []) {
    if (!c?.insumoId) continue;
    const prev = ultimo.get(c.insumoId);
    if (!prev || String(c.fecha) > String(prev)) ultimo.set(c.insumoId, c.fecha);
  }
  const dias = (f) => {
    if (!f) return null;
    return Math.round((new Date(dia + "T00:00:00") - new Date(String(f).slice(0, 10) + "T00:00:00")) / 86400000);
  };
  const filas = (insumos || []).map(i => {
    const f = ultimo.get(i.id) || null;
    const d = dias(f);
    return {
      insumo: i, ultimo: f, dias: d,
      nunca: f === null,
      toca: f === null || (d !== null && d >= cadaDias),
    };
  });
  return {
    filas,
    tocan: filas.filter(f => f.toca),
    nunca: filas.filter(f => f.nunca),
    dice: filas.filter(f => f.nunca).length > 0
      ? `${filas.filter(f => f.nunca).length} insumo(s) no se han contado NUNCA. Su saldo es una suposición, no un dato.`
      : `Todos los insumos se han contado alguna vez.`,
  };
}

/* ════════════ QUÉ DE UNA ENTRADA ES DINERO, Y QUÉ NO ════════════ */

// La tabla `entradas_inv` guarda TODO lo que se mueve en la bodega, y no todo
// lo que se mueve es dinero que salió. Mezclarlos ya causaba tres cosas, las
// tres graves y las tres calladas:
//
//  1. LA COMPRA SE CONTABA DOS VECES. Las pantallas de compra escriben un
//     renglón en `egresos` Y un renglón en `entradas_inv` con el mismo
//     importe, y los totales sumaban los dos. Cada saco de fertilizante
//     costaba el doble en el reporte, y la utilidad salía menor de lo real.
//
//  2. UNA SALIDA RESTABA GASTO. El movimiento de un vale se guarda con
//     cantidad negativa, y por lo tanto con costo negativo. Sumarlo BAJABA los
//     egresos: sacar producto de la bodega hacía ver el año más rentable. Y la
//     salida no es un gasto nuevo — el dinero se fue cuando se compró.
//
//  3. UN CONTEO A CIEGAS VOLVÍA NaN LA UTILIDAD. Los renglones de conteo no
//     traen `costo_total`, y `suma + undefined` es NaN. Un solo conteo en la
//     bodega y la pantalla de finanzas dejaba de enseñar números.
//
// Por eso el importe que va a finanzas se decide aquí, en un solo lugar, y no
// en cada `reduce` de cada pantalla.
export function costoAFinanzas(entrada) {
  if (!entrada) return 0;
  // Un conteo es un dato de bodega, no un movimiento de dinero.
  if (entrada.esConteo) return 0;
  // La compra que ya escribió su propio egreso no se cuenta otra vez.
  if (entrada.yaEsEgreso) return 0;
  const c = num(entrada.costo_total);
  // Sin costo capturado NO es cero pesos: es que no se sabe. Para una SUMA da
  // lo mismo, pero el que suma tiene que poder enterarse — para eso está
  // `entradasSinCosto` de abajo, que las cuenta y las nombra.
  if (c === null) return 0;
  // Una salida no es un egreso negativo. El dinero se fue al comprar.
  if (c < 0) return 0;
  return c;
}

// Cuánto de verdad le costó a las finanzas lo que entró a la bodega, y qué
// tanto de eso no se sabe. Se devuelven juntos a propósito: un total al que le
// faltan renglones y no lo dice es exactamente cómo se aprueba un presupuesto
// que sale corto.
export function loQueEntroCuesta(entradas) {
  const lista = Array.isArray(entradas) ? entradas : [];
  const cuentan = lista.filter(e => e && !e.esConteo && !e.yaEsEgreso && (num(e.costo_total) ?? 0) >= 0);
  const sinCosto = cuentan.filter(e => num(e.costo_total) === null);
  return {
    total: sumarDinero(lista.map(costoAFinanzas)),
    renglones: cuentan.length,
    sinCosto,
    completo: sinCosto.length === 0,
    dice: sinCosto.length === 0
      ? null
      : `${sinCosto.length} entrada(s) a la bodega no tienen costo capturado, así que este total va corto. No es que hayan costado cero.`,
  };
}

// Dar de alta un artículo: sin nombre no se puede encontrar ni contar, y dos artículos con el mismo nombre parten la
// existencia en dos sin que nadie lo note (lo que entra a uno no sale del otro).
const igualNombre = (a) => String(a || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
export function revisarArticulo(form, inventario = []) {
  const nombre = String(form?.nombre || "").trim();
  if (!nombre) return { ok: false, dice: "Falta el nombre del artículo." };
  if (!String(form?.unidad || "").trim()) return { ok: false, dice: "Falta la unidad (kg, L, bulto, pieza…)." };
  const otro = (inventario || []).find(a => a.id !== form.id && igualNombre(a.nombre) === igualNombre(nombre));
  if (otro) return { ok: false, dice: `Ya hay un artículo que se llama ${otro.nombre}. Si es el mismo, regístrale una entrada en vez de darlo de alta otra vez.` };
  return { ok: true, nombre, unidad: String(form.unidad).trim() };
}
