// ============================================================
//  AgroGestión — Leer un PDF
//
//  ─────────────────────────────────────────────────────────────
//  POR QUÉ SE CARGA APARTE, Y NO CON LA APP
//  ─────────────────────────────────────────────────────────────
//  El lector de PDF pesa cerca de un mega, encima de un paquete que ya pesa
//  1.5 MB, en teléfonos con internet intermitente. Si viniera dentro de la
//  app, TODOS pagarían esa descarga cada vez —el tractorista que sólo captura
//  diésel, el que pasa lista— aunque nunca abran un PDF.
//
//  Por eso se carga con `import()` dinámico: el navegador lo baja **la
//  primera vez que alguien abre un PDF**, y de ahí queda en su caché. Quien
//  no lea PDFs nunca lo descarga.
//
//  Y por eso mismo, si no hay señal, lo DICE en vez de quedarse pensando: sin
//  el lector no hay PDF que leer, y esa es una respuesta legítima.
//
//  ─────────────────────────────────────────────────────────────
//  DOS CLASES DE PDF, Y NO SE CONFUNDEN
//  ─────────────────────────────────────────────────────────────
//  1. **Con capa de texto** (el que baja del portal del banco, el que manda
//     el contador). El texto está adentro: se saca EXACTO, gratis y sin IA.
//     Es el caso bueno y es el más común.
//  2. **Escaneado** (una foto metida en un PDF). No trae texto: sale vacío.
//     Eso NO se calla — se dice que es un escaneo y se ofrece leerlo como
//     foto, que es lo que de verdad es.
//
//  Sus pruebas están en src/pdf.test.js (las de la parte que no necesita
//  navegador: decidir qué clase de PDF es y armar los renglones).
// ============================================================

/* ════════════ SACAR EL TEXTO ════════════ */

let _pdfjs = null;

// Carga el lector una sola vez. Si falla —sin señal, por ejemplo— devuelve el
// porqué en vez de reventar.
async function cargarLector() {
  if (_pdfjs) return { ok: true, pdfjs: _pdfjs };
  try {
    const mod = await import("pdfjs-dist");
    // El worker viene del mismo paquete: no se pide a ningún CDN, así que
    // una vez descargado funciona sin señal.
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    mod.GlobalWorkerOptions.workerSrc = workerUrl;
    _pdfjs = mod;
    return { ok: true, pdfjs: mod };
  } catch (e) {
    return {
      ok: false,
      dice: `No se pudo cargar el lector de PDF (${e?.message || e}). Necesita señal la primera vez; después ya funciona sin internet. Mientras tanto puedes subir el Excel, el CSV o una foto.`,
    };
  }
}

// Convierte los pedazos de texto que devuelve el lector en RENGLONES, usando
// la posición vertical de cada pedazo.
//
// Importa: un estado de cuenta en PDF es una tabla, y si todo el texto se
// junta en una sola línea se pierde qué número va con qué movimiento. Los
// pedazos que están a la misma altura son el mismo renglón.
export function armarFilas(pedazos, { tolerancia = 3 } = {}) {
  const filas = [];
  for (const p of pedazos || []) {
    if (!p || !String(p.texto ?? "").trim()) continue;
    const y = Math.round(p.y);
    let fila = filas.find(f => Math.abs(f.y - y) <= tolerancia);
    if (!fila) { fila = { y, celdas: [] }; filas.push(fila); }
    fila.celdas.push({ x: p.x, texto: String(p.texto).trim() });
  }
  return filas
    .sort((a, b) => b.y - a.y)                        // de arriba hacia abajo
    .map(f => ({ ...f, celdas: f.celdas.sort((a, b) => a.x - b.x) }))
    .filter(f => f.celdas.length > 0);
}

// Los mismos renglones, ya como texto corrido. Para el buzón de papeles, que
// lo que quiere es el texto de la factura, no su tabla.
export function armarRenglones(pedazos, opciones) {
  return armarFilas(pedazos, opciones)
    .map(f => f.celdas.map(c => c.texto).join(" ").replace(/\s+/g, " ").trim())
    .filter(t => t !== "");
}

