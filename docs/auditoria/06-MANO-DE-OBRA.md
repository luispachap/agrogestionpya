# 06 · Costo de mano de obra, vuelto a verificar sobre la versión correcta

Los tres hallazgos del diagnóstico se repitieron sobre `src/calculos.js` (la
versión publicada). Los tres seguían ahí.

| # | Hallazgo | Estado |
|---|---|---|
| E4 | Subirle el sueldo a alguien **reescribía el costo de todos los meses pasados** (el cálculo usaba el sueldo de hoy) | **Corregido en rama, con prueba.** Cada actividad nueva guarda la "foto" del sueldo de ese día |
| E5 | Borrar a un trabajador **borraba en silencio todo lo que había costado** | **Corregido en rama, con prueba** para lo capturado de hoy en adelante. Para lo viejo, ya no desaparece callado: el cálculo devuelve la lista de días sin costo |
| E3 | Una hora de trabajo carga el día completo | **No se tocó: es regla de pago, decide Luis y Migue** (D-4) |

## Lo que hay que decidir (D-4), con el detalle encontrado

Hoy conviven **dos reglas distintas** en la app:

- La pantalla de registro del administrador calcula `sueldo × horas ÷ 8` y lo
  deja guardado: 1 hora = un octavo del día.
- Todo lo demás reparte **el día completo** entre las parcelas donde estuvo:
  1 hora en una sola parcela = el día entero cargado a esa parcela.

Si a la persona se le paga el día completo aunque trabaje medio, la segunda es
correcta como *costo*. Si se le paga por hora, es la primera. Lo que no puede
seguir es que dependa de por cuál pantalla se capturó.

## Límites de la corrección

- **Los registros anteriores no traen foto del sueldo.** Siguen calculándose con
  el sueldo del catálogo de hoy. Se pueden "congelar" de una vez con los sueldos
  actuales, pero eso modifica datos reales: **requiere autorización**.
- La lista de días sin costo ya se calcula pero **todavía no se enseña en
  pantalla**.
- No cambia cuánto se le paga a nadie. Sólo deja escrito con qué sueldo se
  costeó cada día.
