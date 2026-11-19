// Pruebas de los archivos fuera de la base, el medidor y la IA una sola vez.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  sha256Hex, partirDataUrl, sacarArchivos, esReferencia, leerReferencia, revisarArchivo,
  planDeCompresion, estadoDeConsumo, lecturaYaHecha, TOPE_ARCHIVO_BYTES,
} from "./archivos.js";

const foto = (semilla, n = 6000) => {
  const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + semilla) % 251;
  return "data:image/jpeg;base64," + b.toString("base64");
};

test("la_huella_es_la_misma_que_da_cualquier_otra_herramienta", () => {
  for (const texto of ["", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(64), "ticket de prueba ".repeat(4000)]) {
    const bytes = new TextEncoder().encode(texto);
    assert.equal(sha256Hex(bytes), createHash("sha256").update(bytes).digest("hex"), `largo ${texto.length}`);
  }
});

test("la_foto_sale_del_registro_y_queda_solo_la_referencia", () => {
  const f = foto(1);
  const { registro, archivos } = sacarArchivos({ id: "l1", monto: 100, foto: f, campos: { total: 100 } });
  assert.equal(archivos.length, 1);
  assert.ok(esReferencia(registro.foto));
  assert.equal(leerReferencia(registro.foto).id, archivos[0].id);
  assert.equal(archivos[0].ruta, archivos[0].id + ".jpg");
  assert.equal(archivos[0].bytes, 6000);
  assert.equal(registro.monto, 100); assert.deepEqual(registro.campos, { total: 100 });
  assert.ok(JSON.stringify(registro).length < 300, "el registro ya no carga la foto");
});

test("la_misma_foto_en_el_papel_y_en_el_egreso_se_guarda_una_sola_vez", () => {
  const f = foto(2);
  const { registro, archivos } = sacarArchivos({ foto: f, ticket: f, fotos: [{ id: 1, dataUrl: f }, { id: 2, dataUrl: foto(3) }] });
  assert.equal(archivos.length, 2);
  assert.equal(registro.foto, registro.ticket);
  assert.equal(registro.fotos[0].dataUrl, registro.foto);
  assert.notEqual(registro.fotos[1].dataUrl, registro.foto);
});

test("sacar_archivos_no_toca_el_registro_original_ni_lo_que_no_es_archivo", () => {
  const original = { foto: foto(4), nota: "data: no es una foto", icono: "data:image/png;base64,AAAA", ya: "archivo:abc.jpg" };
  const copia = JSON.stringify(original);
  const { registro, archivos } = sacarArchivos(original);
  assert.equal(JSON.stringify(original), copia);
  assert.equal(archivos.length, 1);
  assert.equal(registro.nota, original.nota);
  assert.equal(registro.icono, original.icono, "un icono chico no se saca");
  assert.equal(registro.ya, "archivo:abc.jpg", "lo que ya es referencia se queda igual");
});

test("una_foto_danada_no_se_pierde_se_queda_como_estaba", () => {
  const mala = "data:image/jpeg;base64," + "%%%".repeat(2000);
  const { registro, archivos } = sacarArchivos({ foto: mala });
  assert.equal(archivos.length, 0);
  assert.equal(registro.foto, mala);
  assert.equal(partirDataUrl("no es un archivo"), null);
});

test("un_archivo_que_no_sube_se_dice_por_que_y_se_queda_en_el_telefono", () => {
  assert.equal(revisarArchivo({ tipo: "image/jpeg", bytes: 300000 }).sube, true);
  const pesado = revisarArchivo({ tipo: "application/pdf", bytes: TOPE_ARCHIVO_BYTES + 1 });
  assert.equal(pesado.sube, false); assert.match(pesado.dice, /Se queda guardado en este teléfono/);
  assert.equal(revisarArchivo({ tipo: "video/mp4", bytes: 10 }).sube, false);
});

test("la_foto_se_achica_a_1600_y_la_chica_no_se_agranda", () => {
  assert.deepEqual(planDeCompresion({ ancho: 4000, alto: 3000 }), { ancho: 1600, alto: 1200, escala: 0.4 });
  assert.equal(planDeCompresion({ ancho: 800, alto: 600 }).escala, 1);
  assert.equal(planDeCompresion({}).escala, 1);
});

/* ──── El medidor ──── */
const MB = 1024 * 1024;
const limites = { base_mb: 500, archivos_mb: 1024, aviso_pct: 70, alto_pct: 85, tope_pct: 95, ia_llamadas_mes: 150, ia_centavos_mes: null };

test("sin_medicion_no_se_dice_que_todo_esta_bien", () => {
  const e = estadoDeConsumo(null);
  assert.equal(e.seSabe, false); assert.equal(e.peor, "sin dato");
  assert.match(e.dice, /No se pudo medir/);
});

test("el_medidor_avisa_antes_de_llenarse_y_dice_cuanto", () => {
  const bien = estadoDeConsumo({ base_bytes: 40 * MB, archivos_bytes: 100 * MB, limites, ia_mes: { llamadas: 10, centavos: 0 } });
  assert.equal(bien.peor, "bien"); assert.equal(bien.dice, "");
  const aviso = estadoDeConsumo({ base_bytes: 360 * MB, archivos_bytes: 100 * MB, limites });
  assert.equal(aviso.peor, "aviso"); assert.equal(aviso.tramos[0].pct, 72);
  const alto = estadoDeConsumo({ base_bytes: 40 * MB, archivos_bytes: 900 * MB, limites });
  assert.equal(alto.peor, "alto"); assert.match(alto.dice, /Fotos y PDF: 900 MB de 1024 MB \(88 %\)/);
  const lleno = estadoDeConsumo({ base_bytes: 40 * MB, archivos_bytes: 990 * MB, limites });
  assert.equal(lleno.archivosLlenos, true);
});

test("la_IA_lleva_su_propio_presupuesto_aparte_del_espacio", () => {
  const e = estadoDeConsumo({ base_bytes: 1, archivos_bytes: 1, limites, ia_mes: { llamadas: 150, centavos: 0 } });
  assert.equal(e.iaAgotada, true); assert.equal(e.archivosLlenos, false);
  const conPesos = estadoDeConsumo({ base_bytes: 1, archivos_bytes: 1, limites: { ...limites, ia_centavos_mes: 20000 }, ia_mes: { llamadas: 5, centavos: 19000 } });
  assert.equal(conPesos.tramos.length, 4); assert.equal(conPesos.tramos[3].nivel, "alto");
});

test("un_documento_ya_leido_no_se_vuelve_a_mandar_a_la_IA", () => {
  const lecturas = [
    { id: "l1", huella: "aaa", transcripcion: "TOTAL 100" },
    { id: "l2", huella: "bbb", transcripcion: "" },             // se guardó la foto pero nunca se leyó
    { id: "l3", huella: "ccc", transcripcion: "x", _borrado: "2026-01-01" },
  ];
  assert.equal(lecturaYaHecha("aaa", lecturas).id, "l1");
  assert.equal(lecturaYaHecha("bbb", lecturas), null);
  assert.equal(lecturaYaHecha("ccc", lecturas), null);
  assert.equal(lecturaYaHecha("zzz", lecturas), null);
  assert.equal(lecturaYaHecha(null, lecturas), null);
});
