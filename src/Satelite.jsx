// ============================================================
//  AgroGestión — Satélite para análisis, dentro del mapa (pantalla)
//
//  Se abre desde la ficha de una parcela que ya tiene su límite. Enseña las
//  pasadas de Sentinel-2 del ciclo vigente, el índice de cada una dentro de la
//  parcela, su evolución y la comparación entre dos fechas.
//
//  Lo que esta pantalla cuida:
//   · que nunca se confunda con el FONDO del mapa (otra imagen, sin fecha);
//   · que cada número diga de qué día es, cuánta parcela se alcanzó a ver y
//     con qué tamaño de cuadro;
//   · que nada suene a diagnóstico: dice cuánto cambió, no por qué.
//  La cuenta vive en `satelite.js`; la red, en `lectorSatelite.js`.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { INDICES, ESTADOS, ADVERTENCIAS, CREDITO, RESOLUCION_M, calcularIndice, pintarIndice, pintarColor, guardarLectura, lecturasDe, serieDe, compararFechas, periodoDeAnalisis, sirveParaSerie } from "./satelite.js";
import { buscarEscenas, leerRecorte } from "./lectorSatelite.js";

const DIA = (f) => (f ? f.split("-").reverse().join("/") : "—");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corto = (f) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
const VISTAS = [["ndvi", "Vigor"], ["ndmi", "Humedad"], ["color", "Color real"]];
const COLOR_DE_ESTADO = { bien: "var(--accent)", parcial: "var(--gold)", pocos: "var(--gold)", sin_dato: "var(--muted)", sin_cuadros: "var(--muted)" };

