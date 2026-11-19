# Supabase: recuperación, y pruebas antes de conectar datos reales

**Nada de esto se ha ejecutado.** La base está pausada y reactivarla es decisión
de Luis. No se conectan datos reales hasta pasar la sección 3.

## 1 · Reactivar sin perder nada (lo hace Luis en el panel)

1. Entrar a supabase.com → proyecto **AgroGestion** → "Restore project".
   Un proyecto gratuito pausado sólo se puede restaurar por tiempo limitado:
   **es lo más urgente de toda la lista.**
2. **Antes de tocar nada más, sacar un respaldo:** Database → Backups, o que yo
   lo descargue con autorización. Guardarlo fuera de Supabase.
3. Authentication → Users: revisar la lista. Cualquier cuenta que nadie
   reconozca se desactiva. Cambiar la contraseña de la cuenta técnica vieja.
4. Authentication → Sign In / Providers: apagar "Allow new users to sign up".
5. Avisarme: reviso (sólo lectura) cuántos registros hay por tabla y qué
   perfiles existen, sin copiar datos personales a ningún informe.

## 2 · Orden para aplicar los permisos nuevos

Primero en una **copia** (una rama de Supabase o un proyecto de prueba), nunca
directo:

1. Correr las hojas pendientes: 18 (papeles) y las que el SQL 14 marque.
2. Correr la **24**. En ese momento las cuentas con rol "admin" dejan de poder
   (a propósito).
3. Correr el paso final de la 24 con los correos de Luis y Migue.
4. Probar la sección 3. Si algo estorba el trabajo: hoja **25** (reversa).
5. Sólo entonces, repetir en la base real — con respaldo del mismo día.

## 3 · Pruebas que deben pasar antes de conectar datos reales

**Seguridad** (con cuentas de prueba, llamando directo a la base):
- [ ] Las 16 pruebas de `pruebas/base/` repetidas contra la copia real.
- [ ] Registrarse como cuenta nueva: no se puede, o no ve nada.
- [ ] Los avisos de seguridad del propio Supabase, sin pendientes críticos.

**Sincronización** (dos teléfonos, datos de mentira):
- [ ] Capturar sin señal en A, volver la señal: aparece en B, una sola vez.
- [ ] Editar lo mismo en A y B sin señal: gana el último, y el otro se entera.
- [ ] Borrar en A: no revive en B. *(Hoy falla: registros zombi.)*
- [ ] Llenar la memoria del teléfono: sale el aviso y no se pierde lo pendiente.
- [ ] 200 capturas seguidas: cero pérdidas, cero duplicados.

**Respaldo:**
- [ ] Descargar respaldo → restaurarlo en un proyecto vacío → contar registros
      por tabla: iguales. **Un respaldo que nunca se ha restaurado no es un
      respaldo.**
- [ ] Dejar escrito quién lo saca, cada cuándo y dónde se guarda. El plan
      gratuito no trae respaldos automáticos descargables; el de paga sí
      (costo mensual — **decisión de Luis**, no se contrata sin autorización).

## 4 · Si algo sale mal

| Qué pasó | Qué hacer |
|---|---|
| Alguien no puede trabajar tras la 24 | Darle el permiso en `permisos_rol`, o hoja 25 |
| Se dañaron datos | Restaurar el respaldo del paso 1.2 |
| La app publicada falla | Vercel → Deployments → promover el anterior |
