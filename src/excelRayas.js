// ============================================================
//  AgroGestión — El Excel antiguo de rayas («Formato de Lista de Rayas 2024»)
//  Puro: recibe los renglones de una hoja y devuelve lo que se puede leer.
//
//  De ese Excel se recuperan DOS cosas, y nada más:
//  1. Sus catálogos de claves (actividades, ubicaciones, cultivos) como
//     REFERENCIAS HISTÓRICAS: «en este archivo, A07 era Desgranar». No son
//     definiciones: los significados cambiaron entre versiones del Excel, así
//     que cada una lleva de qué archivo salió y de qué fechas era, y su
//     vigencia queda «por confirmar». Una misma clave puede tener varias.
//  2. Las hojas semanales (un renglón por trabajador, tres columnas por día:
//     actividad · ubicación · cultivo) como rayas históricas: quién hizo qué,
//     dónde y en qué cultivo, día por día.
//
//  LO QUE NO SE RECUPERA, A PROPÓSITO
//  · El tabulador de sueldos, las percepciones y las retenciones: son datos de
//    pago de personas. De este archivo no sale ningún pago ni ningún sueldo.
//  · Los importes que el Excel calculó: muchas semanas traen #N/A (el nombre de
//    la ubicación dejó de coincidir con el catálogo y ese día ya no se contó).
//  · La regla «una ubicación = un cultivo para siempre»: el cultivo que traía
//    cada día se guarda como lo que DECÍA el Excel, no como verdad de la parcela.
//  · La lista de gastos de cada hoja: es la misma copiada de una semana a otra.
// ============================================================

const texto = (v) => (v === null || v === undefined ? "" : String(v)).replace(/\s+/g, " ").trim();
const plano = (v) => texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const esError = (v) => /^#(N\/A|N\/D|REF!|VALUE!|¡?VALOR!|NAME\?|¿?NOMBRE\?|DIV\/0!)/i.test(texto(v));
const MESES = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };
const dia = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const sumarDias = (f, n) => { const [a, m, d] = f.split("-").map(Number), x = new Date(Date.UTC(a, m - 1, d + n)); return dia(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); };
// Un código al final del nombre: «Desgranar A07», «SAN FELIPE 4 SF4», «CANAL CAN». Tres signos, con letra al principio.
const CODIGO = /^[A-Z][A-Z0-9]{2}$/;
export function separarCodigo(nombre) {
  const t = texto(nombre), partes = t.split(" ");
  const ultimo = plano(partes[partes.length - 1]);
  if (partes.length >= 2 && CODIGO.test(ultimo) && /\d|^[A-Z]{3}$/.test(ultimo)) return { codigo: ultimo, nombre: partes.slice(0, -1).join(" ") };
  return { codigo: "", nombre: t };
}

// «Semana del 30 de Septiembre al 06 de Octubre del 2024» → { desde, hasta }. null si no se entiende: no se supone.
export function fechasDeSemana(titulo) {
  const t = plano(titulo), m = /DEL? (\d{1,2})(?: DE ([A-Z]+))? AL (\d{1,2}) DE ([A-Z]+) DEL? (\d{4})/.exec(t);
  if (!m) return null;
  const anio = Number(m[5]), mesFin = MESES[m[4]], mesIni = m[2] ? MESES[m[2]] : mesFin;
  if (!mesFin || !mesIni) return null;
  const desde = dia(mesIni > mesFin ? anio - 1 : anio, mesIni, Number(m[1])), hasta = dia(anio, mesFin, Number(m[3]));
  return desde <= hasta ? { desde, hasta } : null;
}

/* ════════════ 1 · LOS CATÁLOGOS ════════════ */
const CLASE_DE_SECCION = (titulo) => { const t = plano(titulo); return /ACTIVIDAD/.test(t) ? "actividad" : /UBICACI/.test(t) ? "ubicacion" : /PRODUCTO|CULTIVO/.test(t) ? "cultivo" : null; };
// Busca tablas «CÓDIGO | NOMBRE» con su título arriba (ACTIVIDADES, UBICACIONES, PRODUCTOS). Lo demás (trabajadores,
// tabulador de sueldos) no tiene esa forma o no tiene esa clase, y no se toca.
export function leerCatalogos(filas = []) {
  const referencias = [], secciones = [];
  for (let i = 0; i < Math.min(filas.length, 12); i++) {
    const f = filas[i] || [];
    for (let c = 0; c < f.length - 1; c++) {
      if (plano(f[c]) !== "CODIGO" || plano(f[c + 1]) !== "NOMBRE") continue;
      // El título: la celda con texto más cercana hacia arriba, en esa columna o las dos de junto.
      let titulo = "";
      for (let r = i - 1; r >= 0 && !titulo; r--) for (const k of [c, c + 1, c - 1]) { const v = texto((filas[r] || [])[k]); if (v) { titulo = v; break; } }
      const clase = CLASE_DE_SECCION(titulo); if (!clase) continue;
      const conCultivo = clase === "ubicacion" && /CULTIVO/.test(plano(f[c + 2]));
      let n = 0, vacios = 0;
      for (let r = i + 1; r < filas.length && vacios < 3; r++) {
        const cod = plano((filas[r] || [])[c]).replace(/\s+/g, ""), nom = texto((filas[r] || [])[c + 1]);
        if (!cod && !nom) { vacios++; continue; }
        vacios = 0;
        if (!nom || esError(nom)) continue;
        const s = separarCodigo(nom), significado = s.codigo && (!cod || s.codigo === cod) ? s.nombre : nom;
        const cultivoAsociado = conCultivo ? plano((filas[r] || [])[c + 2]) : "";
        // Sin código en el catálogo (pasa con varias bodegas): la clave es el nombre mismo, que es como se escribía.
        const clave = cod || s.codigo || plano(significado).replace(/\s+/g, ""), mas = cultivoAsociado && !esError(cultivoAsociado) ? { cultivoAsociado } : {};
        referencias.push({ clave, clase, significado, escrita: nom, sinCodigo: !cod && !s.codigo, ...mas });
        // En las hojas semanales la misma cosa se escribió a veces con su código y a veces sólo con el nombre («SAN FELIPE 4
        // SF4» y «SAN FELIPE 4»): el nombre también se guarda como referencia, apuntando a su código.
        const porNombre = plano(significado).replace(/[^A-Z0-9]/g, "");
        if (porNombre && porNombre !== clave && porNombre.length <= 24) referencias.push({ clave: porNombre, clase, significado, escrita: nom, aliasDe: clave, ...mas });
        n++;
      }
      if (n) secciones.push({ titulo, clase, renglones: n });
    }
  }
  return { referencias, secciones };
}