// ¿Este PDF trae texto de verdad, o es una foto metida en un PDF?
//
// Ojo con el umbral: un estado de cuenta de un mes flojo trae cinco
// movimientos, y llamarlo "escaneo" por tener pocos renglones sería
// rechazar un archivo perfectamente bueno. Un escaneo de verdad trae CERO
// texto, o dos palabras sueltas del membrete — no ocho renglones.
//
// Y de todos modos esto es sólo una primera impresión: quien decide de
// verdad es si se encuentran las columnas (`detectarColumnas`). Medir la
// cosa vale más que medir un parecido de la cosa.
export function claseDePdf({ renglones, paginas, minimoPorPagina = 3 }) {
  const n = (renglones || []).length;
  const p = Math.max(1, paginas || 1);
  const porPagina = n / p;
  if (porPagina >= minimoPorPagina) {
    return { clase: "con texto", legible: true, renglones: n, paginas: p, dice: `El PDF trae su texto adentro: se lee exacto, sin IA y sin señal.` };
  }
  return {
    clase: "escaneado", legible: false, renglones: n, paginas: p,
    // No se calla ni devuelve un archivo vacío: se dice qué es y qué hacer.
    dice: n === 0
      ? "Este PDF no trae texto: es un escaneo (una foto metida en un PDF). Se puede leer como foto."
      : `Este PDF casi no trae texto (${n} renglón(es) en ${p} página(s)): parece un escaneo. Se puede leer como foto.`,
  };
}

// Lee un PDF y devuelve sus renglones. NO decide qué son: eso lo hacen
// banco.js o lectura.js, según lo que sea el papel.
export async function leerPdf(file, { maxPaginas = 40 } = {}) {
  const lector = await cargarLector();
  if (!lector.ok) return { ok: false, motivo: "sin_lector", dice: lector.dice };

  try {
    const datos = new Uint8Array(await file.arrayBuffer());
    const doc = await lector.pdfjs.getDocument({ data: datos, disableWorker: false }).promise;
    const paginas = Math.min(doc.numPages, maxPaginas);
    let filas = [];
    for (let i = 1; i <= paginas; i++) {
      const pag = await doc.getPage(i);
      const contenido = await pag.getTextContent();
      const pedazos = contenido.items.map(it => ({
        texto: it.str,
        x: it.transform[4],
        y: it.transform[5],
      }));
      filas = filas.concat(armarFilas(pedazos));
    }
    // Se devuelven las dos formas: las FILAS con posición (para armar la tabla
    // de un estado de cuenta, donde la geometría ES la información de
    // columnas) y los renglones de texto (para el buzón de papeles, que lo
    // que quiere es el texto de la factura).
    const renglones = filas
      .map(f => f.celdas.map(c => c.texto).join(" ").replace(/\s+/g, " ").trim())
      .filter(t => t !== "");
    const clase = claseDePdf({ renglones, paginas });
    return {
      ok: true,
      ...clase,
      filas,
      renglones,
      texto: renglones.join("\n"),
      paginasTotales: doc.numPages,
      recortado: doc.numPages > maxPaginas
        ? `El PDF tiene ${doc.numPages} páginas y se leyeron las primeras ${maxPaginas}.`
        : null,
    };
  } catch (e) {
    return { ok: false, motivo: "no_se_pudo", dice: `No se pudo abrir el PDF (${e?.message || e}). Puedes subir el Excel, el CSV o una foto.` };
  }
}

// Las primeras páginas de un PDF escaneado, como imágenes: es lo que se le manda a la IA cuando el PDF no trae texto.
// Se dibujan aquí, en el aparato, y a lo más de `lado` pixeles por el lado largo: más grande sólo cuesta más.
export async function paginasComoImagenes(file, { maxPaginas = 3, lado = 1568, calidad = 0.8 } = {}) {
  const lector = await cargarLector();
  if (!lector.ok) return { ok: false, dice: lector.dice };
  try {
    const doc = await lector.pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, imagenes = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxPaginas); i++) {
      const pag = await doc.getPage(i), base = pag.getViewport({ scale: 1 }), escala = Math.min(2.5, lado / Math.max(base.width, base.height));
      const vista = pag.getViewport({ scale: escala }), lienzo = document.createElement("canvas");
      lienzo.width = Math.round(vista.width); lienzo.height = Math.round(vista.height);
      await pag.render({ canvasContext: lienzo.getContext("2d"), viewport: vista }).promise;
      imagenes.push({ tipoMedio: "image/jpeg", base64: lienzo.toDataURL("image/jpeg", calidad).split(",")[1] });
    }
    return { ok: true, imagenes, paginasTotales: doc.numPages };
  } catch (e) { return { ok: false, dice: `No se pudo preparar el PDF para leerlo (${e?.message || e}).` }; }
}

