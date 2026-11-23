// UNA SOLA FUENTE DE VERDAD. Lee docs/ESTADO.json y escribe, siempre iguales entre sí:
//   · docs/AUDITORIA-FUNCIONAL.md   (el inventario de los 67 módulos, defectos, pruebas, publicado y pendientes)
//   · docs/tablero-de-cierre.html   (la misma información, para verla; es lo que se publica como tablero)
// Las cifras (cuántos aprobados, cuántos defectos, qué falta publicar) NO se escriben a mano en ningún lado: se cuentan
// aquí. `node herramientas/estado.mjs` genera; `node herramientas/estado.mjs --revisar` falla si lo generado no coincide
// con lo guardado (lo usa la prueba `src/estado.test.js`).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const leerEstado = () => JSON.parse(readFileSync(join(RAIZ, "docs/ESTADO.json"), "utf8"));

const ESTADOS = ["APROBADO", "PARCIAL", "NO VERIFICADO"];
export function cuentas(e) {
  const por = Object.fromEntries(ESTADOS.map(x => [x, e.modulos.filter(m => m.estado === x)]));
  const corregidos = e.defectos.filter(d => d.estado === "corregido");
  return { total: e.modulos.length, aprobados: por.APROBADO.length, parciales: por.PARCIAL.length, sinVerificar: por["NO VERIFICADO"].length, por,
    defectos: e.defectos.length, corregidos: corregidos.length, sinPublicar: corregidos.filter(d => d.publicado === false), abiertos: e.defectos.filter(d => d.estado === "abierto"),
    soloAbre: por["NO VERIFICADO"].filter(m => /sólo que abre/.test(m.prueba)).length };
}
export function revisar(e) {
  const fallas = [];
  const ns = e.modulos.map(m => m.n);
  if (e.modulos.length !== 67 || new Set(ns).size !== 67 || ns.some((n, i) => n !== i + 1)) fallas.push("Los módulos deben ser 67, numerados del 1 al 67 sin repetir.");
  for (const m of e.modulos) { if (!ESTADOS.includes(m.estado)) fallas.push(`Módulo ${m.n}: estado desconocido «${m.estado}».`); if (m.estado !== "NO VERIFICADO" && !/auditoria_|entrega/.test(m.prueba)) fallas.push(`Módulo ${m.n} (${m.nombre}) dice ${m.estado} sin un recorrido de auditoría que lo respalde.`); if (m.estado === "PARCIAL" && (!m.falta || m.falta === "—")) fallas.push(`Módulo ${m.n}: PARCIAL sin decir qué falta.`); }
  for (const m of e.nuevas || []) if (m.estado !== "NO VERIFICADO" && !/auditoria_|entrega/.test(m.prueba)) fallas.push(`Lo nuevo «${m.nombre}» dice ${m.estado} sin un recorrido.`);
  const dn = e.defectos.map(d => d.n);
  if (new Set(dn).size !== dn.length) fallas.push("Hay defectos con el mismo número.");
  for (const d of e.defectos) { if (!["corregido", "abierto"].includes(d.estado)) fallas.push(`Defecto ${d.n}: estado desconocido.`); if (d.estado === "corregido" && typeof d.publicado !== "boolean") fallas.push(`Defecto ${d.n}: corregido sin decir si está publicado.`); }
  for (const p of e.publicado) if (!["publicado", "instalado", "sin_publicar", "sin_estrenar", "sin_otorgar"].includes(p.estado)) fallas.push(`Publicado: estado desconocido en «${p.que}».`);
  return fallas;
}

const estadoDe = (d) => d.estado === "abierto" ? `Abierto${d.nota ? `: ${d.nota}` : ""}` : `Corregido ${d.publicado ? "y publicado" : "**sin publicar**"}${d.nota ? `: ${d.nota}` : ""}`;
const NOMBRE_PUB = { publicado: "Publicado", instalado: "Instalado en la base", sin_publicar: "Sin publicar", sin_estrenar: "Sin estrenar", sin_otorgar: "Sin otorgar" };