export default function PanelSatelite({ L, mapa, parcela, limite, desdeDelCiclo, eventos, hoy, puedeGuardar, add, quien, onCerrar, onCapa }) {
  const periodo = useMemo(() => periodoDeAnalisis({ desdeDelCiclo, hoy }), [desdeDelCiclo, hoy]);
  const guardadas = useMemo(() => lecturasDe(eventos || [], parcela.id, limite.evento), [eventos, parcela.id, limite.evento]);
  const [escenas, setEscenas] = useState(null);
  const [sesion, setSesion] = useState({});                 // día → lectura hecha ahora (aún no guardada, o de quien no guarda)
  const [avance, setAvance] = useState(null);               // { hechas, total }
  const [falla, setFalla] = useState("");
  const [vista, setVista] = useState("ndvi");
  const [dia, setDia] = useState(null);
  const [otra, setOtra] = useState(null);                   // la fecha contra la que se compara
  const [comparando, setComparando] = useState(false);
  const [verCapa, setVerCapa] = useState(true);
  const [mas, setMas] = useState(false);
  const [pintando, setPintando] = useState(false);
  const recortes = useRef(new Map()), capa = useRef(null), vuelta = useRef(0), tira = useRef(null);

  const lecturas = useMemo(() => { const m = new Map(guardadas.map(l => [l.dia, l])); for (const [d, l] of Object.entries(sesion)) if (!m.has(d)) m.set(d, l); return [...m.values()].filter(l => l.dia >= periodo.desde).sort((a, b) => a.dia.localeCompare(b.dia)); }, [guardadas, sesion, periodo.desde]);
  const porDia = useMemo(() => new Map(lecturas.map(l => [l.dia, l])), [lecturas]);
  const indice = vista === "color" ? "ndvi" : vista;
  const serie = useMemo(() => serieDe(lecturas, indice), [lecturas, indice]);

  /* ── 1 · qué pasadas hay, y leer las que faltan ── */
  const cargar = async () => {
    const esta = ++vuelta.current, vivo = { get current() { return vuelta.current === esta; } };   // si se cierra o se vuelve a pedir, esta vuelta ya no escribe nada
    setFalla(""); setEscenas(null);
    try {
      const esc = await buscarEscenas({ anillo: limite.anillo, desde: periodo.desde, hasta: periodo.hasta }); if (!vivo.current) return;
      setEscenas(esc);
      const ya = new Set(lecturasDe(eventos || [], parcela.id, limite.evento).map(l => l.dia)), faltan = esc.filter(e => !ya.has(e.fecha));
      if (!faltan.length) return;
      setAvance({ hechas: 0, total: faltan.length }); let hechas = 0;
      for (let i = 0; i < faltan.length && vivo.current; i += 4) {
        await Promise.all(faltan.slice(i, i + 4).map(async (e) => {
          const r = await leerRecorte({ escena: e, anillo: limite.anillo }); recortes.current.set(e.id, r);
          const resumenes = { ndvi: calcularIndice(r, limite.anillo, e, "ndvi", limite.huecos).resumen, ndmi: calcularIndice(r, limite.anillo, e, "ndmi", limite.huecos).resumen };
          const g = guardarLectura({ parcelaId: parcela.id, limite, escena: e, resumenes, quien, cuando: new Date().toISOString(), fecha: hoy });
          if (!vivo.current || !g.ok) return;
          if (puedeGuardar) add("eventos", g.evento);
          setSesion(s => ({ ...s, [e.fecha]: { ...g.evento.datos } })); setAvance({ hechas: ++hechas, total: faltan.length });
        }));
      }
      if (vivo.current) setAvance(null);
    } catch (e) { if (vivo.current) { setFalla(e.message || "No se pudieron leer las imágenes."); setAvance(null); setEscenas(x => x || []); } }
  };
  useEffect(() => { cargar(); return () => { vuelta.current++; quitarCapa(); onCapa?.(null); }; }, [parcela.id, limite.evento]);   // eslint-disable-line

  // De entrada, la fecha más reciente con lectura completa.
  useEffect(() => { if (dia || avance) return; const buenas = lecturas.filter(l => sirveParaSerie(l.indices?.ndvi)); const d = (buenas[buenas.length - 1] || lecturas[lecturas.length - 1])?.dia; if (d) setDia(d); }, [lecturas, avance]);   // eslint-disable-line

  /* ── 2 · la capa sobre el mapa ── */
  const quitarCapa = () => { if (capa.current && mapa) { mapa.removeLayer(capa.current); capa.current = null; } };
  useEffect(() => {
    let sigue = true; quitarCapa();
    const e = (escenas || []).find(x => x.fecha === dia); if (!e || !mapa || !L) { onCapa?.(null); return; }
    onCapa?.({ dia, hora: e.hora, plataforma: e.plataforma, vista });
    if (!verCapa) return;
    (async () => {
      setPintando(true);
      try {
        let px, r;
        if (vista === "color") { const k = `${e.id}|color`; r = recortes.current.get(k) || await leerRecorte({ escena: e, anillo: limite.anillo, bandas: ["visual"] }); recortes.current.set(k, r); px = pintarColor(r, r.ancho, r.alto); }
        else { r = recortes.current.get(e.id) || await leerRecorte({ escena: e, anillo: limite.anillo }); recortes.current.set(e.id, r); px = pintarIndice(calcularIndice(r, limite.anillo, e, vista, limite.huecos), r.ancho, r.alto, vista); }
        if (!sigue) return;
        const c = document.createElement("canvas"); c.width = r.ancho; c.height = r.alto; c.getContext("2d").putImageData(new ImageData(px, r.ancho, r.alto), 0, 0);
        quitarCapa();
        capa.current = L.imageOverlay(c.toDataURL(), [[r.limites.sur, r.limites.oeste], [r.limites.norte, r.limites.este]], { opacity: 1, interactive: false, className: "mp-pixelada" }).addTo(mapa);
      } catch (x) { if (sigue) setFalla(x.message || "No se pudo traer esa imagen."); }
      if (sigue) setPintando(false);
    })();
    return () => { sigue = false; };
  }, [dia, vista, verCapa, escenas]);   // eslint-disable-line
  useEffect(() => { const t = tira.current, el = t?.querySelector(".activa"); if (el) t.scrollLeft = el.offsetLeft - t.offsetLeft - t.clientWidth / 2 + el.clientWidth / 2; }, [dia, escenas]);   // sólo de lado: la hoja no se mueve

  const escena = (escenas || []).find(x => x.fecha === dia), lectura = dia ? porDia.get(dia) : null, res = lectura?.indices?.[indice];
  const comparacion = comparando && otra && lectura ? compararFechas(lectura, porDia.get(otra), indice) : null;
  const tocar = (d) => { if (comparando && dia && d !== dia) setOtra(d); else setDia(d); };
  const ind = INDICES[indice];

  return (<div className="mp-hoja mp-sat" aria-label={`Satélite de ${parcela.nombre}`}>
    <div className="mp-cabeza">
      <div style={{ minWidth: 0 }}><div className="mp-nombre">{parcela.nombre}</div>
        <div className="mp-sub">Sentinel-2 · imagen para análisis · cuadros de {RESOLUCION_M} m</div></div>
      <button className="mp-boton mp-plano" aria-label="Cerrar el satélite" onClick={onCerrar}>✕</button>
    </div>
    <div className="mp-fila">{VISTAS.map(([k, t]) => <button key={k} className={`mp-pildora${vista === k ? " activa" : ""}`} aria-pressed={vista === k} onClick={() => setVista(k)}>{t}</button>)}
      <button className="mp-pildora" aria-pressed={!verCapa} onClick={() => setVerCapa(v => !v)}>{verCapa ? "Ver el fondo" : "Ver la capa"}</button></div>
    <div className="mp-nota">{vista === "color" ? "La foto de esa pasada, en color real. Sirve para ver nubes, sombras o lo que el índice no explica." : `${ind.nombre} (${ind.sigla}): ${ind.que}`}{ind.resolucion === 20 && vista === "ndmi" ? " Sale de bandas de 20 m: es más grueso que el vigor." : ""}</div>

    {falla && <div className="mp-ojo">{falla}<button className="mp-pildora" style={{ marginTop: 6 }} onClick={cargar}>Reintentar</button></div>}
    {!escenas && !falla && <div className="mp-nota">Buscando las pasadas del satélite sobre esta parcela…</div>}
    {avance && <div className="mp-nota" role="status">Leyendo {avance.hechas} de {avance.total} fechas… (sólo se baja el recorte de la parcela)</div>}
    {escenas && escenas.length === 0 && !falla && <div className="mp-ojo">No hay pasadas del satélite en este periodo.</div>}

    {/* la fecha escogida */}
    {escena && <div className="mp-lectura">
      <div className="mp-lectura-n">
        {vista === "color" ? <b style={{ fontSize: 18 }}>{corto(dia)}</b> : <><small>{ind.sigla} promedio</small><b>{res?.media != null ? res.media.toFixed(2) : "—"}</b></>}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="text-sm"><b>{DIA(dia)}</b>, {escena.hora} h · {escena.plataforma}{pintando ? " · trayendo la imagen…" : ""}</div>
        <div className="mp-nota" style={{ margin: "2px 0" }}>Nubes en toda la pasada: {escena.nubesEscena ?? "—"} %. {res ? `En la parcela se usaron ${res.validos} de ${res.cuadros} cuadros (${res.pctValido} %)${res.conNube ? `; ${res.conNube} con nube o sombra` : ""}.` : "Todavía sin leer."}</div>
        {res && res.estado !== "bien" && <div className="text-xs" style={{ color: COLOR_DE_ESTADO[res.estado] }}>{ESTADOS[res.estado]}.</div>}
        {res?.media != null && vista !== "color" && <div className="text-xs text-muted">La mayor parte de la parcela está entre {res.p10.toFixed(2)} y {res.p90.toFixed(2)}.</div>}
      </div>
    </div>}
    {vista !== "color" && <div className="mp-escala" aria-label={`Escala de ${ind.sigla}`}>
      <span>{ind.rango[0]}</span><i style={{ background: `linear-gradient(90deg, ${ind.rampa.map(([v, c]) => `${c} ${Math.round(((v - ind.rango[0]) / (ind.rango[1] - ind.rango[0])) * 100)}%`).join(", ")})` }} /><span>{ind.rango[1]}</span><em><u />tapado</em>
    </div>}

    {/* evolución */}
    {lecturas.length > 0 && <>
      <div className="mp-hoja-titulo" style={{ marginTop: 10 }}>{periodo.deCiclo ? `Evolución en el ciclo (desde el ${DIA(periodo.desde)})` : `Últimos 90 días (la parcela no tiene ciclo vigente)`}</div>
      {periodo.recortado && <div className="mp-nota">El ciclo empezó hace más de un año: se enseña el último año.</div>}
      <Linea serie={serie} periodo={periodo} ind={ind} dia={dia} otra={comparando ? otra : null} onTocar={tocar} />
      {serie.dudosas.length > 0 && <div className="mp-ojo">{serie.dudosas.map(corto).join(", ")}: {serie.dudosas.length === 1 ? "se sale" : "se salen"} de sus fechas vecinas, que entre sí coinciden. Lo más común es una nube delgada o bruma que el satélite no marcó. No se quitó ni se corrigió: mírala en «Color real» antes de creerle.</div>}
      <div className="mp-nota">{serie.puntos.length} fecha(s) con lectura completa{serie.sinUsar.length ? `; ${serie.sinUsar.length} no entran a la línea (nube, sombra o lectura parcial)` : ""}. Entre dos puntos no hay dato: la línea sólo los une.</div>
    </>}
    {escenas && escenas.length > 0 && <div className="mp-tira" ref={tira}>{escenas.map(e => { const l = porDia.get(e.fecha), est = l?.indices?.[indice]?.estado;
      return (<button key={e.id} className={`mp-fecha${dia === e.fecha ? " activa" : ""}${comparando && otra === e.fecha ? " otra" : ""}`} aria-label={`Pasada del ${DIA(e.fecha)}`} onClick={() => tocar(e.fecha)}>
        <i style={{ background: est ? COLOR_DE_ESTADO[est] : "transparent", borderColor: est ? "transparent" : "var(--muted)" }} />{corto(e.fecha)}<small>{est === "bien" ? l.indices[indice].media.toFixed(2) + (serie.dudosas.includes(e.fecha) ? " ?" : "") : est ? (est === "parcial" || est === "pocos" ? "parcial" : "nube") : "…"}</small></button>); })}</div>}

    {/* comparar dos fechas */}
    {lecturas.length > 1 && vista !== "color" && <div style={{ marginTop: 8 }}>
      <button className={`mp-pildora${comparando ? " activa" : ""}`} aria-pressed={comparando} onClick={() => { setComparando(c => !c); setOtra(null); }}>{comparando ? "Dejar de comparar" : "Comparar con otra fecha"}</button>
      {comparando && !otra && <div className="mp-nota">Toca otra fecha, en la tira o en la gráfica.</div>}
      {comparacion && <div className="mp-ojo" style={{ borderColor: "var(--border)" }}>
        <div><b>{DIA(comparacion.desde || otra)} → {DIA(comparacion.hasta || dia)}</b></div><div>{comparacion.dice}</div>
        {comparacion.se && [dia, otra].some(d => serie.dudosas.includes(d)) && <div className="text-xs" style={{ color: "var(--gold)" }}>Ojo: una de las dos fechas es dudosa (se sale de sus vecinas).</div>}
        {comparacion.se && <div className="mp-fila" style={{ marginTop: 6 }}><button className="mp-pildora" onClick={() => { const a = dia; setDia(otra); setOtra(a); }}>Ver la del {corto(otra)}</button></div>}
      </div>}
    </div>}

    <div className="mp-ojo" style={{ marginTop: 10 }}>{ADVERTENCIAS[0]}
      <button className="mp-pildora" style={{ marginTop: 6 }} aria-expanded={mas} onClick={() => setMas(m => !m)}>{mas ? "Menos" : "Más sobre cómo leerlo"}</button>
      {mas && <ul className="mp-lista">{ADVERTENCIAS.slice(1).map((a, i) => <li key={i}>{a}</li>)}
        <li>El satélite pasa cada 2 a 5 días, cerca del mediodía. Con nube no hay dato, y no se rellena.</li>
        <li>Los cuadros de la orilla mezclan parcela y camino: no se cuentan.</li>
        <li>Esta capa NO es el fondo del mapa: el fondo es un mosaico sin fecha que sólo sirve para ubicar.</li></ul>}
    </div>
    <div className="mp-nota">{CREDITO(hoy.slice(0, 4))}{puedeGuardar ? " Los resúmenes quedan guardados; la imagen no." : " Lo que veas aquí no se guarda con tu perfil."}</div>
  </div>);
}