/* ════════════ DE RENGLONES A COLUMNAS ════════════ */

// Un estado de cuenta en PDF ES una tabla, y el PDF ya trae la posición X de
// cada celda. Ésa es la información de columnas de verdad: no hay que
// adivinarla contando espacios.
//
// Se toma la X de cada encabezado, se parten los límites a la mitad entre uno
// y otro, y cada celda cae en la columna que le toca por dónde está. Así
// funciona igual con importes alineados a la derecha, que es como los pone
// cualquier banco.
export function columnasPorPosicion(filaEncabezado, filas) {
  const anclas = filaEncabezado.celdas.map(c => c.x);
  if (anclas.length < 2) return null;
  // Frontera entre la columna i y la i+1: a la mitad del camino.
  const limites = anclas.slice(0, -1).map((x, i) => (x + anclas[i + 1]) / 2);
  const columnaDe = (x) => {
    let i = 0;
    while (i < limites.length && x >= limites[i]) i++;
    return i;
  };
  return filas.map(f => {
    const celdas = Array(anclas.length).fill("");
    for (const c of f.celdas) {
      const i = columnaDe(c.x);
      celdas[i] = celdas[i] ? `${celdas[i]} ${c.texto}` : c.texto;
    }
    return celdas;
  });
}

// Cuando un PDF entrega cada renglón como UN solo pedazo de texto (pasa con
// algunos generadores), no hay posiciones que usar y hay que caer al plan B:
// partir por los espacios grandes, que es donde estaban las columnas.
//
// Si ni así se puede partir, el renglón se deja entero y que la validación
// aritmética decida: es preferible que el archivo no cuadre y se rechace, a
// partirlo mal y creerle.
export function partirEnColumnas(renglones, { minimoEspacios = 2 } = {}) {
  return (renglones || []).map(r => {
    const celdas = String(r).split(new RegExp(`\\s{${minimoEspacios},}`)).map(c => c.trim()).filter(c => c !== "");
    return celdas.length > 1 ? celdas : [String(r).trim()];
  });
}

// Encuentra el renglón que hace de encabezado (el que trae "fecha" y "saldo")
// y devuelve el archivo ya con la misma forma que da leerHojaCruda, para que
// banco.js no note la diferencia entre un Excel y un PDF — y le aplique la
// MISMA validación aritmética.
//
// Acepta las filas con posiciones (lo normal) o una lista de textos (el plan B).
export function comoHoja(entrada) {
  const conPosicion = Array.isArray(entrada) && entrada.length > 0 && entrada[0] && Array.isArray(entrada[0].celdas);

  if (conPosicion) {
    const pareceEncabezado = (f) => {
      const t = f.celdas.map(c => c.texto.toUpperCase()).join(" ");
      return t.includes("FECHA") && t.includes("SALDO");
    };
    const iEnc = entrada.findIndex(pareceEncabezado);
    if (iEnc !== -1) {
      const enc = entrada[iEnc];
      const cuerpo = entrada.slice(iEnc + 1);
      const porPos = columnasPorPosicion(enc, cuerpo);
      if (porPos) {
        return {
          hojas: ["pdf"], hoja: "pdf",
          encabezados: enc.celdas.map(c => c.texto),
          filas: porPos,
          renglonEncabezado: iEnc,
          porque: iEnc > 0 ? `Se saltaron ${iEnc} renglón(es) antes de los encabezados.` : null,
        };
      }
    }
    // El encabezado vino en un solo pedazo: se sigue por el plan B.
    entrada = entrada.map(f => f.celdas.map(c => c.texto).join("   "));
  }

  const filas = partirEnColumnas(entrada);
  const pareceEncabezado = (f) => {
    const t = f.map(c => String(c).toUpperCase());
    return t.some(c => c.includes("FECHA")) && t.some(c => c.includes("SALDO"));
  };
  let iEnc = filas.findIndex(pareceEncabezado);
  if (iEnc === -1) iEnc = 0;
  return {
    hojas: ["pdf"], hoja: "pdf",
    encabezados: filas[iEnc] || [],
    filas: filas.slice(iEnc + 1),
    renglonEncabezado: iEnc,
    porque: iEnc > 0 ? `Se saltaron ${iEnc} renglón(es) antes de los encabezados.` : null,
  };
}
