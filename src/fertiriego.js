// ============================================================
//  AgroGestión — Las tablas de fertirriego de Fito
//
//  Fito manda sus indicaciones al grupo como una foto de su hoja de Excel.
//  Casi siempre la misma tabla, casi siempre los mismos once fertilizantes,
//  casi siempre en el mismo orden:
//
//    Fertiriego en el cultivo de: CHILE MIRASOL   Superficie en Ha: 11
//    Parcela: 53                  Fecha: 17/07/2026
//    Fertilizantes  Dosis kg/ha  Fertilizante total | Productos Extras  Dosis/ha  Producto total
//    Fosfonitrato        20            220          | infinito              1          0
//    S.Amonio             —              0          | serenade              3          0
//    ...
//
//  El "casi" importa: Luis fue claro en que **a veces** es así. Por eso este
//  lector no exige el formato — lo reconoce cuando está, dice cuánto reconoció
//  cuando falta, y NUNCA inventa un renglón que no se leyó.
//
//  ─────────────────────────────────────────────────────────────
//  LO IMPORTANTE: ESTA TABLA SE VALIDA SOLA
//  ─────────────────────────────────────────────────────────────
//  El total de cada renglón es la dosis por la superficie:
//
//      dosis kg/ha × superficie = fertilizante total
//
//  20 × 11 = 220. 25 × 11 = 275. 40 × 11 = 440. Cuadra al kilo.
//
//  Es exactamente la misma idea que el estado de cuenta del banco, y sirve
//  para lo mismo: cuando la tabla llega como FOTO y se lee con IA, un dígito
//  mal leído rompe la multiplicación y **se sabe cuál renglón**. Una hoja que
//  no cuadra no entra: es preferible pedirle a Fito el archivo que aplicar
//  fertilizante sobre cifras inventadas.
//
//  Y como el formato casi no cambia, la segunda hoja se lee con la regla ya
//  aprendida — gratis, sin señal, y sin pedirle nada a ninguna IA.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · No corrige un renglón que no cuadra. Lo señala y ahí se detiene.
//  · No aplica nada solo. Arma la indicación y la propone; una persona la manda.
//  · No decide si hay suficiente insumo: lo dice, y quien compra decide.
//
//  Sus pruebas están en src/fertiriego.test.js.
// ============================================================

import { normalizar, aNumero, aFecha } from "./lectura.js";
import { sumarDinero, multiplicarDinero, fmt, fechaLocal } from "./calculos.js";

// Los once, en el orden en que Fito los tiene.
export const FERTILIZANTES = [
  "Fosfonitrato", "S.Amonio", "MAP", "S.Potasio", "S. Magnesio",
  "N. Calcio", "Cl. Potasio", "NKS", "UREA", "MKP", "MicroMix",
];

// Cómo los escribe la gente cuando no copia exacto de la hoja, y cómo salen de
// una foto leída con IA.
const ALIAS = {
  "FOSFONITRATO": "Fosfonitrato", "FOSFO NITRATO": "Fosfonitrato",
  "S.AMONIO": "S.Amonio", "S AMONIO": "S.Amonio", "SULFATO DE AMONIO": "S.Amonio", "SULFATO AMONIO": "S.Amonio",
  "MAP": "MAP", "FOSFATO MONOAMONICO": "MAP",
  "S.POTASIO": "S.Potasio", "S POTASIO": "S.Potasio", "SULFATO DE POTASIO": "S.Potasio",
  "S. MAGNESIO": "S. Magnesio", "S.MAGNESIO": "S. Magnesio", "SULFATO DE MAGNESIO": "S. Magnesio",
  "N. CALCIO": "N. Calcio", "N.CALCIO": "N. Calcio", "NITRATO DE CALCIO": "N. Calcio",
  "CL. POTASIO": "Cl. Potasio", "CL.POTASIO": "Cl. Potasio", "CLORURO DE POTASIO": "Cl. Potasio",
  "NKS": "NKS", "UREA": "UREA", "MKP": "MKP",
  "MICROMIX": "MicroMix", "MICRO MIX": "MicroMix", "MICROELEMENTOS": "MicroMix",
};

