// ════════════════════════════════════════════════════════════════════════
//  UN PDF DE PURO TEXTO, hecho aquí mismo
//
//  Para conservar un recibo como ARCHIVO no hace falta una librería de medio
//  mega: un recibo son renglones de texto. Esto arma un PDF mínimo (letra
//  Helvetica, que todo lector trae) y funciona sin señal. No dibuja logos ni
//  tablas: eso sigue saliendo por «Imprimir».
// ════════════════════════════════════════════════════════════════════════
const ANCHO = 612, ALTO = 792, MARGEN = 54;
// A la codificación del PDF (WinAnsi ≈ Latin-1). Lo que no exista ahí se cambia por "?".
const aLatin = (s) => Array.from(String(s ?? "")).map(c => { const n = c.codePointAt(0); return n === 0x2212 || n === 0x2013 || n === 0x2014 ? "-" : n === 0x2022 ? "\xb7" : n > 255 ? "?" : c; }).join("");
const escapar = (s) => aLatin(s).replace(/[\\()]/g, m => "\\" + m);
// Parte un renglón largo por palabras. El ancho es aproximado (medio tamaño por letra): sobra para un recibo.
export function partirRenglon(texto, tam, ancho = ANCHO - 2 * MARGEN) {
  const tope = Math.max(10, Math.floor(ancho / (tam * 0.52))), salen = []; let va = "";
  for (const p of String(texto ?? "").split(/\s+/)) {
    if (!va) va = p; else if ((va + " " + p).length <= tope) va += " " + p; else { salen.push(va); va = p; }
    while (va.length > tope) { salen.push(va.slice(0, tope)); va = va.slice(tope); }
  }
  salen.push(va); return salen;
}
// `renglones`: [{ t, tam = 10, negrita = false, espacio = 0 }] o cadenas. Devuelve los bytes del PDF.
export function pdfDeTexto(renglones) {
  const paginas = [[]]; let y = ALTO - MARGEN;
  for (const r0 of renglones || []) {
    const r = typeof r0 === "string" ? { t: r0 } : r0, tam = r.tam || 10;
    y -= r.espacio || 0;
    for (const linea of partirRenglon(r.t, tam)) {
      if (y - tam < MARGEN) { paginas.push([]); y = ALTO - MARGEN; }
      y -= tam * 1.35;
      paginas[paginas.length - 1].push(`BT /${r.negrita ? "F2" : "F1"} ${tam} Tf ${MARGEN} ${y.toFixed(1)} Td (${escapar(linea)}) Tj ET`);
    }
  }
  const objs = [];                         // objs[i] = cuerpo del objeto i+1
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(null);                         // las páginas, al final (hay que saber cuántas)
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const hijos = [];
  for (const p of paginas) {
    const cont = p.join("\n");
    objs.push(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length} 0 R >>`);
    hijos.push(`${objs.length} 0 R`);
  }
  objs[1] = `<< /Type /Pages /Kids [${hijos.join(" ")}] /Count ${hijos.length} >>`;
  let sale = "%PDF-1.4\n"; const donde = [];
  objs.forEach((o, i) => { donde.push(sale.length); sale += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = sale.length;
  sale += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${donde.map(d => String(d).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(sale.length);
  for (let i = 0; i < sale.length; i++) bytes[i] = sale.charCodeAt(i) & 255;   // todo es Latin-1: un carácter, un byte
  return bytes;
}
export function pdfComoDataUrl(renglones) {
  const b = pdfDeTexto(renglones); let bin = "";
  for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return `data:application/pdf;base64,${btoa(bin)}`;
}
