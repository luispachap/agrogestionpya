// Avisos al teléfono, del lado del aparato. Sin red: sólo lo que se puede comprobar aquí.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLASES_DE_AVISO, destinoDe, estadoDelAparato } from "./avisos.js";

test("un_aviso_solo_lleva_a_una_pantalla_conocida_y_nunca_trae_el_contenido", () => {
  assert.deepEqual(destinoDe("/?ir=chat&conv=ev-conv-1&msj=msj9"), { pagina: "chat", conversacion: "ev-conv-1", mensaje: "msj9" });
  assert.deepEqual(destinoDe("/?ir=deudas"), { pagina: "deudas", conversacion: null, mensaje: null });
  assert.equal(destinoDe("/?ir=arranque"), null, "una pantalla que no está en la lista no se abre por un aviso");
  assert.equal(destinoDe("/"), null); assert.equal(destinoDe("https://otro.sitio/?ir=chat").pagina, "chat", "sólo se toma el destino, nunca la dirección");
});

test("lo_obligatorio_no_se_puede_apagar_y_la_lista_es_la_misma_que_usa_el_servidor", () => {
  assert.deepEqual(CLASES_DE_AVISO.filter(c => c.obligatorio).map(c => c.clave), ["asignacion", "autorizacion"]);
  const servidor = readFileSync(new URL("../supabase/functions/avisar/nucleo.ts", import.meta.url), "utf8");
  for (const c of CLASES_DE_AVISO) assert.match(servidor, new RegExp(`${c.clave}: \\{ nombre: "[^"]+", obligatorio: ${c.obligatorio} \\}`), c.clave);
});

test("el_aparato_dice_con_palabras_por_que_no_puede_recibir_avisos", () => {
  assert.match(estadoDelAparato({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" } }).dice, /En Android usa Chrome/);
  assert.match(estadoDelAparato({ navigator: { userAgent: "iPhone" } }).dice, /pantalla de inicio/);
  const android = { navigator: { userAgent: "Android Chrome", serviceWorker: {} }, PushManager: function () {}, Notification: { permission: "denied" } };
  assert.equal(estadoDelAparato(android).bloqueado, true); assert.match(estadoDelAparato(android).dice, /Notificaciones → Permitir/);
  android.Notification.permission = "default";
  assert.deepEqual([estadoDelAparato(android).puede, /instalada/.test(estadoDelAparato(android).dice)], [true, true], "instalar no es requisito en Android, pero ayuda: se dice");
});

test("el_service_worker_ensena_el_aviso_lo_agrupa_y_al_tocarlo_abre_la_app_sin_traer_contenido", () => {
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /addEventListener\("push"/); assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /getNotifications\(\{ tag \}\)/, "agrupa por conversación"); assert.match(sw, /postMessage\(\{ tipo: "abrir", url \}\)/);
  assert.equal(/fetch\([^)]*supabase/.test(sw.slice(sw.indexOf("Avisos al teléfono"))), false, "el aviso no baja datos por su cuenta");
});