// Índice sin puntos ni espacios: "S. Magnesio", "S.Magnesio" y "SMAGNESIO"
// caen todos en el mismo lugar.
const APRETADO = new Map();
for (const [k, v] of Object.entries(ALIAS)) {
  APRETADO.set(normalizar(k).replace(/[\s.]/g, ""), v);
}

export function canonico(s) {
  const t = normalizar(s).replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (ALIAS[t]) return ALIAS[t];
  return APRETADO.get(t.replace(/[\s.]/g, "")) || null;
}

// En el catálogo de la bodega el nombre suele traer algo más: «Urea 46-00-00», «MAP 11-52-00», «Nitrato de calcio
// granulado». Si empieza con el nombre de uno de los once y luego viene un espacio, es ése. (Sólo para buscarlo en la
// bodega: si dos artículos del catálogo caen en el mismo, no se escoge ninguno.)
const POR_INICIO = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
export function canonicoDeCatalogo(s) {
  const directo = canonico(s); if (directo) return directo;
  const t = normalizar(s).replace(/\s+/g, " ").trim();
  const k = POR_INICIO.find(k => t.startsWith(k + " "));
  return k ? ALIAS[k] : null;
}

// Palabras de encabezado: no son ni fertilizante ni producto extra.
const ENCABEZADOS = [
  "FERTILIZANTES", "FERTILIZANTE", "DOSIS KG/HA", "DOSIS", "FERTILIZANTE TOTAL",
  "PRODUCTOS EXTRAS", "PRODUCTO EXTRA", "PRODUCTOS", "DOSIS/HA:LT O KG",
  "DOSIS/HA", "PRODUCTO TOTAL", "TOTAL", "PARCELA", "FECHA", "SUPERFICIE EN HA",
  "SUPERFICIE", "CULTIVO",
];
const esEncabezado = (s) => {
  const t = normalizar(s).replace(/:$/, "").trim();
  return ENCABEZADOS.includes(t);
};

/* ════════════ LEER LA HOJA ════════════ */

// Acepta renglones: arreglos de celdas (de un Excel) o cadenas (de un PDF, o
// de la foto ya transcrita). Devuelve lo que se leyó, o dice qué falta.
export function leerFertiriego(renglones) {
  const filas = (renglones || [])
    .map(r => (Array.isArray(r) ? r : String(r).split(/\t|\s*\|\s*|\s{2,}/)))
    .map(f => f.map(c => String(c == null ? "" : c).trim()));

  const plano = filas.map(f => f.join(" | ")).join("\n");
  const t = normalizar(plano);

  // ¿Es siquiera una hoja de fertirriego? Fito la titula "Fertiriego".
  if (!/FERTI\s?L?R?RIEGO|FERTILIRIEGO|FERTIRRIEGO|FERTIRIEGO/.test(t)) {
    return { ok: false, porque: "Esto no parece una hoja de fertirriego: no dice \"Fertiriego\" por ningún lado." };
  }

  const cabecera = leerCabecera(t);
  const faltan = [];
  if (!cabecera.cultivo) faltan.push("el cultivo");
  if (cabecera.superficie === null) faltan.push("la superficie en hectáreas");
  if (!cabecera.parcela) faltan.push("la parcela");
  if (!cabecera.fecha) faltan.push("la fecha");

  const fertilizantes = [];
  const extras = [];
  const vistos = new Set();

  for (const f of filas) {
    // ── El fertilizante y sus dos números van en las primeras celdas.
    const nombre = canonico(f[0]);
    if (nombre && !vistos.has(nombre)) {
      vistos.add(nombre);
      const dosis = aNumero(f[1]);
      const total = aNumero(f[2]);
      // Un renglón vacío (sin dosis, total 0) es un fertilizante que NO se
      // aplica. Eso no es un dato faltante: es un cero de verdad.
      fertilizantes.push({ nombre, dosis, total, seAplica: (dosis ?? 0) > 0 });
    }

    // ── Los productos extras van en las columnas de la derecha, en los MISMOS
    //    renglones de la tabla. No son de catálogo fijo: Fito pone lo que le
    //    toca. Por eso sólo se buscan en renglones que ya son de la tabla —
    //    si no, la fecha de la cabecera ("Fecha: | 17/07/2026") entra como si
    //    fuera un producto, y de ahí sale una compra de algo que no existe.
    const enLaTabla = !!nombre || (f[0] === "" && f.length > 3);
    const ex = f[3];
    if (enLaTabla && ex && !esEncabezado(ex) && !canonico(ex) && aNumero(ex) === null && !aFecha(ex)) {
      extras.push({ nombre: ex, dosis: aNumero(f[4]), total: aNumero(f[5]) });
    }
  }

  if (fertilizantes.length === 0) {
    return {
      ok: false, ...cabecera,
      porque: "No se reconoció ningún fertilizante de la lista. ¿Salió cortada la foto, o es otro formato?",
    };
  }

  const noSalieron = FERTILIZANTES.filter(n => !vistos.has(n));

  return {
    ok: true,
    ...cabecera,
    faltan,
    fertilizantes,
    extras,
    // Cuántos de los once se reconocieron. Si faltan, la foto salió cortada —
    // y hay que decirlo, no completarlo con ceros.
    reconocidos: fertilizantes.length,
    deCuantos: FERTILIZANTES.length,
    noSalieron,
    completa: noSalieron.length === 0 && faltan.length === 0,
  };
}

