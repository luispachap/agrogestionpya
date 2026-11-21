// WhatsApp como otra puerta: preparado y sin activar. Todo con teléfonos y personas inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensajesDeAviso, directorio, quienEscribe, recibir, ventana, respuestaPara, claveDeTelefono, idDeMensaje, ESTADO_WHATSAPP } from "./whatsapp.js";
import { entenderLoDicho } from "./voz.js";
import { preparar, ejecutar } from "./operaciones.js";

const parcelas = [{ id: "sf4", nombre: "San Felipe 4" }];
const data = { encargados: [{ id: "enc1", nombre: "Capataz Inventado", telefono: "449 555 0101" }], agronomos: [{ id: "ag1", nombre: "Agrónomo Inventado", telefono: "+52 1 449 555 0102" }],
  trabajadores: [{ id: "t1", nombre: "Trabajador Inventado", telefono: "4495550103" }, { id: "t2", nombre: "Sin Teléfono" }, { id: "t3", nombre: "De Baja", telefono: "4495550109", activo: false }] };
const aviso = (...mensajes) => ({ object: "whatsapp_business_account", entry: [{ id: "cuenta", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "numero-del-rancho" }, contacts: mensajes.map(m => ({ wa_id: m.from, profile: { name: "Nombre en WhatsApp" } })), messages: mensajes } }] }] });
const texto = (from, body, id = "wamid.AAA1", timestamp = "1795442400") => ({ from, id, timestamp, type: "text", text: { body } });

