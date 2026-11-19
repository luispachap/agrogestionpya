import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GRUPOS, FUNCIONES, PANTALLAS_DE, DE_FABRICA, TOPE_BARRA, TOPE_INICIO, menuDe, buscarEnMenu, prefsVacias, prefsDe, conPrefs,
  ancladasDe, enBarraDe, barraDe, ENFOQUES, faltaEnfoque, elegirEnfoque, alternarGrupo, mezclarPrefs, sellarAcomodo, mismoAcomodo, alternarInicio, alternarBarra, moverEnInicio, volverALoDeFabrica, anotarUso, masUsadas,
} from "./menu.js";

const APP = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const ICONOS = readFileSync(new URL("./icons.jsx", import.meta.url), "utf8");
const BANDERA = { admin: "isAdmin", encargado: "isEncargado", trabajador: "isTrab", cuadrilla: "isCuad", externo: "isExterno", agronomo: "isAgronomo", dueno: "isDueno", finanzas: "isFinanzas" };
const quePinta = (rol) => {
  const m = new RegExp("\\{" + BANDERA[rol] + " && <>([\\s\\S]*?)</>\\}").exec(APP);
  return new Set([...m[1].matchAll(/page === "([^"]+)"/g)].map(x => x[1]));
};

test("el_menu_no_ofrece_a_nadie_una_pantalla_que_la_app_no_le_sabe_abrir", () => {
  for (const rol of Object.keys(PANTALLAS_DE)) {
    const pinta = quePinta(rol);
    for (const id of PANTALLAS_DE[rol]) assert.ok(pinta.has(id), `${rol} no tiene la pantalla "${id}"`);
  }
});

test("ninguna_pantalla_del_administrador_se_queda_fuera_del_menu", () => {
  // "home" es el inicio y "mas-funciones" era el cajón de sastre que el menú reemplaza.
  const faltan = [...quePinta("admin")].filter(id => !["home", "mas-funciones"].includes(id) && !PANTALLAS_DE.admin.includes(id));
  assert.deepEqual(faltan, []);
});

test("cada_pantalla_tiene_nombre_grupo_que_existe_e_icono_dibujado", () => {
  const grupos = new Set(GRUPOS.map(g => g.id));
  for (const [id, fn] of Object.entries(FUNCIONES)) {
    assert.ok(fn.nombre && fn.sub, id);
    assert.ok(grupos.has(fn.grupo), `${id}: grupo ${fn.grupo}`);
    assert.ok(ICONOS.includes(`"${fn.icono}"`) || ICONOS.includes(`"${fn.icono.replace(/️/g, "")}"`), `${id}: el icono ${fn.icono} no está dibujado`);
  }
  for (const rol of Object.keys(PANTALLAS_DE)) for (const id of PANTALLAS_DE[rol]) assert.ok(FUNCIONES[id], `${rol}: ${id} sin ficha`);
});

test("lo_de_fabrica_de_cada_perfil_solo_trae_pantallas_suyas_y_cabe", () => {
  for (const rol of Object.keys(PANTALLAS_DE)) {
    const d = DE_FABRICA[rol];
    for (const id of [...d.barra, ...d.inicio]) assert.ok(PANTALLAS_DE[rol].includes(id), `${rol}: ${id}`);
    assert.ok(d.barra.length <= TOPE_BARRA && d.inicio.length <= TOPE_INICIO);
  }
});

test("el_trabajador_no_ve_el_dinero_ni_buscandolo", () => {
  const ids = menuDe("trabajador").flatMap(g => g.funciones.map(x => x.id));
  assert.ok(!ids.includes("contabilidad") && !ids.includes("socios") && !ids.includes("arranque"));
  assert.deepEqual(buscarEnMenu("trabajador", "finanzas"), []);
  assert.equal(buscarEnMenu("admin", "nomina")[0].id, "nomina", "encuentra sin acento");
  assert.ok(menuDe("trabajador").every(g => g.funciones.length > 0), "sin grupos vacíos");
});

test("quien_no_ha_acomodado_nada_ve_lo_de_su_perfil_y_quien_vacio_su_inicio_lo_ve_vacio", () => {
  assert.deepEqual(ancladasDe("admin", prefsVacias()), DE_FABRICA.admin.inicio);
  assert.deepEqual(ancladasDe("admin", { ...prefsVacias(), inicio: [] }), []);
});

test("anclar_y_soltar_del_inicio_y_de_la_barra_con_su_tope", () => {
  let p = prefsVacias();
  p = alternarInicio("admin", p, "banco").prefs;
  assert.ok(ancladasDe("admin", p).includes("banco"));
  p = alternarInicio("admin", p, "banco").prefs;
  assert.ok(!ancladasDe("admin", p).includes("banco"));
  assert.equal(enBarraDe("admin", p).length, TOPE_BARRA);
  const lleno = alternarBarra("admin", p, "corrida");
  assert.ok(lleno.dice.includes("caben") && !enBarraDe("admin", lleno.prefs).includes("corrida"), "la barra llena avisa y no mete otro");
  p = alternarBarra("admin", p, "inventario").prefs;
  p = alternarBarra("admin", p, "corrida").prefs;
  assert.deepEqual(enBarraDe("admin", p), ["movimientos", "contabilidad", "corrida"]);
});

test("nadie_ancla_una_pantalla_que_no_es_de_su_perfil_aunque_venga_guardada", () => {
  assert.deepEqual(alternarInicio("trabajador", prefsVacias(), "contabilidad").prefs, prefsVacias());
  assert.deepEqual(ancladasDe("trabajador", { ...prefsVacias(), inicio: ["contabilidad", "mis", "no-existe", "mis"] }), ["mis"]);
});

test("mover_un_acceso_lo_sube_o_lo_baja_y_en_la_orilla_no_hace_nada", () => {
  const p = { ...prefsVacias(), inicio: ["papeles", "banco", "corrida"] };
  assert.deepEqual(moverEnInicio("admin", p, "corrida", -1).inicio, ["papeles", "corrida", "banco"]);
  assert.equal(moverEnInicio("admin", p, "papeles", -1), p);
  assert.equal(volverALoDeFabrica(p).inicio, null);
});

test("lo_que_mas_usas_sale_de_la_costumbre_y_no_repite_lo_ya_anclado", () => {
  let p = prefsVacias();
  for (let i = 0; i < 5; i++) p = anotarUso(p, "nomina", `2026-11-1${i}`);
  for (let i = 0; i < 9; i++) p = anotarUso(p, "papeles", `2026-11-1${i}`);   // ya está anclado de fábrica
  p = anotarUso(p, "dron", "2026-11-19");                                      // una vez por curiosidad
  p = anotarUso(p, "no-existe", "2026-11-19");
  assert.deepEqual(masUsadas("admin", p).map(x => x.id), ["nomina"]);
  assert.deepEqual(masUsadas("trabajador", p), [], "el uso de otro perfil no le abre pantallas");
});

test("las_preferencias_son_de_cada_persona_en_el_mismo_telefono", () => {
  let todas = conPrefs({}, "luis", { ...prefsVacias(), inicio: ["banco"] });
  todas = conPrefs(todas, "migue", { ...prefsVacias(), inicio: ["corrida"] });
  assert.deepEqual(prefsDe(todas, "luis").inicio, ["banco"]);
  assert.deepEqual(prefsDe(todas, "migue").inicio, ["corrida"]);
  assert.deepEqual(prefsDe(todas, "otro"), prefsVacias());
  assert.deepEqual(prefsDe(null, "luis"), prefsVacias());
});

test("el_contador_y_el_capataz_abren_con_cosas_distintas_aunque_los_dos_puedan_todo", () => {
  const contador = elegirEnfoque(prefsVacias(), "dinero"), capataz = elegirEnfoque(prefsVacias(), "campo");
  assert.ok(faltaEnfoque("admin", prefsVacias()) && !faltaEnfoque("admin", contador) && !faltaEnfoque("agronomo", prefsVacias()));
  assert.deepEqual(barraDe("admin", contador).map(x => x.id), ["movimientos", "contabilidad", "banco"]);
  assert.deepEqual(barraDe("admin", capataz).map(x => x.id), ["checador", "registrar-actividad", "papeles"]);
  assert.equal(menuDe("admin", contador)[0].id, "dinero");
  assert.equal(menuDe("admin", capataz)[0].id, "campo");
  assert.ok(ancladasDe("admin", capataz).includes("registrar-actividad") && !ancladasDe("admin", capataz).includes("contpaqi"));
  // el enfoque no le quita ni le da pantallas a nadie
  const cuenta = (p) => menuDe("admin", p).reduce((n, g) => n + g.funciones.length, 0);
  assert.equal(cuenta(contador), cuenta(capataz));
  assert.equal(cuenta(contador), PANTALLAS_DE.admin.length);
});

test("lo_de_cada_enfoque_son_pantallas_del_administrador_y_cabe", () => {
  const grupos = GRUPOS.map(g => g.id).sort();
  for (const e of ENFOQUES) {
    for (const id of [...(e.barra || []), ...(e.inicio || [])]) assert.ok(PANTALLAS_DE.admin.includes(id), `${e.id}: ${id}`);
    assert.ok((e.barra || []).length <= TOPE_BARRA && (e.inicio || []).length <= TOPE_INICIO);
    if (e.orden) assert.deepEqual([...e.orden].sort(), grupos, `${e.id}: el orden trae todos los grupos`);
  }
});

test("el_enfoque_de_administrador_no_le_abre_nada_a_otro_perfil", () => {
  const p = elegirEnfoque(prefsVacias(), "dinero");
  assert.deepEqual(ancladasDe("agronomo", p), DE_FABRICA.agronomo.inicio);
  assert.equal(menuDe("agronomo", p)[0].id, "campo");
});

test("esconder_un_grupo_no_quita_el_permiso_y_nunca_se_esconden_todos", () => {
  let p = prefsVacias();
  p = alternarGrupo("agronomo", p, "campo").prefs;
  assert.ok(menuDe("agronomo", p).find(g => g.id === "campo").oculto);
  assert.equal(buscarEnMenu("agronomo", "aplicaciones")[0].id, "aplicaciones", "buscando sigue saliendo");
  const visibles = () => menuDe("agronomo", p).filter(g => !g.oculto).length;
  for (const g of menuDe("agronomo", p)) p = alternarGrupo("agronomo", p, g.id).prefs;
  assert.ok(visibles() >= 1);
  assert.ok(alternarGrupo("externo", prefsVacias(), "gente").dice.includes("al menos un grupo") || menuDe("externo", prefsVacias()).length > 1);
});

test("entre_dos_aparatos_gana_el_acomodo_mas_reciente_y_el_uso_se_junta", () => {
  const tel = sellarAcomodo({ ...prefsVacias(), inicio: ["banco"], uso: { nomina: { n: 5, ult: "b" }, banco: { n: 1, ult: "a" } } }, "2026-11-19T10:00:00Z");
  const compu = sellarAcomodo({ ...prefsVacias(), inicio: ["corrida"], enfoque: "campo", uso: { nomina: { n: 2, ult: "a" }, dron: { n: 4, ult: "c" } } }, "2026-11-19T12:00:00Z");
  const m = mezclarPrefs(tel, compu);
  assert.deepEqual(m.inicio, ["corrida"]); assert.equal(m.enfoque, "campo");
  assert.deepEqual(m.uso, { nomina: { n: 5, ult: "b" }, banco: { n: 1, ult: "a" }, dron: { n: 4, ult: "c" } });
  assert.deepEqual(mezclarPrefs(compu, tel).inicio, ["corrida"], "sin importar de qué lado se mezcle");
  assert.deepEqual(mezclarPrefs(tel, null).inicio, ["banco"], "si en la nube no hay nada, se queda lo del teléfono");
  assert.deepEqual(mezclarPrefs(prefsVacias(), compu).inicio, ["corrida"], "un teléfono nuevo toma lo de la nube");
  assert.ok(mismoAcomodo(m, compu) && !mismoAcomodo(m, tel));
});