// La cabecera aguanta las dos formas: "Parcela: 53" en una sola celda, o
// "Parcela:" en una y "53" en la de al lado. Trabaja sobre el texto ya
// normalizado, así que devuelve los valores en mayúsculas — que es como Fito
// los escribe de todos modos, y como se comparan después.
function leerCabecera(plano) {
  const trasEtiqueta = (etiquetas) => {
    for (const et of etiquetas) {
      const m = plano.match(new RegExp(et + "\\s*:?\\s*\\|?\\s*([^|\\n]+)"));
      if (m) {
        const v = m[1].replace(/^[:\s|]+/, "").trim();
        if (v) return v;
      }
    }
    return null;
  };

  return {
    cultivo: trasEtiqueta(["CULTIVO DE", "CULTIVO"]),
    superficie: aNumero(trasEtiqueta(["SUPERFICIE EN HA", "SUPERFICIE", "HECTAREAS"])),
    parcela: trasEtiqueta(["PARCELA"]),
    fecha: aFecha(trasEtiqueta(["FECHA"])),
  };
}

/* ════════════ LA VALIDACIÓN QUE DECIDE ════════════ */

// dosis kg/ha × superficie = fertilizante total. Al kilo.
//
// Devuelve el PRIMER renglón que no cuadra, que es donde de verdad está el
// error. Si la hoja llegó como foto, esto es lo que atrapa un dígito mal
// leído: un 20 que se leyó 26 rompe la multiplicación y se ve.
export function validarFertiriego(hoja) {
  if (!hoja?.ok) {
    return {
      confiable: false, revisados: 0, renglonMalo: null, avisos: [],
      porque: hoja?.porque || "No se pudo leer la hoja.",
    };
  }
  const sup = aNumero(hoja.superficie);
  if (sup === null || sup <= 0) {
    return {
      confiable: false, revisados: 0, renglonMalo: null, avisos: [],
      porque: "No se leyó la superficie en hectáreas, así que no se puede comprobar ningún total. Sin comprobar, la hoja no entra.",
    };
  }

  const malo = (nombre, dosis, total, unidad) => {
    const deberia = Math.round(dosis * sup * 100) / 100;
    return {
      confiable: false,
      renglonMalo: { nombre, dosis, superficie: sup, totalQueDice: total, totalQueDeberia: deberia },
      porque: `${nombre} no cuadra: ${dosis} ${unidad} por ${sup} hectáreas dan ${deberia}, ` +
        `y la hoja dice ${total}. Si esto vino de una foto, lo más probable es que un dígito ` +
        `se haya leído mal. Esta hoja NO entra: pídele a Fito el archivo, o revisen ese número juntos.`,
    };
  };

  const revisables = hoja.fertilizantes.filter(f => f.dosis !== null && f.total !== null);
  for (const f of revisables) {
    if (Math.abs(Math.round(f.dosis * sup * 100) / 100 - f.total) > 0.5) {
      return { ...malo(f.nombre, f.dosis, f.total, "kg/ha"), revisados: revisables.length, avisos: [] };
    }
  }

  // Los extras se comprueban igual. Pero un total en cero cuando SÍ hay dosis
  // no es un error de lectura: es que Fito no llenó esa celda — se ve tal cual
  // en sus hojas. Eso se avisa, no se rechaza.
  const extras = hoja.extras || [];
  const extrasSinTotal = extras.filter(e => (e.dosis ?? 0) > 0 && (e.total ?? 0) === 0);
  for (const e of extras) {
    if ((e.dosis ?? 0) <= 0 || (e.total ?? 0) === 0) continue;
    if (Math.abs(Math.round(e.dosis * sup * 100) / 100 - e.total) > 0.5) {
      return { ...malo(e.nombre, e.dosis, e.total, "por ha"), revisados: revisables.length, avisos: [] };
    }
  }

  const avisos = [];
  if (extrasSinTotal.length > 0) {
    avisos.push(
      `${extrasSinTotal.map(e => e.nombre).join(", ")}: traen dosis pero el total quedó en cero — ` +
      `Fito no llenó esa celda. No es un error de lectura, pero tampoco quiere decir que no se apliquen. Pregúntale.`
    );
  }
  if ((hoja.noSalieron || []).length > 0) {
    avisos.push(
      `No salieron en la hoja: ${hoja.noSalieron.join(", ")}. ` +
      `Puede que haya quedado cortada. NO se dan por no aplicados.`
    );
  }
  if ((hoja.faltan || []).length > 0) {
    avisos.push(`Falta de la cabecera: ${hoja.faltan.join(", ")}.`);
  }

  return {
    confiable: true, revisados: revisables.length, renglonMalo: null, avisos,
    porque: revisables.length > 0
      ? `Cuadra: los ${revisables.length} renglones con dosis multiplican exacto por las ${sup} hectáreas.`
      : "No hubo ningún renglón con dosis y total que comprobar, pero tampoco ninguno contradictorio.",
  };
}

