import { unico } from "./calculos.js";
// ============================================================
//  AgroGestión — Cargador de Excel
//  Agroselectos P&A
//
//  Lee y escribe archivos Excel con las hojas:
//  Instrucciones, Cuentas, Parcelas, Trabajadores, Encargados,
//  Agrónomos, Cuadrillas, Proveedores, Cultivos.
// ============================================================

import * as XLSX from "xlsx";

// ------------------------------------------------------------
//  ESTRUCTURA DE LAS HOJAS
//  Define qué columnas tiene cada hoja y qué tipo son.
// ------------------------------------------------------------
export const HOJAS = {
  // Las CUENTAS no van aquí: se invitan en Arranque → Cuentas y cada persona pone su propia contraseña. Antes esta
  // plantilla pedía «Contraseña inicial» y armaba un SQL que creaba cuentas directo en la base: una contraseña escrita en
  // una hoja que pasa de mano en mano, y una cuenta creada por fuera de la invitación. Tampoco va el PIN: se le pone a cada
  // quien en Equipo, donde se revisa que no lo tenga nadie más.
  Parcelas: {
    columnas: ["Nombre", "Ubicación", "Hectáreas", "Cultivo actual", "Emoji", "Notas"],
    ejemplos: [
      ["Rancho 1", "R01", 5.2, "Chile", "🌶️", ""],
      ["Rancho 2", "R02", 3.8, "Ajo",   "🧄", ""],
    ],
  },
  Trabajadores: {
    columnas: ["Nombre", "Sueldo diario", "Categoría", "Teléfono", "Notas"],
    ejemplos: [
      ["Juan Pérez",   350, "Tractorista", "4491234567", ""],
      ["Pablo Ramírez", 280, "General",   "", ""],
    ],
  },
  Encargados: {
    columnas: ["Nombre", "Sueldo diario", "Teléfono", "Notas"],
    ejemplos: [
      ["Pedro Ramírez", 600, "4495551234", ""],
    ],
  },
  Agrónomos: {
    columnas: ["Nombre", "Teléfono", "Notas"],
    ejemplos: [
      ["Luis Herrera", "4497778888", ""],
    ],
  },
  Cuadrillas: {
    columnas: ["Nombre", "Miembros", "Flete diario", "Teléfono contacto", "Notas"],
    ejemplos: [
      ["Cuadrilla Norte", 8, 500, "4491112222", ""],
    ],
  },
  Proveedores: {
    columnas: ["Nombre", "Teléfono", "Dirección", "Notas"],
    ejemplos: [
      ["Agroquímicos del Bajío", "555-1234", "Aguascalientes", ""],
    ],
  },
  Cultivos: {
    columnas: ["Nombre", "Emoji", "Duración total (días)", "Unidad de cosecha", "Camas por hectárea"],
    ejemplos: [
      ["Maíz",  "🌽", 150, "toneladas", ""],
      ["Ajo",   "🧄", 250, "kg", 40],
      ["Chile", "🌶️", 180, "cajas", 25],
    ],
  },
  Fenología: {
    columnas: ["Cultivo", "Etapa", "Día inicio", "Día fin"],
    ejemplos: [
      ["Maíz", "Preparación de suelo", 0, 14],
      ["Maíz", "Siembra", 14, 21],
      ["Maíz", "Emergencia", 21, 40],
      ["Maíz", "Crecimiento", 40, 100],
      ["Maíz", "Floración", 100, 125],
      ["Maíz", "Llenado de grano", 125, 145],
      ["Maíz", "Cosecha", 145, 150],
    ],
  },
};

