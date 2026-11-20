// ════════════════════════════════════════════════════════════════════════
//  SALARIOS MÍNIMOS — el catálogo oficial, año por año
//
//  El salario mínimo lo fija cada diciembre la Comisión Nacional de los
//  Salarios Mínimos (CONASAMI) y se publica en el Diario Oficial de la
//  Federación (DOF). Hay dos: el GENERAL (el resto del país; Zacatecas y
//  Aguascalientes están aquí) y el de la ZONA LIBRE DE LA FRONTERA NORTE.
//
//  Reglas de este archivo:
//   · Un cálculo usa el salario mínimo VIGENTE EN SU FECHA, no el de hoy.
//   · Los valores anteriores no se pisan: el histórico se conserva.
//   · No se inventa: si el año de la fecha todavía no está en el catálogo, la
//     respuesta es «no sé» (monto: null) y lo que dependa de él queda por revisar.
//     Nunca se usa el del año pasado como si siguiera vigente.
//   · Se actualiza con un evento (`salario_minimo`, sensible: permiso
//     «cambiar las reglas»), con su fuente, quién y cuándo. Corregir un año es
//     otro evento para la misma fecha: gana el más reciente y queda el anterior.
//
//  `verificado` dice contra qué se cotejó cada renglón de fábrica (19 nov 2026):
//    "texto"   se leyó el importe en el texto de la resolución oficial (DOF)
//    "tabla"   la publicación en el DOF está confirmada; el importe se cotejó
//              con una reproducción de la tabla de CONASAMI, no con el texto
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";

export const T_SALARIO_MINIMO = "salario_minimo";
export const ZONAS = { general: "General (resto del país)", frontera: "Zona Libre de la Frontera Norte" };
const R = "Resolución del H. Consejo de Representantes de la CONASAMI";
export const CATALOGO_OFICIAL = [
  { desde: "2019-01-01", general: 102.68, frontera: 176.72, fuente: `${R}, DOF 26/12/2018`, verificado: "texto" },
  { desde: "2020-01-01", general: 123.22, frontera: 185.56, fuente: `${R}, DOF de diciembre de 2019`, verificado: "texto" },
  { desde: "2021-01-01", general: 141.70, frontera: 213.39, fuente: `${R}, DOF de diciembre de 2020`, verificado: "texto" },
  { desde: "2022-01-01", general: 172.87, frontera: 260.34, fuente: `${R}, DOF 08/12/2021`, verificado: "tabla" },
  { desde: "2023-01-01", general: 207.44, frontera: 312.41, fuente: `${R}, DOF 07/12/2022`, verificado: "texto" },
  { desde: "2024-01-01", general: 248.93, frontera: 374.89, fuente: `${R}, DOF 12/12/2023`, verificado: "tabla" },
  { desde: "2025-01-01", general: 278.80, frontera: 419.88, fuente: `${R}, DOF 19/12/2024`, verificado: "texto" },
  { desde: "2026-01-01", general: 315.04, frontera: 440.87, fuente: `${R}, DOF de diciembre de 2025`, verificado: "texto" },
];
const limpio = (s) => String(s || "").trim();
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "");
const centavos = (n) => Math.round(Number(n) * 100) / 100;

// El catálogo vigente: lo de fábrica más lo capturado. Para una misma fecha de inicio gana lo capturado más reciente;
// lo que quedó sustituido se conserva en `anteriores`.
export function catalogoDe(eventos = []) {
  const por = new Map(CATALOGO_OFICIAL.map(c => [c.desde, { ...c, origen: "fabrica", anteriores: [] }]));
  for (const e of vigentes(eventos).filter(e => e.tipo === T_SALARIO_MINIMO).sort((a, b) => a.cuando.localeCompare(b.cuando))) {
    const antes = por.get(e.datos.desde);
    por.set(e.datos.desde, { desde: e.datos.desde, general: e.datos.general, frontera: e.datos.frontera, fuente: e.datos.fuente, nota: e.datos.nota || "", origen: "capturado", evento: e.id, por: e.quien?.nombre || "", capturado: e.fecha,
      anteriores: antes ? [...antes.anteriores, { general: antes.general, frontera: antes.frontera, fuente: antes.fuente, origen: antes.origen, por: antes.por || "", capturado: antes.capturado || "" }] : [] });
  }
  return [...por.values()].sort((a, b) => a.desde.localeCompare(b.desde));
}

