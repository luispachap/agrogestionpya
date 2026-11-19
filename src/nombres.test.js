// Ningún nombre sin definir en la app.
//
// La compilación NO detecta un nombre que se usa y nunca se importó: compila
// feliz y la pantalla truena cuando alguien la abre. Ya pasó con el panel del
// dueño, y volvió a pasar con `sellarSueldoDelDia` (se usaba al guardar una
// actividad y nadie la había importado). Esta prueba lee el código y avisa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default || _traverse;

const DEL_NAVEGADOR = new Set(("window document navigator localStorage sessionStorage indexedDB console alert confirm prompt fetch " +
  "setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame Promise Math JSON Date Object Array String Number Boolean " +
  "Map Set WeakMap Symbol Error TypeError RegExp parseFloat parseInt isNaN isFinite Infinity NaN undefined Intl URL URLSearchParams Blob File FileReader " +
  "Image crypto TextEncoder TextDecoder Uint8Array Uint32Array DataView ArrayBuffer atob btoa encodeURIComponent decodeURIComponent encodeURI " +
  "DOMParser BarcodeDetector MediaRecorder AbortController FormData Event CustomEvent DOMException Storage globalThis location history screen " +
  "structuredClone queueMicrotask performance Notification caches self Audio SpeechRecognition webkitSpeechRecognition speechSynthesis " +
  "SpeechSynthesisUtterance HTMLElement Node getComputedStyle matchMedia open close print arguments Reflect Proxy BigInt Float32Array Float64Array " +
  "Uint8ClampedArray Int32Array createImageBitmap OffscreenCanvas ImageData XMLSerializer ResizeObserver IntersectionObserver MutationObserver escape unescape").split(" "));

function sinDefinir(archivo) {
  const codigo = readFileSync(new URL(archivo, import.meta.url), "utf8");
  const arbol = parse(codigo, { sourceType: "module", plugins: ["jsx"] });
  const faltan = new Map();
  traverse(arbol, {
    ReferencedIdentifier(camino) {
      const n = camino.node.name;
      if (camino.isJSXIdentifier() && /^[a-z]/.test(n)) return;        // <div>, <span>
      if (camino.scope.hasBinding(n) || DEL_NAVEGADOR.has(n)) return;
      if (camino.parentPath.isMetaProperty()) return;                  // import.meta
      if (!faltan.has(n)) faltan.set(n, camino.node.loc.start.line);
    },
  });
  return [...faltan].map(([n, l]) => `${n} (renglón ${l})`);
}

for (const f of readdirSync(new URL(".", import.meta.url)).filter(f => /\.(jsx|js)$/.test(f) && !/\.test\.js$/.test(f))) {
  test(`ningun_nombre_sin_definir_en_${f.replace(/\W/g, "_")}`, () => {
    assert.deepEqual(sinDefinir("./" + f), []);
  });
}