const INSTRUCCIONES = [
  ["AGROGESTIÓN — Plantilla de carga inicial"],
  ["Agroselectos P&A"],
  [""],
  ["Cómo usar este archivo:"],
  ["1. Llena las hojas con los datos de tu rancho."],
  ["2. Puedes dejar hojas vacías si no las necesitas todavía."],
  ["3. No cambies los nombres de las columnas (primera fila de cada hoja)."],
  ["4. Borra las filas de ejemplo antes de guardar tu versión final."],
  ["5. Cuando termines, guarda el archivo y súbelo en la app: Inicio → Subir a la nube → Cargar plantilla."],
  [""],
  ["Qué hace cada hoja:"],
  [""],
  ["• Las cuentas (correo y contraseña) NO van en esta plantilla: se invitan en Arranque → Cuentas,"],
  ["  y cada persona pone su propia contraseña. Nadie más la conoce."],
  ["• El PIN tampoco va aquí: se le pone a cada quien en Equipo, donde se revisa que no se repita."],
  [""],
  ["• Parcelas:   los terrenos del rancho con sus hectáreas y cultivo actual."],
  [""],
  ["• Trabajadores: trabajadores de planta con su sueldo y categoría."],
  [""],
  ["• Encargados:   encargados con su sueldo."],
  [""],
  ["• Agrónomos:    agrónomos."],
  [""],
  ["• Cuadrillas:   grupos externos con su número de miembros y flete diario."],
  [""],
  ["• Proveedores:  proveedores de insumos."],
  [""],
  ["• Cultivos:     catálogo de cultivos con su emoji, duración total, unidad de cosecha y camas por hectárea."],
  ["                'Camas por hectárea' es opcional: déjalo vacío si ese cultivo no se maneja por camas."],
  [""],
  ["• Fenología:    etapas de cada cultivo (días de inicio y fin de cada etapa)."],
  ["                Por cada cultivo, agrega tantas filas como etapas tenga."],
  ["                Ejemplo para Maíz:"],
  ["                    Cultivo: Maíz, Etapa: Preparación de suelo, Día inicio: 0,  Día fin: 14"],
  ["                    Cultivo: Maíz, Etapa: Siembra,             Día inicio: 14, Día fin: 21"],
  ["                    Cultivo: Maíz, Etapa: Emergencia,          Día inicio: 21, Día fin: 40"],
  ["                    ... y así hasta cosecha."],
  ["                Importante: el 'Cultivo' debe escribirse igual que en la hoja 'Cultivos'."],
  [""],
  ["Notas importantes:"],
  [""],
  ["– Sólo se dan de alta los que no están: lo que ya existe con el mismo nombre no se toca ni se sobrescribe."],
  ["– Subir el mismo archivo dos veces no duplica nada."],
];