test("whatsapp_esta_preparado_pero_apagado_y_este_archivo_no_manda_nada", () => {
  assert.equal(ESTADO_WHATSAPP.activo, false);
  const fuente = readFileSync(new URL("./whatsapp.js", import.meta.url), "utf8");
  assert.equal(/\bfetch\s*\(|graph\.facebook|XMLHttpRequest|^import /m.test(fuente), false, "ni red ni dependencias: sólo entiende lo que llega");
});

test("el_mismo_celular_llega_como_52_o_521_y_es_la_misma_persona", () => {
  assert.equal(claveDeTelefono("5214495550101"), "4495550101"); assert.equal(claveDeTelefono("524495550101"), "4495550101"); assert.equal(claveDeTelefono("12345"), "");
  const dir = directorio(data);
  assert.deepEqual(dir.map(p => [p.id, p.rol]), [["enc1", "encargado"], ["ag1", "agronomo"], ["t1", "trabajador"]], "quien no tiene teléfono o está de baja no entra al directorio");
  assert.deepEqual(quienEscribe("5214495550102", dir).persona, { id: "ag1", nombre: "Agrónomo Inventado", rol: "agronomo" });
});

test("un_telefono_desconocido_o_repetido_no_se_le_atribuye_a_nadie", () => {
  const dir = directorio(data);
  assert.equal(quienEscribe("5214490000000", dir).motivo, "desconocido");
  const doble = [...dir, { id: "t9", nombre: "Otro Inventado", rol: "trabajador", telefono: "4495550101" }];
  const r = quienEscribe("5214495550101", doble); assert.equal(r.ok, false); assert.equal(r.motivo, "repetido"); assert.match(r.dice, /no se escoge a una/);
  const rec = recibir({ cuerpo: aviso(texto("5214490000000", "Hola")), personas: dir });
  assert.equal(rec.nuevos.length, 0); assert.deepEqual([rec.sinDueno[0].motivo, rec.sinDueno[0].telefonoTermina], ["desconocido", "0000"], "se dice que llegó, sin copiar el teléfono completo");
});

test("un_mensaje_de_whatsapp_entra_por_el_mismo_camino_que_lo_dicho_en_la_app", () => {
  const dir = directorio(data);
  const rec = recibir({ cuerpo: aviso(texto("5214495550101", "Hoy terminamos dos reguladores de deshierbe en San Felipe 4. Trabajaron siete personas.")), personas: dir });
  assert.equal(rec.nuevos.length, 1); const m = rec.nuevos[0];
  assert.deepEqual([m.canal, m.de.id, m.de.rol, m.id], ["whatsapp", "enc1", "encargado", "wa-wamid.AAA1".replace(/[^A-Za-z0-9_-]/g, "")]);
  const plan = preparar({ mensaje: m, entendido: entenderLoDicho({ texto: m.texto, personas: [], parcelas, insumos: [], hoy: "2026-11-23" }) });
  assert.deepEqual([plan.propuestas.length, plan.propuestas[0].tipo, plan.propuestas[0].lista], [1, "avance", true]);
  const r = ejecutar(plan.propuestas[0], { mensaje: m, quien: m.de, cuando: m.cuando, fecha: "2026-11-23", parcelas });
  assert.equal(r.ok, true); assert.equal(r.escrituras[0].registro.datos.origenDicho.canal, "whatsapp");
  assert.match(respuestaPara(plan).texto, /listo para confirmar/); assert.equal(respuestaPara(plan).seEnvia, false);
});

test("whatsapp_no_da_permisos_un_trabajador_que_escribe_un_gasto_no_lo_registra", () => {
  const dir = directorio(data);
  const m = recibir({ cuerpo: aviso(texto("5214495550103", "Compramos un kilo de clavos, 350 pesos.")), personas: dir }).nuevos[0];
  const plan = preparar({ mensaje: m, entendido: entenderLoDicho({ texto: m.texto, personas: [], parcelas, insumos: [], hoy: "2026-11-23" }) });
  const gasto = plan.propuestas.find(p => p.tipo === "gasto"); assert.ok(gasto);
  assert.equal(gasto.permiso.puede, false); assert.equal(ejecutar(gasto, { mensaje: m, quien: m.de, cuando: m.cuando, fecha: "2026-11-23", parcelas }).sinPermiso, true);
  assert.match(respuestaPara(plan).texto, /queda anotado para revisión/);
});

test("el_mismo_mensaje_entregado_dos_veces_entra_una_sola_vez", () => {
  const dir = directorio(data), cuerpo = aviso(texto("5214495550101", "Se descompuso la bomba."), texto("5214495550101", "Se descompuso la bomba."));
  const a = recibir({ cuerpo, personas: dir }); assert.deepEqual([a.nuevos.length, a.repetidos.length], [1, 1], "dos veces en el mismo aviso");
  const b = recibir({ cuerpo: aviso(texto("5214495550101", "Se descompuso la bomba.")), personas: dir, yaRecibidos: [idDeMensaje("wamid.AAA1")] });
  assert.deepEqual([b.nuevos.length, b.repetidos.length], [0, 1], "y otra vez cuando Meta reintenta");
});

test("una_nota_de_voz_o_una_foto_se_reciben_pero_no_se_dan_por_entendidas", () => {
  const dir = directorio(data);
  const voz = { from: "5214495550101", id: "wamid.VOZ", timestamp: "1795442400", type: "audio", audio: { id: "medio-1", mime_type: "audio/ogg; codecs=opus", voice: true } };
  const foto = { from: "5214495550102", id: "wamid.FOTO", timestamp: "1795442401", type: "image", image: { id: "medio-2", mime_type: "image/jpeg", caption: "ticket de la ferretería" } };
  const r = recibir({ cuerpo: aviso(voz, foto), personas: dir });
  assert.deepEqual(r.nuevos.map(m => [m.whatsapp.clase, m.pendienteDe, m.texto]), [["audio", "transcribir", ""], ["foto", "leer", "ticket de la ferretería"]]);
  assert.equal(r.nuevos[0].whatsapp.medio.esNotaDeVoz, true);
});

test("lo_que_no_es_un_aviso_de_whatsapp_o_viene_incompleto_no_se_inventa", () => {
  assert.equal(mensajesDeAviso({ object: "otra_cosa" }).valido, false);
  const r = mensajesDeAviso(aviso({ from: "5214495550101", type: "text", text: { body: "sin id ni hora" } }));
  assert.deepEqual([r.mensajes.length, r.ignorados], [0, 1]);
  const est = mensajesDeAviso({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "wamid.X", status: "delivered", timestamp: "1795442400", recipient_id: "5214495550101" }] } }] }] });
  assert.deepEqual([est.mensajes.length, est.estados[0].estado], [0, "delivered"], "un acuse de entrega no es un mensaje de nadie");
});

test("pasadas_24_horas_solo_se_puede_iniciar_con_plantilla", () => {
  assert.equal(ventana("2026-11-23T14:00:00.000Z", "2026-11-24T13:59:00.000Z").abierta, true);
  const cerrada = ventana("2026-11-23T14:00:00.000Z", "2026-11-24T14:00:01.000Z"); assert.equal(cerrada.abierta, false); assert.match(cerrada.dice, /plantilla/);
  assert.equal(ventana(null, "2026-11-24T14:00:00.000Z").abierta, false);
  assert.equal(respuestaPara({ propuestas: [] }, { ventanaAbierta: false }).requierePlantilla, true);
});
