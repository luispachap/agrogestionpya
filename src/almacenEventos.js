// ════════════════════════════════════════════════════════════════════════
//  DONDE VIVEN LOS EVENTOS EN EL APARATO
//
//  Todo lo demás de la app vive en un cajón de unos 5 MB que se reescribe
//  ENTERO en cada cambio. Con cien personas checando dos veces al día eso se
//  llena en meses, y mucho antes se vuelve lento: cada marca reescribiría todo.
//
//  Los eventos viven aparte, en el almacén grande del navegador (IndexedDB):
//  cabe cientos de megas, y cada evento se guarda SOLO, sin tocar los demás.
//  Es por espacio, igual que el cajón: lo de otro proyecto no se mezcla.
//
//  Si el aparato no da ese almacén (un navegador en modo privado), devuelve
//  null y la app sigue guardando como antes — y lo dice.
// ════════════════════════════════════════════════════════════════════════
const pedir = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

export async function abrirAlmacenDeEventos(nombre) {
  if (typeof indexedDB === "undefined") return null;
  let db;
  try {
    const abre = indexedDB.open(nombre, 1);
    abre.onupgradeneeded = () => {
      abre.result.createObjectStore("eventos", { keyPath: "id" });
      abre.result.createObjectStore("meta");
    };
    db = await pedir(abre);
  } catch { return null; }
  const hecho = (tx) => new Promise((ok, mal) => { tx.oncomplete = () => ok(true); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error); });
  return {
    leer: () => pedir(db.transaction("eventos").objectStore("eventos").getAll()),
    // Guarda sólo los que se le pasan. Poner dos veces el mismo es el mismo renglón.
    guardar: (lista) => { const tx = db.transaction("eventos", "readwrite"); const s = tx.objectStore("eventos"); for (const e of lista) s.put(e); return hecho(tx); },
    meta: (clave) => pedir(db.transaction("meta").objectStore("meta").get(clave)),
    ponMeta: (clave, valor) => { const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put(valor, clave); return hecho(tx); },
    cuantos: () => pedir(db.transaction("eventos").objectStore("eventos").count()),
    cerrar: () => db.close(),
  };
}
export const borrarAlmacenDeEventos = (nombre) => new Promise((ok) => {
  if (typeof indexedDB === "undefined") return ok(false);
  const r = indexedDB.deleteDatabase(nombre); r.onsuccess = () => ok(true); r.onerror = () => ok(false); r.onblocked = () => ok(false);
});
