// ══════════════════════════════════════════════════════════════════════════
//  CAPTURAS QUE PARECEN LA MISMA, HECHAS DOS VECES
//
//  Cada registro tiene su identificador único, así que dos teléfonos nunca se pisan. Pero eso mismo quiere decir que
//  si dos personas capturan EL MISMO hecho, cada una en su teléfono (una sin señal, la otra por si acaso), quedan dos
//  registros legítimos para la base y el dinero o el producto cuenta dos veces. La app no puede saber si son el mismo
//  hecho o dos hechos iguales (dos cargas de diésel de $700 el mismo día existen): AVISA, dice quién capturó cada uno
//  y una persona decide — cancela el que sobra en su pantalla, o dice «son distintos» y el aviso se va.
//  No borra, no cancela y no descuenta nada solo.
// ══════════════════════════════════════════════════════════════════════════
import { vivos } from "./calculos.js";

const llano = (t) => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const quienDe = (r) => r?.registradoPor?.nombre || r?.quienes?.capturo?.nombre || r?.creadaPor?.nombre || "";
const pesos = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);

// Lo que la app crea sola a partir de otro registro no es una captura: su identidad ya viene de ese registro.
const esDerivado = (e) => !!(e.cajachicaId || e.solicitudId || e.aplicacionId || e.indicacionId || e.compraId || e.entradaInvId || e.embarqueId);

const CLASES = {
  gasto: { coleccion: "egresos", nombre: "Gasto", donde: "Finanzas → Egresos", sirve: (e) => !esDerivado(e) && Number(e.monto) > 0,
    llave: (e) => [e.fecha, pesos(e.monto), llano(e.concepto), e.parcelaId || "", e.vehiculoId || ""].join("|"), dice: (e) => `${e.concepto || "sin concepto"}`, importe: (e) => Number(e.monto) || 0 },
  ingreso: { coleccion: "ingresos", nombre: "Ingreso", donde: "Finanzas → Ingresos", sirve: (e) => !esDerivado(e) && Number(e.monto) > 0,
    llave: (e) => [e.fecha, pesos(e.monto), llano(e.concepto), llano(e.cliente)].join("|"), dice: (e) => `${e.concepto || e.cliente || "sin concepto"}`, importe: (e) => Number(e.monto) || 0 },
  entrada: { coleccion: "entradas_inv", nombre: "Entrada al almacén", donde: "Inventario → Entradas", sirve: (e) => Number(e.cantidad) > 0 && !e.esConteo && !String(e.id || "").startsWith("ei-sol-"),
    llave: (e) => [e.fecha, e.insumoId, Number(e.cantidad), pesos(e.costo_total)].join("|"), dice: (e, ctx) => `${Number(e.cantidad)} de ${ctx.articulo(e.insumoId)}`, importe: (e) => Number(e.costo_total) || 0 },
  aplicacion: { coleccion: "aplicaciones", nombre: "Aplicación", donde: "Aplicaciones", sirve: (a) => !!a.parcelaId && (a.productos || []).length > 0,
    llave: (a) => [a.fecha, a.parcelaId, (a.productos || []).map(p => `${p.insumoId || llano(p.nombre)}:${Number(p.total) || 0}`).sort().join(",")].join("|"),
    dice: (a, ctx) => `${(a.productos || []).map(p => p.nombre).join(", ")} en ${ctx.parcela(a.parcelaId)}`, importe: () => 0 },
};

// Devuelve los grupos de registros vivos que coinciden en todo lo que identifica al hecho. Un grupo que una persona ya
// revisó («son distintos») no vuelve a salir, a menos que aparezca otro registro igual después.
export function quizaRepetidos(data = {}) {
  const ctx = { articulo: (id) => (data.inventario || []).find(i => i.id === id)?.nombre || "un artículo", parcela: (id) => (data.parcelas || []).find(p => p.id === id)?.nombre || "una parcela" };
  const grupos = [];
  for (const [clase, c] of Object.entries(CLASES)) {
    const por = new Map();
    for (const r of vivos(data[c.coleccion] || [])) { if (!r || !r.fecha || !c.sirve(r)) continue; const k = c.llave(r); if (!por.has(k)) por.set(k, []); por.get(k).push(r); }
    for (const [k, lista] of por) {
      if (lista.length < 2) continue;
      const ids = lista.map(r => r.id).sort();
      if (lista.every(r => (r.distintoDe || []).length && ids.every(id => id === r.id || r.distintoDe.includes(id)))) continue;
      grupos.push({ clase, nombre: c.nombre, coleccion: c.coleccion, donde: c.donde, llave: `${clase}|${k}`, fecha: lista[0].fecha, dice: c.dice(lista[0], ctx), importe: c.importe(lista[0]),
        registros: lista.map(r => ({ id: r.id, quien: quienDe(r) })) });
    }
  }
  return grupos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// «Son distintos»: cada registro del grupo anota de cuáles se dijo que es distinto, y quién lo dijo. No cambia importes.
export function marcarDistintos(grupo, registros = [], quien = {}, fecha = "") {
  const ids = (grupo?.registros || []).map(r => r.id);
  return registros.filter(r => ids.includes(r.id)).map(r => ({ ...r, distintoDe: [...new Set([...(r.distintoDe || []), ...ids.filter(id => id !== r.id)])], distintoPor: { id: quien.id || "", nombre: quien.nombre || "", fecha } }));
}