// ------------------------------------------------------------
//  GENERAR PLANTILLA EXCEL
// ------------------------------------------------------------
export function generarPlantilla() {
  const wb = XLSX.utils.book_new();

  // Hoja de instrucciones
  const wsInstr = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
  wsInstr["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  // Hojas de datos
  for (const [nombre, def] of Object.entries(HOJAS)) {
    const rows = [def.columnas, ...def.ejemplos];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Ancho de columnas razonable
    ws["!cols"] = def.columnas.map(c => ({ wch: Math.max(c.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }

  // Descargar
  XLSX.writeFile(wb, "AgroGestion-Plantilla.xlsx");
}

// ------------------------------------------------------------
//  LEER ARCHIVO EXCEL Y CONVERTIR A OBJETOS
// ------------------------------------------------------------
export async function leerExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const resultado = {};

  for (const [nombre, def] of Object.entries(HOJAS)) {
    const ws = wb.Sheets[nombre];
    if (!ws) { resultado[nombre] = []; continue; }
    // Leer como array de objetos usando los encabezados de la primera fila
    const filas = XLSX.utils.sheet_to_json(ws, { defval: "" });
    // Filtrar filas vacías (las que tienen todos los campos en blanco)
    const noVacias = filas.filter(f => Object.values(f).some(v => v !== "" && v !== null && v !== undefined));
    resultado[nombre] = noVacias;
  }
  // Una plantilla vieja trae la hoja «Cuentas» con contraseñas: NO se lee. Sólo se dice que se ignoró.
  resultado._ignoradas = wb.SheetNames.filter(n => /^cuentas$/i.test(String(n).trim()));
  return resultado;
}

// ------------------------------------------------------------
//  CONVERTIR datos del Excel → formato de la app
// ------------------------------------------------------------
export function excelAColecciones(datosExcel) {
  const out = {
    ranchos: [],
    parcelas: [],
    trabajadores: [],
    encargados: [],
    agronomos: [],
    cuadrillas: [],
    proveedores: [],
    cultivos: [],

  };

  // Parcelas
  (datosExcel.Parcelas || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.parcelas.push({
      id: `p_${(f["Ubicación"] || `p${i+1}`).toString().trim().toLowerCase().replace(/\s+/g, "_")}`,
      ranchoId: "r_agro",
      ubicacionId: (f["Ubicación"] || "").toString().trim(),
      nombre,
      cultivo: (f["Cultivo actual"] || "").toString().trim(),
      hectareas: parseFloat(f["Hectáreas"]) || 0,
      emoji: (f["Emoji"] || "🌾").toString().trim() || "🌾",
      notas: (f["Notas"] || "").toString().trim(),
      lat: null, lng: null, foto: null, cicloFenologico: [],
    });
  });

  // Trabajadores
  (datosExcel.Trabajadores || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.trabajadores.push({
      id: `t${unico()}${i}`,
      nombre,
      sueldo_dia: parseFloat(f["Sueldo diario"]) || 0,
      categoria: (f["Categoría"] || "General").toString().trim(),
      telefono: (f["Teléfono"] || "").toString().trim(),
      notas: (f["Notas"] || "").toString().trim(),
    });
  });

  // Encargados
  (datosExcel.Encargados || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.encargados.push({
      id: `en${unico()}${i}`,
      nombre,
      sueldo_dia: parseFloat(f["Sueldo diario"]) || 0,
      telefono: (f["Teléfono"] || "").toString().trim(),
      notas: (f["Notas"] || "").toString().trim(),
    });
  });

  // Agrónomos
  (datosExcel["Agrónomos"] || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.agronomos.push({
      id: `ag${unico()}${i}`,
      nombre,
      telefono: (f["Teléfono"] || "").toString().trim(),
      notas: (f["Notas"] || "").toString().trim(),
    });
  });

  // Cuadrillas
  (datosExcel.Cuadrillas || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.cuadrillas.push({
      id: `cq${unico()}${i}`,
      nombre,
      miembros: parseInt(f["Miembros"]) || 0,
      flete_dia: parseFloat(f["Flete diario"]) || 0,
      telefono: (f["Teléfono contacto"] || "").toString().trim(),
      notas: (f["Notas"] || "").toString().trim(),
    });
  });

  // Proveedores
  (datosExcel.Proveedores || []).forEach((f, i) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.proveedores.push({
      id: `pr${unico()}${i}`,
      nombre,
      telefono: (f["Teléfono"] || "").toString().trim(),
      direccion: (f["Dirección"] || "").toString().trim(),
      notas: (f["Notas"] || "").toString().trim(),
    });
  });

  // Cultivos (junta con fenología si hay)
  // Primero indexamos la fenología por nombre de cultivo
  const fenologiaPorCultivo = {};
  (datosExcel["Fenología"] || []).forEach(f => {
    const nombreCultivo = (f["Cultivo"] || "").toString().trim();
    if (!nombreCultivo) return;
    const etapa = (f["Etapa"] || "").toString().trim();
    if (!etapa) return;
    if (!fenologiaPorCultivo[nombreCultivo]) fenologiaPorCultivo[nombreCultivo] = [];
    fenologiaPorCultivo[nombreCultivo].push({
      etapa,
      diaInicio: parseInt(f["Día inicio"]) || 0,
      diaFin: parseInt(f["Día fin"]) || 0,
    });
  });
  // Ordenar las etapas de cada cultivo por día de inicio
  Object.keys(fenologiaPorCultivo).forEach(k => {
    fenologiaPorCultivo[k].sort((a, b) => a.diaInicio - b.diaInicio);
  });

  (datosExcel.Cultivos || []).forEach((f) => {
    const nombre = (f["Nombre"] || "").toString().trim();
    if (!nombre) return;
    out.cultivos.push({
      id: `cul_${nombre.toLowerCase().replace(/\s+/g, "_")}`,
      nombre,
      emoji: (f["Emoji"] || "🌱").toString().trim() || "🌱",
      duracionDias: parseInt(f["Duración total (días)"]) || 0,
      unidadCosecha: (f["Unidad de cosecha"] || "kg").toString().trim(),
      camasPorHa: parseFloat(f["Camas por hectárea"]) || 0,
      fenologia: fenologiaPorCultivo[nombre] || [],
    });
  });

  // La hoja «Cuentas» de una plantilla vieja no se lee (traía contraseñas): sólo se avisa.
  out.hojasIgnoradas = datosExcel._ignoradas || [];

  return out;
}

