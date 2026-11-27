# Sistema de inventario de activos tecnológicos

Proyecto de Práctica Empresarial Supervisada de Arianna Quirós García y Óscar Andrés Mononga Espitia para la Universidad Latina de Costa Rica. Centraliza el inventario de los laboratorios y el seguimiento de los equipos por sede.

## Funciones

- Inventario con búsqueda, filtros y paginación. Registro, edición, traslado, cambio de estado, eliminación lógica y restauración según permisos.
- Historial de cambios por equipo, fotografías e importación de equipos desde archivos Excel.
- Panel de Inicio con accesos al inventario filtrado y criterios de revisión por antigüedad y condición. La antigüedad se configura por categoría.
- Mantenimientos, evidencias fotográficas, incidencias, reportes y exportación básica a Excel.
- Gestión de cuentas, roles, sedes, laboratorios, categorías y estados.

## Tecnologías

React, Vite y CSS propio en el frontend. Node.js y Express en el backend. PostgreSQL para datos, historiales y fotografías nuevas. Neon se usa en el ambiente de demostración.

## Instalación local

1. Instalá Node.js 22.12 o posterior y prepará una base PostgreSQL de desarrollo.
2. Restaurá el esquema base, incluidos los mecanismos de historial. Si partís de un esquema anterior, aplicá en orden las migraciones pendientes de `database/migrations`. Las migraciones requieren el esquema inicial. En una base de demo, cargá catálogos y una cuenta de prueba.
3. Copiá `backend/.env.example` a `backend/.env`. Configurá `DATABASE_URL` con la conexión de desarrollo y `JWT_SECRET` con un secreto propio. Usá `PORT=3000` para el proxy local de Vite. La recuperación por correo requiere configurar `FRONTEND_URL` y las variables SMTP.
4. Desde la raíz del repositorio, instalá las dependencias:

   ```sh
   npm --prefix backend ci
   npm --prefix frontend ci --include=dev
   ```

5. Abrí dos terminales en la raíz. Ejecutá `npm --prefix backend run dev` en una y `npm --prefix frontend run dev` en la otra. Abrí la URL que muestre Vite, normalmente `http://localhost:5173`. Podés comprobar la conexión de la API en `http://localhost:3000/api/health/db`.

## Pruebas

Desde la raíz del repositorio:

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Algunas pruebas de integración del backend requieren una API y credenciales de prueba configuradas. Usá un entorno separado con datos ficticios.

## Despliegue

Compilá el frontend con `npm --prefix frontend run build` e iniciá Express con `npm --prefix backend start`. El frontend usa rutas relativas `/api`. En la rama de demo de Render, Express debe servir `frontend/dist`; en un despliegue separado, configurá el servidor web para dirigir `/api` al backend bajo el mismo dominio. El proxy de Vite corresponde al entorno local.

Configurá los secretos en la plataforma de despliegue y usá una base de demo independiente. Para un despliegue institucional, prepará un rol de base con permisos limitados y verificá los accesos por laboratorio y la restauración de respaldos.