// La línea del tiempo. Sólo puntos con lectura completa; cada uno con su rango (de p10 a p90).
function Linea({ serie, periodo, ind, dia, otra, onTocar }) {
  const W = 340, H = 130, m = { i: 30, d: 8, a: 8, b: 20 }, [y0, y1] = ind.rango;
  const t = (f) => new Date(`${f}T12:00:00Z`).getTime(), t0 = t(periodo.desde), t1 = Math.max(t(periodo.hasta), t0 + 864e5);
  const X = (f) => m.i + ((t(f) - t0) / (t1 - t0)) * (W - m.i - m.d), Y = (v) => m.a + (1 - (Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0)) * (H - m.a - m.b);
  const marcas = [y0, (y0 + y1) / 2, y1];
  return (<svg viewBox={`0 0 ${W} ${H}`} className="mp-grafica" role="img" aria-label={`Evolución de ${ind.sigla}`}>
    {marcas.map(v => <g key={v}><line x1={m.i} x2={W - m.d} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth="1" /><text x={m.i - 5} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{Math.round(v * 100) / 100}</text></g>)}
    <text x={m.i} y={H - 5} fontSize="9" fill="var(--muted)">{corto(periodo.desde)}</text><text x={W - m.d} y={H - 5} fontSize="9" textAnchor="end" fill="var(--muted)">{corto(periodo.hasta)}</text>
    {serie.sinUsar.map(s => <line key={s.dia} x1={X(s.dia)} x2={X(s.dia)} y1={H - m.b} y2={H - m.b + 4} stroke="var(--muted)" strokeWidth="1.5" />)}
    {serie.puntos.length > 1 && <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" points={serie.puntos.map(p => `${X(p.dia).toFixed(1)},${Y(p.valor).toFixed(1)}`).join(" ")} />}
    {serie.puntos.map(p => <g key={p.dia} onClick={() => onTocar(p.dia)} style={{ cursor: "pointer" }}>
      <line x1={X(p.dia)} x2={X(p.dia)} y1={Y(p.p90)} y2={Y(p.p10)} stroke="var(--accent)" strokeOpacity=".35" strokeWidth="3" />
      <circle cx={X(p.dia)} cy={Y(p.valor)} r={p.dia === dia ? 5.5 : 3.5} fill={p.duda ? "var(--surface)" : p.dia === dia ? "var(--text)" : p.dia === otra ? "var(--blue)" : "var(--accent)"} stroke={p.duda ? "var(--gold)" : "var(--surface)"} strokeWidth={p.duda ? 2 : 1.5} strokeDasharray={p.duda ? "2 2" : undefined} />
      <circle cx={X(p.dia)} cy={Y(p.valor)} r="11" fill="transparent"><title>{`${DIA(p.dia)}: ${p.valor}`}</title></circle></g>)}
  </svg>);
}