/* ════════════ ¿HAY CON QUÉ APLICARLO? ════════════ */

// Antes de mandarle la indicación al trabajador: ¿hay suficiente de cada cosa
// en la bodega?
//
// NO impide mandarla — la aplicación se planea con lo que Fito dice y quien
// compra resuelve el faltante. Lo que hace es AVISAR A TIEMPO, que es de lo que
// se trata: parar una aplicación por un saco que nadie pidió es justo lo que
// hay que evitar.
export function alcanzaParaLaAplicacion({ hoja, inventario }) {
  const porNombre = new Map(), dudosos = new Map();
  for (const i of inventario || []) {
    const c = canonicoDeCatalogo(i.nombre);
    if (c && porNombre.has(c) && porNombre.get(c).id !== i.id) dudosos.set(c, [...(dudosos.get(c) || [porNombre.get(c)]), i]);
    else if (c) porNombre.set(c, i);
    porNombre.set(normalizar(i.nombre), i);
  }
  for (const c of dudosos.keys()) porNombre.delete(c);   // dos artículos que podrían ser el mismo: no se escoge

  const pedidos = [
    ...(hoja.fertilizantes || []).filter(f => (f.total ?? 0) > 0)
      .map(f => ({ nombre: f.nombre, cantidad: f.total, unidad: "kg" })),
    ...(hoja.extras || []).filter(e => (e.total ?? 0) > 0)
      .map(e => ({ nombre: e.nombre, cantidad: e.total, unidad: "L o kg" })),
  ];

  const filas = pedidos.map(p => {
    const it = porNombre.get(p.nombre) || porNombre.get(normalizar(p.nombre));
    if (!it) {
      return {
        ...p, insumoId: null, existencia: null, alcanza: null, falta: null, costoDeReponer: null,
        // Que no esté en el catálogo NO quiere decir que no haya: quiere decir
        // que no se sabe. Son cosas distintas y se dicen distinto.
        dice: dudosos.get(p.nombre)
          ? `"${p.nombre}" podría ser ${dudosos.get(p.nombre).map(v => `«${v.nombre}»`).join(" o ")} del catálogo: no se escoge uno, así que no se sabe si hay.`
          : `"${p.nombre}" no está en el catálogo de la bodega, así que no se sabe si hay. No quiere decir que no haya.`,
      };
    }
    const hay = Number(it.existencia) || 0;
    const falta = Math.round((p.cantidad - hay) * 100) / 100;
    const costo = Number(it.costo_unit ?? it.costoUnit) || 0;
    return {
      ...p, insumoId: it.id, existencia: hay,
      alcanza: falta <= 0,
      falta: falta > 0 ? falta : 0,
      costoDeReponer: (falta > 0 && costo > 0) ? multiplicarDinero(costo, falta) : null,
      dice: falta <= 0
        ? `${p.nombre}: hay ${hay}, se necesitan ${p.cantidad}. Alcanza.`
        : `${p.nombre}: hay ${hay} y se necesitan ${p.cantidad}. Faltan ${falta}` +
          (costo > 0
            ? `, que costarían alrededor de ${fmt(multiplicarDinero(costo, falta))}.`
            : ". No se sabe el costo, así que no se puede decir cuánto costaría reponerlos."),
    };
  });

  const faltantes = filas.filter(f => f.alcanza === false);
  const sinSaber = filas.filter(f => f.alcanza === null);
  const costoTotal = sumarDinero(faltantes.map(f => f.costoDeReponer || 0));

  return {
    filas, faltantes, sinSaber, costoTotal,
    // Nunca bloquea. Avisa.
    bloquea: false,
    dice: faltantes.length === 0 && sinSaber.length === 0
      ? "Hay de todo lo que pide la hoja."
      : [
          faltantes.length > 0
            ? `Faltan ${faltantes.length} producto(s)${costoTotal > 0 ? `, unos ${fmt(costoTotal)} para reponerlos` : ""}.`
            : null,
          sinSaber.length > 0
            ? `De ${sinSaber.length} producto(s) no se sabe si hay, porque no están en el catálogo.`
            : null,
          "La indicación se puede mandar igual: quien compra resuelve el faltante. Lo que importa es enterarse antes de que se pare la aplicación.",
        ].filter(Boolean).join(" "),
  };
}