export function documento(e) {
  const c = cuentas(e); const L = [];
  L.push("# Auditoría funcional de AgroGestión 1.0 — los 67 módulos", "",
    "> **Generado desde `docs/ESTADO.json` con `node herramientas/estado.mjs`. No se edita a mano:** se cambia el archivo de estado y se vuelve a generar. Es la única fuente de las cifras, los módulos, los pendientes y lo publicado; el tablero de cierre sale de aquí mismo.", "",
    `Corte: ${e.corte}. **${c.aprobados} aprobados · ${c.parciales} recorridos en parte · ${c.sinVerificar} sin verificar.**`, "",
    `**Veredicto: ${e.veredicto.sello}** ${e.veredicto.detalle}. ${e.veredicto.texto}`, "",
    "## Qué significa cada estado", "",
    "- **APROBADO**: se usó como una persona, desde un teléfono imitado, contra una nube de imitación que guarda y devuelve con cuentas: capturar datos inventados pero realistas, comprobar el resultado en pantalla **y** en lo guardado, recargar y volver, corregir y cancelar, otros perfiles intentando lo que no les toca, otro teléfono, y su llegada a los módulos que dependen de él.",
    "- **PARCIAL**: lo recorrido pasa, pero faltan partes del módulo, que se nombran. No es aprobado.",
    "- **NO VERIFICADO**: no se ha recorrido con este criterio. La columna «Prueba» dice qué recorrido ya lo tocaba *antes*; es evidencia previa, no la auditoría. «Sólo que abre» no cuenta. Que sus pruebas unitarias pasen tampoco.", "",
    "**Lo que ningún estado incluye:** teléfonos de verdad, señal del rancho, cámara, impresora, correos reales ni producción. Eso es la prueba de campo, aparte.", "",
    "## Pruebas ejecutadas sobre la versión vigente", "", "| Qué | Con qué | Resultado |", "|---|---|---|", ...e.pruebas.map(p => `| ${p.que} | \`${p.con}\` | ${p.resultado} |`), "",
    "## Qué está publicado y qué no", "", "| Qué | Estado | Detalle |", "|---|---|---|", ...e.publicado.map(p => `| ${p.que} | **${NOMBRE_PUB[p.estado]}** | ${p.detalle || ""} |`), "",
    `## Defectos encontrados al usar los módulos (${c.defectos}: ${c.corregidos} corregidos, ${c.sinPublicar.length} de ellos sin publicar; ${c.abiertos.length} abiertos)`, "",
    "| # | Módulo | Qué pasaba | Nivel | Estado |", "|---|---|---|---|---|", ...e.defectos.map(d => `| ${d.n} | ${d.modulo} | ${d.que} | ${d.nivel} | ${estadoDe(d)} |`), "",
    "## Lo que no se pudo ejecutar y por qué", "", ...e.no_se_pudo.map(x => `- ${x}`), "",
    "## Inventario", "", "| # | Módulo | Estado | Prueba | Qué se probó | Qué falta |", "|---|---|---|---|---|---|",
    ...e.modulos.map(m => `| ${m.n} | ${m.nombre} | ${m.estado === "NO VERIFICADO" ? m.estado : `**${m.estado}**`} | ${m.prueba} | ${m.probado} | ${m.falta} |`), "",
    ...((e.nuevas || []).length ? ["## Lo nuevo, fuera de los 67 (pedido por Luis el 23 nov)", "", "| Qué | Estado | Prueba | Qué se probó | Qué falta |", "|---|---|---|---|---|",
      ...e.nuevas.map(m => `| ${m.nombre} | **${m.estado}** | ${m.prueba} | ${m.probado} | ${m.falta || ""} |`), ""] : []),
    "## Orden en que sigue", "", ...e.orden.map((x, i) => `${i + 1}. ${x}`), "",
    "## Qué falta para decir «listo»", "", ...e.para_listo.map((p, i) => `${i + 1}. **${p.t}.** ${p.d}`), "",
    "## Lo que le toca a Luis", "", ...e.de_luis.map(x => `- ${x}`), "",
    "## Pendientes menores que pueden esperar", "", ...e.pendientes_menores.map(x => `- ${x}`), ...c.abiertos.map(d => `- Defecto ${d.n} (${d.modulo}): ${d.que}.`), "",
    "## Riesgos que quedan aunque todo pase", "", ...e.riesgos.map(x => `- ${x}`), "");
  return L.join("\n");
}

