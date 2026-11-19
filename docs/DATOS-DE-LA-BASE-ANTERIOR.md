# Los datos de antes: se conservan, no se importan

19 nov 2026. AgroGestión nunca operó de verdad: lo guardado son pruebas, con
algunos catálogos reales mezclados. Por decisión de Luis, **nada de eso entra a
la operación nueva** salvo los catálogos que él y Migue aprueben
(`ARRANQUE-LIMPIO.md`). Y **nada se borra**.

## Dónde está cada cosa y qué se hace con ella

| Qué | Dónde | Qué se hace |
|---|---|---|
| La base anterior | Proyecto "AgroGestion" en la organización "P&A", pausado | **Nada.** No se reactiva, no se modifica, no se borra. No es requisito para arrancar |
| Lo que guarda cada teléfono | En el propio teléfono, en su cajón de antes | **Nada.** La versión nueva no lo lee ni lo borra. Se puede descargar para archivo |
| Respaldos descargados antes | Donde los tengan | Conservarlos. Sirven como fuente de catálogos |
| La rama `main` y los despliegues viejos | GitHub y Vercel | Se conservan |

Ya no es urgente respaldar los teléfonos: la versión nueva no pone en riesgo lo
que traen. Sólo conviene **no** usar en la versión vieja "Recargar desde la
nube" ni "Reiniciar datos", que sí lo borran.

## El 19 de diciembre

Cuando Supabase levante la restricción, la base anterior se podrá abrir o
descargar. Servirá para dos cosas, ninguna urgente: buscar catálogos que no
estén en ningún teléfono, y guardarla como archivo. Aun si pasan los 90 días en
que se reactiva con un botón, Supabase sigue ofreciendo descargar su respaldo.

## Lo que nunca se copia

Cuentas, contraseñas, la cuenta técnica, los PIN de dirección y de trabajadores,
existencias, costos, saldos y cualquier movimiento.
