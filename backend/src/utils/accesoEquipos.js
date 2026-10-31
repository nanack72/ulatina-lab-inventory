const pool = require('../config/database');

// Comprobar acceso del usuario a un equipo
const verificarAccesoEquipo = async (idEquipo, usuario) => {
  const idUsuario = Number(usuario?.idUsuario);

  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    return false;
  }

  // Acceso global provisional para superadministrador
  const accesoGlobal =
    usuario.rol?.toLowerCase() === 'superadministrador';

  const valores = [Number(idEquipo)];

  let consulta = `
    SELECT e.id_equipo
    FROM public.equipo e
    INNER JOIN public.laboratorio l
      ON e.id_laboratorio = l.id_laboratorio
    WHERE e.id_equipo = $1
  `;

  if (!accesoGlobal) {
    valores.push(idUsuario);

    consulta += `
      AND EXISTS (
        SELECT 1
        FROM public.usuario_sede us
        INNER JOIN public.usuario_laboratorio ul
          ON us.id_usuario_sede = ul.id_usuario_sede
        WHERE us.id_usuario = $2
          AND us.id_sede = l.id_sede
          AND ul.id_sede = l.id_sede
          AND ul.id_laboratorio = e.id_laboratorio
      )
    `;
  }

  const resultado = await pool.query(consulta, valores);

  return resultado.rowCount > 0;
};

module.exports = { verificarAccesoEquipo };
