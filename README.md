## Sistema de Inventario de Activos Tecnológicos — PES

Sistema web desarrollado como parte de la **Práctica Empresarial Supervisada (PES)** para apoyar la administración y el control de los equipos tecnológicos de los laboratorios de la **Universidad Latina de Costa Rica, sede Heredia**.

## Descripción del proyecto

El proyecto tiene como finalidad desarrollar una plataforma web que permita centralizar la información de los activos tecnológicos, facilitando su registro, consulta, actualización, localización y seguimiento.

El sistema contempla la gestión del inventario, el historial de movimientos y cambios de estado, el control de mantenimientos, la administración de usuarios y el acceso según roles y permisos.

## Objetivo

Desarrollar un sistema web que facilite la gestión y el seguimiento de los activos tecnológicos de los laboratorios universitarios, contribuyendo a mejorar la organización, disponibilidad y trazabilidad de la información.

## Funcionalidades contempladas

- Registro y actualización de equipos tecnológicos.
- Consulta de inventario con búsquedas y filtros.
- Clasificación de equipos por categoría, estado, sede y laboratorio.
- Historial de cambios de ubicación y estado.
- Gestión y seguimiento de mantenimientos.
- Registro de incidencias y evidencias fotográficas.
- Autenticación y administración de usuarios.
- Control de acceso mediante roles y permisos.
- Generación de reportes básicos.
- Interfaz web responsiva.

> **Nota:** Las funcionalidades se encuentran en diferentes etapas de desarrollo. Esta lista representa el alcance previsto del sistema, no funcionalidades completamente implementadas.

## Tecnologías

| Componente                   | Tecnología        |
| Frontend                     | React             |
| Estilos                      | Tailwind CSS      |
| Backend                      | Node.js y Express |
| Base de datos                | PostgreSQL        |
| Alojamiento de base de datos | Neon              |
| Diseño de interfaces         | Figma             |
| Control de versiones         | Git y GitHub      |

## Arquitectura

El sistema utiliza una arquitectura cliente-servidor, compuesta por una interfaz web desarrollada con React, una API REST implementada con Node.js y Express, y una base de datos relacional PostgreSQL alojada en Neon.

## Estructura del proyecto

ulatina-lab-inventory/
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       ├── services/
│       └── app.js
├── frontend/             
├── .gitignore
└── README.md

La estructura puede modificarse conforme avance el desarrollo.

## Estado del desarrollo

Actualmente se cuenta con una base de datos relacional en PostgreSQL, conexión funcional desde el backend y endpoints para consultar información del inventario.

Se han desarrollado consultas de equipos, búsquedas mediante filtros y validaciones de identificadores. Asimismo, la base de datos cuenta con mecanismos automáticos para conservar historiales de cambios.

El módulo de autenticación, las operaciones de registro y modificación, la interfaz web y la integración entre componentes continúan en desarrollo.

## Equipo de desarrollo

Proyecto desarrollado por:

- **Arianna Quirós García:** gestión del inventario de equipos tecnológicos.
- **Óscar Andrés Mononga Espitia:** autenticación, usuarios, roles, mantenimientos y funcionalidades complementarias.

**Contexto académico:** Práctica Empresarial Supervisada (PES).

**Institución:** Universidad Latina de Costa Rica, sede Heredia.

## Configuración del entorno

Para ejecutar el backend en un entorno de desarrollo:

1. Clonar el repositorio.
2. Ingresar a la carpeta `backend`.
3. Instalar las dependencias con `npm install`.
4. Configurar un archivo `.env` con las variables de entorno necesarias.
5. Ejecutar `npm run dev`.

Ejemplo de variables de entorno:

PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=...

Las credenciales deben almacenarse de forma privada y no deben incluirse en el repositorio.

## Consideraciones

Este repositorio corresponde a un proyecto académico en desarrollo. Las funcionalidades pendientes de autenticación, autorización y escritura segura deben completarse y verificarse antes de utilizar el sistema con información institucional real.