// El salario mínimo por día vigente en una fecha. `monto: null` = no se sabe (y `dice` explica qué falta).
export function salarioMinimoEn(fecha, zona = "general", eventos = []) {
  const z = ZONAS[zona] ? zona : "general";
  if (!esFecha(fecha)) return { monto: null, zona: z, dice: "Falta la fecha para saber qué salario mínimo aplica." };
  const cat = catalogoDe(eventos), r = cat.filter(c => c.desde <= fecha).pop();
  if (!r) return { monto: null, zona: z, dice: `El catálogo de salarios mínimos empieza en ${cat[0].desde.slice(0, 4)}; no tiene el de ${fecha.slice(0, 4)}.` };
  // El salario mínimo cambia cada 1 de enero. Si el renglón que tocaría es de un año anterior, falta capturar el de ese año.
  if (r.desde.slice(0, 4) !== fecha.slice(0, 4)) return { monto: null, zona: z, dice: `Falta capturar el salario mínimo oficial de ${fecha.slice(0, 4)} (el último del catálogo es el de ${r.desde.slice(0, 4)}). No se usa el anterior como si siguiera vigente.` };
  if (!(r[z] > 0)) return { monto: null, zona: z, dice: `El catálogo no tiene el importe de «${ZONAS[z]}» para ${fecha.slice(0, 4)}.` };
  return { monto: r[z], zona: z, desde: r.desde, fuente: r.fuente, origen: r.origen, verificado: r.verificado || null, dice: "" };
}

// Agregar un año (o corregir uno). Pide la publicación oficial de donde sale.
export function capturarSalarioMinimo({ permitido, eventos = [], desde, general, frontera, fuente, nota = "", quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El catálogo de salarios mínimos lo actualiza un administrador."); if (no) return { ok: false, dice: no }; }
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde qué fecha rige." };
  const g = centavos(general), f = centavos(frontera);
  if (!(g > 0)) return { ok: false, dice: "Falta el salario mínimo general por día." };
  if (!(f > 0)) return { ok: false, dice: "Falta el salario mínimo por día de la Zona Libre de la Frontera Norte." };
  if (f < g) return { ok: false, dice: "El de la frontera norte no puede ser menor que el general. Revisa los dos importes." };
  if (limpio(fuente).length < 8) return { ok: false, dice: "Falta la publicación oficial de donde sale (por ejemplo: «Resolución de la CONASAMI, DOF del 9 de diciembre de 2026»)." };
  const cat = catalogoDe(eventos), mismo = cat.find(c => c.desde === desde), previo = cat.filter(c => c.desde < desde).pop(), avisos = [];
  if (mismo && mismo.general === g && mismo.frontera === f) return { ok: false, dice: "Ese año ya está en el catálogo con esos mismos importes." };
  if (mismo) avisos.push(`Ya había importes para esa fecha (${mismo.general} y ${mismo.frontera}). Quedan como historial; desde ahora valen los nuevos.`);
  if (previo && g < previo.general) avisos.push(`El general que capturaste (${g}) es menor que el del periodo anterior (${previo.general}). Se guarda; revisa que no sea un error de dedo.`);
  if (previo && g > previo.general * 1.5) avisos.push(`El general que capturaste (${g}) sube más de 50 % contra el anterior (${previo.general}). Se guarda; revisa que no sea un error de dedo.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_SALARIO_MINIMO, cuando, fecha, quien, azar, datos: { desde, general: g, frontera: f, fuente: limpio(fuente), nota: limpio(nota) } }) };
}
