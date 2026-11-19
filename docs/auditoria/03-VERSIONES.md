# Comparación de versiones

Fecha: 18 nov 2026. **Corrige la sección 0 de `00-DIAGNOSTICO.md`**: ahí tomé como
base la versión «recuperada» de 14,759 líneas. Era un error: al examinar el
repositorio que alimenta lo publicado resultó ser bastante más avanzado.

| | A · `agrogestionpya` main | B · recuperada | C · publicada | D · `produccion/base-vigente` |
|---|---|---|---|---|
| Origen | Repo indicado | Archivos sueltos de sep | `vitejs-vite-3ymxjehp` @ `203fc8d` = app.agroselectos.com (comprobado por identificador del despliegue) | C + correcciones P0 |
| Fecha | 22 may | sep | 8 sep | 18 nov |
| Líneas de la app | 7,921 | 14,759 | 18,746 + 20 módulos (≈29,800) | igual que C |
| Pantallas | 47 | 73 | 88 | 88 |
| Pruebas automáticas | 0 | 0 | 555 (pasan) | 571 (pasan) + 9 en navegador |
| Compila | sí | sí | sí | sí |

## Qué tiene cada una

| Capacidad | A | B | C / D |
|---|---|---|---|
| Nube, corrida de ajo, estibas, agroquímicos, remisión, nómina, pase de lista, CONTPAQi, gráficas | — | sí | sí |
| Cálculos fuera del archivo grande, con pruebas (`calculos.js`) | — | — | sí |
| Bitácora de sólo inserción y «cancelar en vez de borrar» el dinero | — | — | sí |
| Buzón de papeles: leer fotos y PDF (`lectura.js`, `lectorPapeles.js`, función `leer-papel`) | — | — | sí |
| Bodega: vales de salida, mermas con causa, conteo a ciegas (`almacen.js`) | — | — | sí |
| Estado de cuenta bancario y conciliación (`banco.js`) | — | — | sí |
| Varios RFC como una empresa (`socios.js`) | — | — | sí |
| Ganado, maquinaria (horómetro/diésel), fertirriego, clima, plan de siembra y predicción, recorrido con dron, vigilancia | — | — | sí |
| Chat del rancho y dictado por voz | — | — | sí |
| Tema claro/oscuro | — | — | sí |
| Asistente de IA que llamaba al proveedor desde el teléfono | sí (roto) | sí (roto) | retirado |
| Pantalla de acceso con el aro degradado («La mezcla») | — | sí | — |

**Lo único que B tiene y C no** es el rediseño de la pantalla de acceso. Es
cosmético; queda anotado para portarlo, no se pierde. Todo lo demás de B está
contenido en C. No encontré ninguna función de A que falte en C salvo la pantalla
vieja de asistencia (sustituida por el pase de lista) y el asistente de IA.

**Decisión tomada:** la base de trabajo pasa a ser **D**. La rama anterior
(`produccion/fase-1-auditoria`, basada en B) se conserva como registro pero ya no
se desarrolla. `main` sigue intacta.

## Consecuencias para lo ya entregado

- **Diagnóstico (`00`)**: de sus 14 evidencias, en C/D siguen vigentes al inicio
  de hoy E2, E7–E13; ya estaban resueltas E1 (edición local pisada) y E14
  (asistente de IA). E3–E6 no las he vuelto a correr sobre `calculos.js`. Tras
  las correcciones de hoy quedan abiertas E2 (registros zombi), E10 parcial y
  las de costos.
- **Incorporación Inteligente (`01`)**: C **ya tiene** un buzón de papeles con
  lectura de fotos/PDF, función en el servidor y tablas (`supabase/18`). Mi
  diseño no partía de cero como creí. Lo siguiente es auditar lo que existe
  contra ese diseño (niveles A/B/C, evidencia por campo, duplicados, criterios
  aprendidos) y completar, no construir en paralelo.
- **Inventario de 65 pantallas**: se hizo sobre B. En C son 88; las 17 nuevas no
  están examinadas. El pendiente real es mayor que «47».

## Lo que NO pasó a este repositorio

El repositorio C contiene además el sistema del despacho contable (`pa_despacho`:
`app.py`, `routers/`, `services/`, `models/`, `agente/`, `static/`, guías de
despliegue). La app del rancho no lo usa (cero llamadas). No lo copié: es otro
producto. Sigue íntegro en su repositorio de origen; nada se borró.