/* ════════════ 2 · LA HOJA SEMANAL ════════════ */
const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
// ¿Es una hoja semanal? Tiene un renglón con los días y, abajo, «ACTIVIDAD / UBICACIÓN» repetido. null si no lo es.
export function leerRayaSemanal(filas = []) {
  let i = -1, columnas = [];
  for (let r = 0; r < Math.min(filas.length, 10); r++) {
    const cols = (filas[r] || []).map((v, c) => ({ d: DIAS.indexOf(plano(v)), c })).filter(x => x.d >= 0);
    if (cols.length >= 5 && cols.every((x, k) => k === 0 || x.c > cols[k - 1].c)) { i = r; columnas = cols; break; }
  }
  if (i < 0) return null;
  const sub = (filas[i + 1] || []).map(plano);
  if (!columnas.every(x => sub[x.c] === "ACTIVIDAD")) return null;
  const ancho = columnas[1].c - columnas[0].c, conCultivo = ancho >= 3 && sub[columnas[0].c + 2] === "CULTIVO";
  const enc = (filas[i] || []).map(plano);
  let colNombre = enc.findIndex(v => /NOMBRE/.test(v)); if (colNombre < 0) colNombre = Math.max(0, columnas[0].c - 1);
  let semana = null;
  for (let r = 0; r < i && !semana; r++) for (const v of filas[r] || []) { semana = fechasDeSemana(v); if (semana) break; }
  const registros = [], descartadas = []; let sinActividad = 0, conError = 0;
  for (let r = i + 2; r < filas.length; r++) {
    const f = filas[r] || [], primera = plano(f.find(v => texto(v)) ?? "");
    if (/^TOTALES|LISTA DE RAYAS AJENOS/.test(primera)) break;   // lo que sigue son cuadrillas y resúmenes: otra forma, no se adivina
    const nombre = texto(f[colNombre]); if (nombre.length < 2 || esError(nombre)) continue;
    for (const { d, c } of columnas) {
      const act = texto(f[c]), ubi = texto(f[c + 1]), cul = conCultivo ? texto(f[c + 2]) : "";
      if (!act || esError(act)) { if (ubi && !esError(ubi)) descartadas.push({ renglon: r + 1, motivo: `${nombre}, ${DIAS[d].toLowerCase()}: trae ubicación pero no actividad.` }); else sinActividad++; continue; }
      const a = separarCodigo(act), u = ubi && !esError(ubi) ? separarCodigo(ubi) : { codigo: "", nombre: "" };
      // Al abrir el archivo, una celda con error (#N/A) llega VACÍA: por eso «sin cultivo» y «cultivo con error» son lo mismo aquí.
      const cultivoMalo = esError(cul); if (conCultivo && (cultivoMalo || !cul)) conError++;
      // «GEN / GENERAL» como cultivo quiere decir que no es de ningún cultivo: se deja vacío.
      const cultivo = cultivoMalo || /^GEN(ERAL)?$/.test(plano(cul)) ? "" : cul;
      registros.push({ clase: "raya", fecha: semana ? sumarDias(semana.desde, d) : null, nombre, claves: [a.codigo || a.nombre, ...(u.codigo || u.nombre ? [u.codigo || u.nombre] : [])],
        escrito: { actividad: act, ubicacion: ubi }, cultivo, observacion: "", monto: null, renglon: r + 1, dia: DIAS[d] });
    }
  }
  return { semana, conCultivo, registros, descartadas, sinActividad, cultivoConError: conError };
}

// El periodo que cubre un libro completo: de la primera a la última semana que se pudo leer.
export function periodoDelLibro(hojas = []) {
  const s = hojas.map(h => { for (const f of (h.filas || []).slice(0, 6)) for (const v of f || []) { const x = fechasDeSemana(v); if (x) return x; } return null; }).filter(Boolean);
  return s.length ? { desde: s.map(x => x.desde).sort()[0], hasta: s.map(x => x.hasta).sort().pop() } : null;
}
