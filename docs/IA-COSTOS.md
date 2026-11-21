# Qué consume IA en AgroGestión y cómo se controla (21 nov 2026)

**Arquitectura híbrida:** reglas y cálculos propios para todo lo que resuelven con fiabilidad; un modelo sólo cuando
aporta y con costo controlado. Un mensaje cotidiano no gasta.

## Qué NO llama a ningún modelo
Mensajes entre personas, mensajes a AgroGestión, propuestas, preguntas de lo que falta, aclaraciones, memoria,
«¿de dónde salió?», avisos al teléfono, transcripción de audios (la hace el dictado del teléfono).

## Qué SÍ, y sólo a petición
| Función del servidor | Cuándo | Modelo | Tope |
|---|---|---|---|
| `leer-papel` | Alguien pide leer una foto (botón del mensaje, o la pantalla de Papeles) | Haiku; Sonnet sólo si lo pide un administrador | Mensual (hoja 50) |
| `interpretar-documento` | «Lectura con IA» en Importar documentos | Haiku; Sonnet a petición | Total de 4 USD (hoja 44) y también cuenta en el mes |

No instaladas (no pueden gastar): `oir-audio`, `revisar-parcela`, `whatsapp-entrada`.
`comprobar-ia`: sirvió para las comprobaciones reales del 20 nov. Está **apagada** (contesta «cerrada» y no hace nada
más), no gasta y nada en el código la llama. Sigue instalada sólo porque no se ha borrado.

## Controles
- **Una foto en un mensaje no se lee sola.** Al mandarla sólo corre lo gratis (QR de factura). La lectura pagada se pide.
- **Tope del mes** `limites.ia_mes_tope_microusd` (3 USD de arranque; lo cambia un superadministrador). Se APARTA lo
  máximo antes de llamar y se anota lo real después: dos lecturas a la vez no lo rebasan.
- **Aviso** desde `ia_mes_aviso_pct` (70 %): en la respuesta de la lectura y al abrir la app para administración y
  finanzas. **Bloqueo** al llegar: ya no se llama al modelo.
- **Una lectura por documento** (por huella): la misma foto no se cobra dos veces.
- **Cada llamada queda en `uso_ia`** con cuenta, modelo, nivel, tokens de entrada y salida, costo, operación
  (`papel`, `foto_en_mensaje`…) y de qué registro salió. `estado_de_ia()` lo resume.

## Pendiente
- Pantalla para ver el detalle por usuario y por día, y para cambiar el tope sin tocar la base.
- La función `leer-papel` no tiene prueba automática propia (sí la tiene el tope en la base: `pruebas/base/tope_ia.test.mjs`).
  **La lectura nueva (Haiku) no se ha probado con una foto real**: la primera lectura real hay que revisarla.
- El dictado del teléfono no nos cuesta, pero en Chrome el audio suele pasar por servidores de Google.