const h = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rico = (t) => h(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
const sello = (clase, texto) => `<span class="p ${clase}">${h(texto)}</span>`;
const CLASE = { APROBADO: "ok", PARCIAL: "aviso", "NO VERIFICADO": "gris" };

export function tablero(e, estilos) {
  const c = cuentas(e);
  const nombres = (l) => l.map(m => m.nombre).join(", ");
  return `<title>Cierre AgroGestión 1.0</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
${estilos}
</style>

<div class="hoja">
  <header style="display:flex;flex-direction:column;gap:6px">
    <h1>AgroGestión 1.0 · tablero de cierre</h1>
    <div class="corte">Corte: ${h(e.corte)} · ${c.aprobados} módulos aprobados, ${c.parciales} en parte y ${c.sinVerificar} sin verificar, de ${c.total} · ${c.defectos} defectos encontrados, ${c.corregidos} corregidos${c.sinPublicar.length ? `, ${c.sinPublicar.length} de ellos sin publicar` : ", todos publicados"}</div>
  </header>

  <div class="veredicto">
    <div class="sello">${h(e.veredicto.sello)} <small>${h(e.veredicto.detalle)}</small></div>
    <p>${rico(e.veredicto.texto)}</p>
    <div class="razones">${e.veredicto.razones.map(r => `<div><b>${h(r.t)}</b><span>${rico(r.d)}</span></div>`).join("")}</div>
  </div>

  <section>
    <h2>Qué lo vuelve LISTO</h2>
    <ol class="pasos">${e.para_listo.map(p => `<li><b>${h(p.t)}</b><span>${rico(p.d)}</span></li>`).join("")}</ol>
    <div class="dos">
      <div class="si"><h3>Lo que sí se puede hacer ya, como prueba de campo</h3><ul class="lista">${e.se_puede.map(x => `<li>${rico(x)}</li>`).join("")}</ul></div>
      <div class="no"><h3>Lo que todavía no</h3><ul class="lista">${e.no_se_puede.map(x => `<li>${rico(x)}</li>`).join("")}</ul></div>
    </div>
  </section>

  <section>
    <h2>Auditoría funcional: usar cada módulo como una persona</h2>
    <p>Un módulo sólo se aprueba así: capturar datos realistas desde un teléfono imitado, comprobar la cifra en pantalla y en lo guardado, recargar, cancelar, verlo en otro aparato, quitarle la señal a uno y entrar con otros perfiles. Que abra, o que sus pruebas de cálculo pasen, no cuenta.</p>
    <div class="cifras">
      <div><b>${c.aprobados}</b><span>aprobados: ${h(nombres(c.por.APROBADO))}</span></div>
      <div><b>${c.parciales}</b><span>en parte: ${h(nombres(c.por.PARCIAL))}</span></div>
      <div><b>${c.sinVerificar}</b><span>sin verificar con este criterio; de ellos, ${c.soloAbre} sólo se sabe que abren</span></div>
      <div><b>${c.defectos}</b><span>defectos encontrados al usarlos: ${c.corregidos} corregidos y vueltos a probar${c.sinPublicar.length ? ` (${c.sinPublicar.length} sin publicar)` : " y publicados"}, ${c.abiertos.length} abiertos</span></div>
    </div>
  </section>

  <section>
    <h2>Pruebas ejecutadas sobre la versión vigente</h2>
    <div class="tabla"><table><thead><tr><th>Qué</th><th>Con qué</th><th>Resultado</th></tr></thead><tbody>
${e.pruebas.map(p => `      <tr><td>${rico(p.que)}</td><td><code>${h(p.con)}</code></td><td class="n">${rico(p.resultado)}</td></tr>`).join("\n")}
    </tbody></table></div>
  </section>

  <section>
    <h2>Qué está publicado y qué no</h2>
    <div class="tabla"><table><thead><tr><th>Qué</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>
${e.publicado.map(p => `      <tr><td>${rico(p.que)}</td><td>${sello(["publicado", "instalado"].includes(p.estado) ? "ok" : "aviso", NOMBRE_PUB[p.estado])}</td><td>${rico(p.detalle || "")}</td></tr>`).join("\n")}
    </tbody></table></div>
  </section>

  <section>
    <h2>Defectos encontrados al usar los módulos</h2>
    <div class="tabla"><table><thead><tr><th>#</th><th>Módulo</th><th>Qué pasaba</th><th>Nivel</th><th>Estado</th></tr></thead><tbody>
${e.defectos.map(d => `      <tr><td class="n">${d.n}</td><td>${h(d.modulo)}</td><td>${rico(d.que)}${d.nota ? `<div class="nota">${rico(d.nota)}</div>` : ""}</td><td>${sello(d.nivel === "P0" ? "falla" : d.nivel === "P1" ? "aviso" : "gris", d.nivel)}</td><td>${d.estado === "abierto" ? sello("aviso", "Abierto") : d.publicado ? sello("ok", "Corregido y publicado") : sello("aviso", "Corregido, sin publicar")}</td></tr>`).join("\n")}
    </tbody></table></div>
  </section>

  <section>
    <h2>Módulo por módulo</h2>
    <div class="tabla"><table><thead><tr><th>#</th><th>Módulo</th><th>Estado</th><th>Prueba</th><th>Qué se probó</th><th>Qué falta</th></tr></thead><tbody>
${e.modulos.map(m => `      <tr><td class="n">${m.n}</td><td>${h(m.nombre)}</td><td>${sello(CLASE[m.estado], m.estado === "APROBADO" ? "Aprobado" : m.estado === "PARCIAL" ? "En parte" : "Sin verificar")}</td><td>${rico(m.prueba)}</td><td>${rico(m.probado)}</td><td>${rico(m.falta)}</td></tr>`).join("\n")}
    </tbody></table></div>
${(e.nuevas || []).length ? `    <h3>Lo nuevo, fuera de los 67</h3>
    <div class="tabla"><table><thead><tr><th>Qué</th><th>Estado</th><th>Prueba</th><th>Qué se probó</th><th>Qué falta</th></tr></thead><tbody>
${e.nuevas.map(m => `      <tr><td>${h(m.nombre)}</td><td>${sello(CLASE[m.estado], m.estado === "APROBADO" ? "Aprobado" : m.estado === "PARCIAL" ? "En parte" : "Sin verificar")}</td><td>${rico(m.prueba)}</td><td>${rico(m.probado)}</td><td>${rico(m.falta || "")}</td></tr>`).join("\n")}
    </tbody></table></div>
` : ""}    <h3>Lo que no se pudo ejecutar y por qué</h3>
    <ul class="lista">${e.no_se_pudo.map(x => `<li>${rico(x)}</li>`).join("")}</ul>
    <h3>Orden en que sigue</h3>
    <ol class="lista">${e.orden.map(x => `<li>${rico(x)}</li>`).join("")}</ol>
  </section>

  <section>
    <h2>Pendientes</h2>
    <div class="dos">
      <div><h3>Lo que le toca a Luis</h3><ul class="lista">${e.de_luis.map(x => `<li>${rico(x)}</li>`).join("")}</ul></div>
      <div><h3>Menores, que pueden esperar</h3><ul class="lista">${[...e.pendientes_menores, ...c.abiertos.map(d => `Defecto ${d.n} (${d.modulo}): ${d.que}.`)].map(x => `<li>${rico(x)}</li>`).join("")}</ul></div>
    </div>
  </section>

  <section>
    <h2>Riesgos que quedan aunque todo pase</h2>
    <ul class="lista">${e.riesgos.map(x => `<li>${rico(x)}</li>`).join("")}</ul>
  </section>

  <div class="pie">Este tablero y <code>docs/AUDITORIA-FUNCIONAL.md</code> se generan del mismo archivo de estado: no pueden decir cosas distintas.</div>
</div>
`;
}

export function generar() {
  const e = leerEstado();
  const estilos = readFileSync(join(RAIZ, "herramientas/estado.css"), "utf8").trimEnd();
  return { fallas: revisar(e), md: documento(e), html: tablero(e, estilos) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { fallas, md, html } = generar();
  if (fallas.length) { console.error(fallas.join("\n")); process.exit(1); }
  const destinos = [["docs/AUDITORIA-FUNCIONAL.md", md], ["docs/tablero-de-cierre.html", html]];
  if (process.argv.includes("--revisar")) {
    const distintos = destinos.filter(([ruta, texto]) => { try { return readFileSync(join(RAIZ, ruta), "utf8") !== texto; } catch { return true; } });
    if (distintos.length) { console.error(`No coincide con docs/ESTADO.json: ${distintos.map(d => d[0]).join(", ")}. Corre: node herramientas/estado.mjs`); process.exit(1); }
    console.log("El documento y el tablero coinciden con docs/ESTADO.json");
  } else { for (const [ruta, texto] of destinos) writeFileSync(join(RAIZ, ruta), texto); const c = cuentas(leerEstado()); console.log(`Generado: ${c.aprobados} aprobados, ${c.parciales} en parte, ${c.sinVerificar} sin verificar; ${c.defectos} defectos, ${c.sinPublicar.length} sin publicar, ${c.abiertos.length} abiertos`); }
}
