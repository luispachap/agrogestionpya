// ════════════════════════════════════════════════════════════════════════
//  CIERRE DE MES — la foto de los costos
//
//  Los costos se CALCULAN de lo registrado, así que una compra capturada
//  tarde, una asistencia que se aclara o una regla que cambia mueven las
//  cifras de un mes que ya se había revisado. Cerrar el mes guarda cómo
//  quedaron ESE día (parcela por parcela: directo, indirecto y completo, más
//  lo pendiente de distribuir). Lo que cambie después NO toca la foto: se
//  enseña como ajuste posterior, y las cifras originales se pueden consultar
//  siempre. Reabrir pide motivo; cerrar otra vez es una versión nueva.
//  Cierra quien tiene ese permiso (lo comprueba la base, como todo lo sensible).
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero } from "./calculos.js";
import { indirectoDe } from "./indirectos.js";

export const T_CIERRE_MES = "cierre_mes", T_REAPERTURA_MES = "reapertura_mes";
const limpio = (s) => String(s || "").trim();
const esMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || "");
const finDe = (mes) => `${mes}-${String(new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;

// Lo que costó un mes, parcela por parcela, tal como sale HOY de lo registrado.
//   actividades   las que ya cuentan (`actividadesContables`), con `costoTotal`
//   egresos       los vivos (sin cancelados);  compras: las aprobadas
//   indirectos    lo que devuelve `juntarFuentes`
export function costoDelMes({ mes, parcelas = [], actividades = [], egresos = [], compras = [], indirectos = null }) {
  const desde = `${mes}-01`, hasta = finDe(mes), enMes = (f) => !!f && f >= desde && f <= hasta;
  const dir = new Map();
  const pon = (id, monto) => { if (id && monto) dir.set(id, sumarDinero(dir.get(id) || 0, monto)); };
  for (const a of actividades) if (enMes(a.fecha)) pon(a.parcelaId, Number(a.costoTotal) || 0);
  for (const e of egresos) if (enMes(e.fecha)) pon(e.parcelaId, Number(e.monto) || 0);
  for (const c of compras) if (c.estado === "aprobada" && enMes(c.fecha)) pon(c.parcelaId, Number(c.monto) || 0);
  const ids = new Set([...dir.keys(), ...(indirectos?.partes || []).filter(p => enMes(p.fecha)).map(p => p.parcelaId)]);
  const nombre = new Map(parcelas.map(p => [p.id, p.nombre]));
  const renglones = [...ids].map(id => {
    const directo = dir.get(id) || 0, indirecto = indirectoDe(indirectos, { parcelaIds: [id], desde, hasta }).total;
    return { parcelaId: id, nombre: nombre.get(id) || "Parcela que ya no está en el catálogo", directo, indirecto, completo: sumarDinero(directo, indirecto) };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const pend = (indirectos?.pendientes || []).filter(p => enMes(p.fecha));
  const fuera = (indirectos?.noProduccion || []).flatMap(x => x.detalle || []).filter(p => enMes(p.fecha));
  return { mes, renglones, directo: sumarDinero(renglones.map(r => r.directo)), indirecto: sumarDinero(renglones.map(r => r.indirecto)), completo: sumarDinero(renglones.map(r => r.completo)),
    pendiente: sumarDinero(pend.map(p => p.monto)), pendientes: pend.length, noProduccion: sumarDinero(fuera.map(p => p.monto)) };
}

const deEseMes = (eventos, tipo, mes) => vigentes(eventos).filter(e => e.tipo === tipo && e.datos.mes === mes).sort((a, b) => a.cuando.localeCompare(b.cuando));
export function estadoDeMes(eventos, mes) {
  const cierres = deEseMes(eventos, T_CIERRE_MES, mes).map((e, i) => ({ ...e, version: i + 1 })), reaperturas = deEseMes(eventos, T_REAPERTURA_MES, mes);
  const ultimo = cierres[cierres.length - 1] || null, reap = reaperturas[reaperturas.length - 1] || null;
  return { estado: !ultimo ? "abierto" : reap && reap.cuando > ultimo.cuando ? "reabierto" : "cerrado", cierre: ultimo, cierres, reaperturas };
}
export const mesesCerrados = (eventos) => [...new Set(vigentes(eventos).filter(e => e.tipo === T_CIERRE_MES).map(e => e.datos.mes))].sort();

// `costo`: lo que devuelve `costoDelMes` en ese momento. `hoy`: no se cierra un mes que todavía no termina.
export function cerrarMes({ permitido, eventos, costo, hoy, motivo = "", quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El mes lo cierra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!esMes(costo?.mes)) return { ok: false, dice: "Falta el mes." };
  if (hoy <= finDe(costo.mes)) return { ok: false, dice: "Ese mes todavía no termina." };
  const s = estadoDeMes(eventos, costo.mes);
  if (s.estado === "cerrado") return { ok: false, dice: "Ese mes ya está cerrado. Para cambiarlo hay que reabrirlo y decir por qué." };
  if (s.estado === "reabierto" && !limpio(motivo)) return { ok: false, dice: "Es un cierre nuevo de un mes reabierto: hay que decir qué cambió." };
  const avisos = costo.pendiente !== 0 ? [`Se cerró con ${costo.pendientes} importe(s) pendientes de distribuir. Quedan anotados; cuando se distribuyan saldrán como ajuste posterior.`] : [];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_CIERRE_MES, cuando, fecha, quien, azar, origen: s.cierre?.id || null, relacion: s.cierre ? "sustituye" : null,
    datos: { mes: costo.mes, motivo: limpio(motivo), renglones: costo.renglones.map(r => ({ parcelaId: r.parcelaId, nombre: r.nombre, directo: r.directo, indirecto: r.indirecto, completo: r.completo })),
      directo: costo.directo, indirecto: costo.indirecto, completo: costo.completo, pendiente: costo.pendiente, noProduccion: costo.noProduccion } }) };
}
export function reabrirMes({ permitido, eventos, mes, motivo, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El mes lo reabre un administrador."); if (no) return { ok: false, dice: no }; }
  const s = estadoDeMes(eventos, mes);
  if (s.estado !== "cerrado") return { ok: false, dice: "Ese mes no está cerrado." };
  if (!limpio(motivo)) return { ok: false, dice: "Para reabrir hay que decir por qué." };
  return { ok: true, evento: nuevoEvento({ tipo: T_REAPERTURA_MES, cuando, fecha, quien, azar, origen: s.cierre.id, relacion: "reabre", datos: { mes, motivo: limpio(motivo) } }) };
}

// Los ajustes posteriores: lo que cambió desde la foto. La foto no se toca.
export function ajustesPosteriores(cierre, costoHoy) {
  if (!cierre) return { hay: false, lista: [], total: 0, pendiente: 0 };
  const antes = new Map(cierre.datos.renglones.map(r => [r.parcelaId, r])), hoy = new Map((costoHoy?.renglones || []).map(r => [r.parcelaId, r])), lista = [];
  for (const id of new Set([...antes.keys(), ...hoy.keys()])) {
    const a = antes.get(id), h = hoy.get(id);
    const d = { parcelaId: id, nombre: (h || a).nombre, directo: sumarDinero(h?.directo || 0, -(a?.directo || 0)), indirecto: sumarDinero(h?.indirecto || 0, -(a?.indirecto || 0)), era: a?.completo || 0, es: h?.completo || 0 };
    if (Math.abs(d.directo) > 0.004 || Math.abs(d.indirecto) > 0.004) lista.push({ ...d, diferencia: sumarDinero(d.es, -d.era) });
  }
  const pendiente = sumarDinero(costoHoy?.pendiente || 0, -(cierre.datos.pendiente || 0));
  return { hay: lista.length > 0 || Math.abs(pendiente) > 0.004, lista, total: sumarDinero(lista.map(l => l.diferencia)), pendiente };
}
