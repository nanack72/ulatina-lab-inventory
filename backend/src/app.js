require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// Detrás de un proxy (Render, Nginx...) indicar cuántos saltos confiar: TRUST_PROXY=1
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(helmet({
    // El frontend (otro origen) consume la API y las evidencias por fetch.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS_ORIGINS=https://inventario.ulatina.net,http://localhost:5173
// Sin la variable solo se permite el origen de desarrollo de Vite.
const origenesPermitidos = (
    process.env.CORS_ORIGINS || 'http://localhost:5173'
).split(',').map((origen) => origen.trim()).filter(Boolean);

app.use(cors({
    origin(origen, callback) {
        // Peticiones sin cabecera Origin (Postman, pruebas, servidor a servidor)
        if (!origen || origenesPermitidos.includes(origen)) {
            return callback(null, true);
        }
        return callback(null, false);
    }
}));

// Límite general por IP para frenar abusos y ráfagas.
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_API) || 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        success: false,
        message: 'Demasiadas solicitudes. Intente nuevamente en un momento.'
    }
}));
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
        await pool.query('SELECT 1');

        // No se exponen el nombre de la base ni el usuario de conexión.
        res.json({
            success: true,
            message: 'Conexión con PostgreSQL exitosa'
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

const servidor = app.listen(PORT, () => {
    console.log(
        `Servidor PES ejecutándose en http://localhost:${PORT}`
    );

    // Iniciar la limpieza automática de tokens
    iniciarLimpiezaTokens();
});

// Node cierra las conexiones inactivas a los 5 s. Si el proxy (Vite, nginx)
// reutiliza justo una de esas conexiones, la primera petición falla con un
// 500 vacío. Se mantienen abiertas más tiempo que cualquier proxy habitual.
if (servidor) {
    servidor.keepAliveTimeout = 65000;
    servidor.headersTimeout = 66000;
}
