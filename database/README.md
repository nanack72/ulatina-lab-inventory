
# Seguridad de la base de datos

## Cuenta de ejecución

Se creó el rol `pes_runtime` para conectar el backend
Express con PostgreSQL en Neon utilizando permisos limitados.

Las tablas pertenecen al rol `pes_owner`.

## Permisos configurados

- SELECT sobre las tablas necesarias para la aplicación.
- SELECT por columnas sobre `public.usuario`.
- INSERT y UPDATE sobre `public.equipo`.
- INSERT sobre los historiales de cambio, estado y ubicación.
- UPDATE de la columna `motivo` en `historial_estado`.
- INSERT y UPDATE por columnas en `bitacora_mantenimiento`.
- USAGE sobre las secuencias necesarias.

No se concedieron permisos DELETE ni TRUNCATE.

La cuenta no tiene acceso SELECT a `vw_inventario_general`.

## Pruebas realizadas

- Conexión a PostgreSQL con `pes_runtime`.
- Consulta de equipos.
- Registro temporal de equipos.
- Generación automática de historiales.
- Actualización temporal de equipos.
- Registro y actualización de mantenimientos.
- Actualización del motivo del historial de estados.
- Reversión de operaciones mediante ROLLBACK.
- Inicio de sesión desde React.
- Consulta de inventario con autenticación JWT.
- Restricción de equipos según laboratorio autorizado.

## Pendientes

- Revisar los permisos del módulo de mantenimiento por laboratorio.
- Implementar revocación de JWT al cerrar sesión.
- Completar las correcciones de seguridad identificadas en la revisión.
- Preparar una migración SQL reproducible y verificada.