// ------------------------------------------------------------
//  VALIDAR datos antes de subir
//  Devuelve { ok: bool, errores: [...], advertencias: [...] }
// ------------------------------------------------------------
export function validar(colecciones) {
  const errores = [];
  const advertencias = [];

  if ((colecciones.hojasIgnoradas || []).length) advertencias.push("La hoja «Cuentas» no se usa: las cuentas se invitan en Arranque → Cuentas y cada persona pone su contraseña. Lo que traía esa hoja no se leyó.");
  for (const [lista, plural] of [[colecciones.trabajadores, "Trabajadores"], [colecciones.encargados, "Encargados"], [colecciones.cuadrillas, "Cuadrillas"]])
    if ((lista || []).length) advertencias.push(`${plural}: entran sin PIN. Se lo pones a cada quien en Equipo (no se puede repetir).`);

  // Validar coherencia de fenología con cultivos
  const nombresCultivos = new Set((colecciones.cultivos || []).map(c => c.nombre));
  (colecciones.cultivos || []).forEach(c => {
    if (c.fenologia && c.fenologia.length > 0) {
      // Verificar que las etapas no se traslapen ni tengan inicio mayor que fin
      c.fenologia.forEach(e => {
        if (e.diaFin < e.diaInicio) errores.push(`Fenología de "${c.nombre}" — etapa "${e.etapa}": día fin (${e.diaFin}) es menor que día inicio (${e.diaInicio})`);
        if (c.duracionDias > 0 && e.diaFin > c.duracionDias) advertencias.push(`Fenología de "${c.nombre}" — etapa "${e.etapa}" termina en día ${e.diaFin}, pero el cultivo dura ${c.duracionDias} días`);
      });
    } else if (c.fenologia && c.fenologia.length === 0) {
      advertencias.push(`Cultivo "${c.nombre}": sin etapas de fenología (no aparecerá su calendario)`);
    }
  });
  return { ok: errores.length === 0, errores, advertencias };
}


/* ════════════ EXPORTAR PÓLIZAS PARA CONTPAQi ════════════ */
/* Genera un Excel con formato de pólizas de diario para importar a ContPAQi.
   - Una póliza por día (todos los movimientos del día agrupados).
   - Cada movimiento es una línea con cuenta, cargo/abono, concepto y centro de
     costos (el cultivo). El usuario mapea las cuentas con su catálogo.
   El formato exacto de ContPAQi varía por empresa; este es un layout estándar de
   póliza de diario que el usuario puede ajustar a su catálogo. */

