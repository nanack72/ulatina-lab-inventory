const cron = require('node-cron');
const pool = require('../src/config/database');

// Ejecuta la función de limpieza que creamos en PostgreSQL
const limpiarTokens = async () => {
    try {
        const resultado = await pool.query(
            'SELECT public.limpiar_tokens_revocados() AS eliminados'
        );

        const eliminados = resultado.rows[0].eliminados;

        console.log(
            `[Limpieza JWT] Tokens vencidos eliminados: ${eliminados}`
        );

    } catch (error) {
        console.error(
            '[Limpieza JWT] Error durante la limpieza:',
            error
        );
    }
};

// Programa la limpieza automática
const iniciarLimpiezaTokens = () => {

    // Todos los días a las 3:00 a. m. de Costa Rica
    cron.schedule('0 3 * * *', limpiarTokens, {
        timezone: 'America/Costa_Rica',
        noOverlap: true
    });

    console.log(
        '[Limpieza JWT] Tarea diaria programada para las 3:00 a. m.'
    );
};

module.exports = { iniciarLimpiezaTokens };
