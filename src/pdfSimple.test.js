import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfDeTexto, pdfComoDataUrl, partirRenglon } from "./pdfSimple.js";
import { partirDataUrl } from "./archivos.js";

const texto = (b) => Array.from(b, x => String.fromCharCode(x)).join("");

test("el_pdf_del_recibo_es_un_archivo_valido_con_su_tabla_de_objetos_en_su_lugar", () => {
  const t = texto(pdfDeTexto([{ t: "Recibo interno", tam: 14, negrita: true }, "Ana López (peón) · $2,400.00"]));
  assert.ok(t.startsWith("%PDF-1.4")); assert.ok(t.trimEnd().endsWith("%%EOF"));
  const xref = +/startxref\n(\d+)/.exec(t)[1]; assert.equal(t.slice(xref, xref + 4), "xref");
  const lugares = [...t.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map(m => +m[1]);
  lugares.forEach((d, i) => assert.equal(t.slice(d, d + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `el objeto ${i + 1} está donde dice la tabla`));
  assert.ok(t.includes("(Ana L\xf3pez \\(pe\xf3n\\) \xb7 $2,400.00) Tj"), "acentos en un byte y paréntesis escapados");
});

test("un_recibo_largo_pasa_a_otra_hoja_y_un_renglon_largo_se_parte_por_palabras", () => {
  const t = texto(pdfDeTexto(Array.from({ length: 120 }, (_, i) => `renglón ${i}`)));
  assert.match(t, /\/Count 3/);
  assert.deepEqual(partirRenglon("uno dos tres cuatro", 10, 40), ["uno dos", "tres", "cuatro"]);
});

test("el_pdf_sale_como_archivo_que_el_almacen_de_comprobantes_reconoce", () => {
  const p = partirDataUrl(pdfComoDataUrl(["hola"]));
  assert.equal(p.tipo, "application/pdf"); assert.equal(texto(p.bytes.subarray(0, 5)), "%PDF-");
});
