// Cambia la contraseña de un usuario y revoca sus sesiones activas.
// Uso:  NUEVA_CONTRASENA='...' node scripts/rotarContrasena.js correo@ulatina.net
// La contraseña se lee de una variable de entorno para que no quede en el historial del shell.
require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

(async () => {
    const correo = process.argv[2];
    const nueva = process.env.NUEVA_CONTRASENA;

    if (!correo || !nueva || nueva.length < 12) {
        console.error('Uso: NUEVA_CONTRASENA="(mínimo 12 caracteres)" node scripts/rotarContrasena.js correo@ulatina.net');
        process.exit(1);
    }

    try {
        const hash = await bcrypt.hash(nueva, 12);
        const r = await pool.query(
            `UPDATE public.usuario
                SET contrasena_hash = $1
              WHERE LOWER(correo_institucional) = LOWER($2)
          RETURNING id_usuario`,
            [hash, correo.trim()]
        );

        if (r.rowCount === 0) {
            console.error('No existe un usuario con ese correo.');
            process.exit(1);
        }

        console.log(`Contraseña actualizada para ${correo}.`);
        console.log('Las sesiones ya emitidas siguen válidas hasta que expiren; cambie JWT_SECRET para invalidarlas todas.');
    } finally {
        await pool.end();
    }
})().catch((e) => { console.error(e.message); process.exit(1); });
