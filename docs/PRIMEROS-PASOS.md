# Primeros pasos — AgroGestión ya está instalado

**Dónde se abre:** https://agrogestion-operacion.vercel.app
(En el teléfono: abrirlo en Chrome o Safari → menú → "Agregar a pantalla de inicio".)

La dirección de siempre, app.agroselectos.com, **no se tocó**: sigue con la
versión vieja hasta que ustedes decidan cambiarla.

## 1 · Luis y Migue crean su cuenta (cada quien la suya)

1. Abrir la dirección → **"Es mi primera vez: crear mi cuenta"**.
2. Nombre, correo y una contraseña de 10 caracteres o más. La contraseña es de
   cada quien: no se comparte ni me la pasan a mí.
3. Llega un correo de Supabase: tocar el enlace para confirmar. **La página que
   abre el enlace puede salir en blanco o con error — no importa**: el correo
   ya quedó confirmado. Regresar a la app.
4. En la app: tocar **Admin**, escribir correo y contraseña → Entrar.
5. La primera vez dirá que la cuenta no está invitada y aparecerá el campo
   **Código de arranque**. Escribir el código que Luis recibió y entrar otra vez.

El código sirve **dos veces** (una por cada uno) y caduca el **3 de diciembre**.
Después de eso nadie más puede hacerse superadministrador con él.

## 2 · Lo que sigue, todo desde la app → Admin → **Arranque**

| Pestaña | Qué se hace |
|---|---|
| **Cuentas** | Invitar a encargados, finanzas, agrónomo y dirección: nombre, correo y rol. Cada quien crea su cuenta con ese correo |
| **Conteo** | Inventario inicial: fecha, dónde se contó, quién contó y lo contado de cada artículo |
| **Saldos** | Saldo inicial de cada cuenta o caja: fecha de corte, monto, responsable y evidencia |
| **Inicio** | Declarar la fecha oficial de inicio. Una sola vez; ya no se cambia |
| **Estado** | Qué falta de todo lo anterior |

Antes del conteo y los saldos hay que dar de alta lo básico: parcelas y
trabajadores (Admin → Equipo / Parcelas), los artículos del almacén, y las
cuentas y cajas (Socios y bolsas). O cargar los catálogos aprobados
(`ARRANQUE-LIMPIO.md`, sección 3).

## 3 · Gente de campo

Un encargado entra con su cuenta y, **al salir**, acepta dejar su teléfono
ligado. Desde ese teléfono los trabajadores entran con su PIN y lo que
capturan sube solo.

## Si algo no funciona

Captura de pantalla y me la mandas. Lo que sé que puede pasar:

- **No llega el correo de confirmación.** El servicio gratuito manda pocos
  correos por hora; esperar unos minutos y revisar la carpeta de spam.
- **"Falta confirmar tu correo".** No se tocó el enlace del mensaje.
- **Leer tickets por foto** dirá que la lectura con IA no está configurada:
  es cierto, falta la llave de IA. El XML de una factura sí se lee, gratis.
