require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

// Importamos las rutas
const sedesRoutes = require('./routes/sedesRoutes');
const laboratoriosRoutes = require('./routes/laboratoriosRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const estadosRoutes = require('./routes/estadosRoutes');
const equiposRoutes = require('./routes/equiposRoutes');
const mantenimientosRoutes = require('./routes/mantenimientosRoutes');
const authRoutes = require('./routes/authRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const evidenciasRoutes = require('./routes/evidenciasRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const historialGeneralRoutes = require('./routes/historialGeneralRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const importacionEquiposRoutes = require('./routes/importacionEquiposRoutes');
const incidenciasRoutes = require('./routes/incidenciasRoutes');

// Importamos la tarea de limpieza de JWT
const { iniciarLimpiezaTokens } = require('../jobs/limpiezaTokens');

const app = express();

app.use(cors());
// Aplicar el límite especial antes del parser general de 100 kB.
app.use(
  '/api/importacion-equipos/confirmar',
  express.json({ limit: '2mb' })
);
app.use(express.json());

// Rutas de la API
app.use('/api/sedes', sedesRoutes);
app.use('/api/laboratorios', laboratoriosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/estados', estadosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/mantenimientos', mantenimientosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/evidencias', evidenciasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/historial-general', historialGeneralRoutes);
app.use('/api/admin/configuracion', configuracionRoutes);
app.use('/api/admin/usuarios', usuariosRoutes);
app.use('/api/importacion-equipos', importacionEquiposRoutes);
app.use('/api/incidencias', incidenciasRoutes);

// Las evidencias se sirven por la API con autenticación y acceso por laboratorio.

// Verificar que Express funciona
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API del Sistema de Inventario PES funcionando'
    });
});

// Verificar la conexión con PostgreSQL
app.get('/api/health/db', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT current_database() AS base_datos, current_user AS usuario'
        );

        res.json({
            success: true,
            message: 'Conexión con PostgreSQL exitosa',
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            'Error de conexión con PostgreSQL:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'No se pudo conectar con PostgreSQL'
        });
    }
});

// Los errores de lectura del cuerpo también deben devolver JSON a la interfaz.
app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'La solicitud supera el tamaño permitido. Reduzca el lote e intente nuevamente.'
        });
    }

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'El cuerpo de la solicitud no contiene JSON válido.'
        });
    }

    return next(error);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Servidor PES ejecutándose en http://localhost:${PORT}`
    );

    // Iniciar la limpieza automática de tokens
    iniciarLimpiezaTokens();
});