// movimientos: [{ fecha, tipo: "egreso"|"ingreso"|"costoMO", concepto, monto, cuenta, cultivo, contracuenta }]
export function exportarPolizas(movimientos, opciones = {}) {
  const { nombreEmpresa = "Agroselectos P&A", tipoPoliza = "Diario" } = opciones;

  // Agrupar por fecha (una póliza por día)
  const porDia = {};
  movimientos.forEach(m => {
    const f = m.fecha || "";
    if (!f) return;
    (porDia[f] = porDia[f] || []).push(m);
  });
  const dias = Object.keys(porDia).sort();

  // Encabezados estilo ContPAQi (hoja electrónica de pólizas)
  const filas = [[
    "No. Poliza", "Tipo", "Fecha", "Concepto Poliza",
    "Cuenta", "Concepto Movimiento", "Cargo", "Abono", "Centro Costos", "Referencia",
  ]];

  let numPoliza = 1;
  dias.forEach(dia => {
    const movs = porDia[dia];
    const conceptoPoliza = `Movimientos del ${dia}`;
    movs.forEach(m => {
      const monto = Math.abs(parseFloat(m.monto) || 0);
      // Egreso/costo: cargo a la cuenta de gasto, abono a la contracuenta (banco/caja/por pagar)
      // Ingreso: cargo a la contracuenta (banco/cliente), abono a la cuenta de ingreso
      const esIngreso = m.tipo === "ingreso";
      const cuentaPrincipal = m.cuenta || "";
      const contracuenta = m.contracuenta || "";
      if (esIngreso) {
        // Línea 1: cargo a contracuenta (lo que entra)
        filas.push([numPoliza, tipoPoliza, dia, conceptoPoliza, contracuenta, m.concepto || "", monto, 0, m.cultivo || "", m.referencia || ""]);
        // Línea 2: abono a cuenta de ingreso
        filas.push([numPoliza, tipoPoliza, dia, conceptoPoliza, cuentaPrincipal, m.concepto || "", 0, monto, m.cultivo || "", m.referencia || ""]);
      } else {
        // Gasto/costo: cargo a la cuenta de gasto
        filas.push([numPoliza, tipoPoliza, dia, conceptoPoliza, cuentaPrincipal, m.concepto || "", monto, 0, m.cultivo || "", m.referencia || ""]);
        // Abono a la contracuenta
        filas.push([numPoliza, tipoPoliza, dia, conceptoPoliza, contracuenta, m.concepto || "", 0, monto, m.cultivo || "", m.referencia || ""]);
      }
    });
    numPoliza++;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  // Anchos de columna
  ws["!cols"] = [
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 28 },
    { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Polizas");
  const fname = `polizas-contpaqi-${dias[0] || "export"}_a_${dias[dias.length - 1] || ""}.xlsx`;
  XLSX.writeFile(wb, fname);
  return { polizas: numPoliza - 1, movimientos: movimientos.length, archivo: fname };
}

// ------------------------------------------------------------
//  LEER UNA HOJA CRUDA (para el estado de cuenta del banco)
//
//  A diferencia de leerExcel(), que busca las hojas de la plantilla de la
//  app, esto abre el archivo tal como venga del banco: cada banco pone sus
//  columnas donde quiere, y quien decide qué es cada una es src/banco.js.
//
//  Muchos bancos ponen dos o tres renglones de membrete antes de los
//  encabezados. Por eso se busca el renglón que de verdad parece encabezado
//  (el que trae "fecha" y "saldo") en vez de suponer que es el primero.
// ------------------------------------------------------------
export async function leerHojaCruda(file, { hoja } = {}) {
  // Un CSV se lee como TEXTO, a mano. No se le pasa a la librería de Excel
  // porque ésta adivina las fechas a la americana: "12/08/2026" lo convierte
  // en 8 de diciembre, no en 12 de agosto. Un estado de cuenta de agosto
  // acabaría en diciembre y nadie se enteraría. En un .xlsx no hay ese
  // riesgo, porque ahí la fecha es un número serial sin ambigüedad.
  if (/\.csv$/i.test(file.name || "")) return leerCsvCrudo(await file.text());

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const nombre = hoja || wb.SheetNames[0];
  const ws = wb.Sheets[nombre];
  if (!ws) return { hojas: wb.SheetNames, encabezados: [], filas: [], porque: `El archivo no trae la hoja "${nombre}".` };

  const todas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const pareceEncabezado = (f) => {
    const t = f.map(c => String(c).toUpperCase());
    return t.some(c => c.includes("FECHA")) && t.some(c => c.includes("SALDO"));
  };
  let iEnc = todas.findIndex(pareceEncabezado);
  if (iEnc === -1) iEnc = 0;   // no se encontró: se usa el primero y banco.js dirá qué falta

  return {
    hojas: wb.SheetNames,
    hoja: nombre,
    encabezados: (todas[iEnc] || []).map(c => String(c).trim()),
    filas: todas.slice(iEnc + 1),
    renglonEncabezado: iEnc,
    porque: iEnc > 0 ? `Se saltaron ${iEnc} renglón(es) de membrete antes de los encabezados.` : null,
  };
}

// ------------------------------------------------------------
//  Leer una hoja COMPLETA, tal cual, sin buscarle encabezado.
//
//  `leerHojaCruda` de arriba busca el renglon que trae "fecha" y "saldo",
//  porque un estado de cuenta del banco viene con membrete encima. La hoja de
//  fertirriego de Fito no tiene ninguna de esas dos palabras: si se le aplica
//  esa busqueda, no encuentra nada, se queda con el primer renglon y tira la
//  cabecera con el cultivo y las hectareas. Sin las hectareas no se puede
//  comprobar la multiplicacion, y ahi se cae toda la validacion.
//
//  Por eso esta devuelve TODOS los renglones y no decide nada. Quien decide
//  que es cada renglon es src/fertiriego.js, que si conoce el formato.
// ------------------------------------------------------------
export async function leerHojaCompleta(file, { hoja } = {}) {
  // El CSV se lee como texto por lo mismo de siempre: la libreria de Excel
  // convierte "17/07/2026" en 7 de julio... o en 17 de julio, segun le
  // parezca, y sin avisar.
  if (/\.csv$/i.test(file.name || "")) {
    const r = leerCsvCrudo(await file.text());
    return { hojas: [], hoja: null, filas: [r.encabezados, ...r.filas].filter(f => f && f.length) };
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const nombre = hoja || wb.SheetNames[0];
  const ws = wb.Sheets[nombre];
  if (!ws) return { hojas: wb.SheetNames, hoja: nombre, filas: [], porque: `El archivo no trae la hoja "${nombre}".` };
  return {
    hojas: wb.SheetNames,
    hoja: nombre,
    filas: XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false })
      .map(f => f.map(c => String(c == null ? "" : c).trim())),
  };
}

// ------------------------------------------------------------
//  Partir un CSV a mano, respetando las comillas.
//
//  Por qué no se le pasa a la librería de Excel: ésa adivina las fechas a la
//  americana. "12/08/2026" lo convierte en 8 de DICIEMBRE, no en 12 de
//  agosto, y sin avisar. Un estado de cuenta de agosto acabaría fechado en
//  diciembre y nadie se enteraría. Aquí el texto se queda como texto y quien
//  interpreta la fecha es `aFecha`, que sabe que en México el día va primero.
//
//  En un .xlsx no hay ese riesgo: ahí la fecha es un número serial y no tiene
//  ambigüedad posible.
// ------------------------------------------------------------
function leerCsvCrudo(texto) {
  const partirRenglon = (linea) => {
    const celdas = [];
    let actual = "";
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; }
        else enComillas = !enComillas;
      } else if ((c === "," || c === ";") && !enComillas) {
        celdas.push(actual); actual = "";
      } else {
        actual += c;
      }
    }
    celdas.push(actual);
    return celdas.map(c => c.trim());
  };

  const lineas = String(texto || "").split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim() !== "");
  const todas = lineas.map(partirRenglon);
  const pareceEncabezado = (f) => {
    const t = f.map(c => String(c).toUpperCase());
    return t.some(c => c.includes("FECHA")) && t.some(c => c.includes("SALDO"));
  };
  let iEnc = todas.findIndex(pareceEncabezado);
  if (iEnc === -1) iEnc = 0;
  return {
    hojas: ["csv"], hoja: "csv",
    encabezados: todas[iEnc] || [],
    filas: todas.slice(iEnc + 1),
    renglonEncabezado: iEnc,
    porque: iEnc > 0 ? `Se saltaron ${iEnc} renglón(es) de membrete antes de los encabezados.` : null,
  };
}

