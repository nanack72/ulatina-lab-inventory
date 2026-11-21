# Rotación de credenciales

Si una contraseña estuvo escrita en archivos versionados, debe reemplazarse aunque ya se haya eliminado del código.

1. Definir NUEVA_CONTRASENA con una clave nueva y ejecutar npm run rotar:contrasena -- correo@ulatina.net desde backend.
2. El cambio de contraseña no invalida las sesiones existentes. Para invalidarlas todas, renovar JWT_SECRET en el servidor y reiniciar.
3. Si se necesita limpiar el historial de Git, coordinarlo con el equipo antes de reescribirlo.
4. Las pruebas leen TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD desde .env; no escribir credenciales reales en archivos versionados.
5. Verificar que .env esté en .gitignore.