/* ════════════ DE LA HOJA A LA INDICACIÓN ════════════ */

// Arma la indicación que le va a llegar al trabajador. NO la manda sola: la
// propone, y una persona la despacha.
export function indicacionDesdeHoja({ hoja, parcelas, hoy }) {
  const buscada = normalizar(hoja.parcela || "");
  const apretada = buscada.replace(/[^A-Z0-9]/g, "");
  const parcela = !buscada ? null : (parcelas || []).find(p => {
    const n = normalizar(p.nombre);
    return n === buscada
      || (apretada && n.replace(/[^A-Z0-9]/g, "") === apretada)
      || n.endsWith(" " + buscada);
  });

  const productos = [
    ...(hoja.fertilizantes || []).filter(f => (f.total ?? 0) > 0)
      .map(f => ({ nombre: f.nombre, dosis: f.dosis, total: f.total, unidad: "kg" })),
    ...(hoja.extras || []).filter(e => (e.dosis ?? 0) > 0)
      .map(e => ({
        nombre: e.nombre, dosis: e.dosis, total: e.total, unidad: "L o kg",
        sinTotal: (e.total ?? 0) === 0,
      })),
  ];

  return {
    tipo: "fertirriego",
    cultivo: hoja.cultivo || null,
    parcelaId: parcela?.id || null,
    parcelaNombre: parcela?.nombre || hoja.parcela || null,
    // Si no se encontró la parcela en el catálogo, se dice. Mandar una
    // indicación a una parcela que no existe es mandarla a nadie.
    parcelaReconocida: !!parcela,
    superficie: hoja.superficie ?? null,
    fecha: hoja.fecha || hoy || fechaLocal(),
    productos,
    deQuien: "Fito",
    resumen: `Fertirriego en ${parcela?.nombre || hoja.parcela || "(parcela sin identificar)"}` +
      ` (${hoja.cultivo || "sin cultivo"}, ${hoja.superficie ?? "?"} ha): ` +
      (productos.length > 0
        ? productos.map(p => `${p.nombre} ${p.total ?? "?"}`).join(", ")
        : "sin productos con cantidad."),
  };
}
