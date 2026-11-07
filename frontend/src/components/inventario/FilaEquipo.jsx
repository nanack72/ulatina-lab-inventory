import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

import {
  claseEstado,
  formatearSede,
} from '../../utils/inventario';

export default function FilaEquipo({
  equipo,
  menuAbierto,
  onAlternarMenu,
  onVer,
  onEditar,
  onTrasladar,
}) {
  const botonRef = useRef(null);
  const [posicionMenu, setPosicionMenu] = useState(null);

  // ==========================================
  // OPCIONES DEL MENÚ DE TRES PUNTOS
  // ==========================================

  const acciones = [
    onVer && {
      texto: 'Ver detalle',
      ejecutar: () => onVer(equipo),
    },
    onEditar && {
      texto: 'Editar equipo',
      ejecutar: () => onEditar(equipo),
    },
    onTrasladar && {
      texto: 'Trasladar equipo',
      ejecutar: () => onTrasladar(equipo),
    },
  ].filter(Boolean);

  // ==========================================
  // POSICIÓN DEL MENÚ FLOTANTE
  // ==========================================

  useEffect(() => {
    if (!menuAbierto || !botonRef.current) {
      setPosicionMenu(null);
      return;
    }

    const rect = botonRef.current.getBoundingClientRect();

    const ancho = 180;
    const altura = acciones.length * 40 + 12;

    const espacioAbajo =
      window.innerHeight - rect.bottom;

    const izquierda = Math.max(
      8,
      Math.min(
        window.innerWidth - ancho - 8,
        rect.right - ancho
      )
    );

    const arriba =
      espacioAbajo >= altura + 8
        ? rect.bottom + 5
        : Math.max(
            8,
            rect.top - altura - 5
          );

    setPosicionMenu({
      position: 'fixed',
      left: izquierda,
      top: arriba,
      right: 'auto',
      bottom: 'auto',
      width: ancho,
      zIndex: 9999,
    });
  }, [menuAbierto, acciones.length]);

  // ==========================================
  // FORMATO DE LA UBICACIÓN
  // ==========================================

  const ubicacion = [
    formatearSede(equipo.sede),
    equipo.ubicacion,
  ]
    .filter(Boolean)
    .join(' · ');

  // ==========================================
  // TABLA
  // ==========================================

  return (
    <tr>
      {/* PLACA INSTITUCIONAL */}
      <td>
        <span className="inv-placa">
          {equipo.placa || '—'}
        </span>
      </td>

      {/* NOMBRE Y NÚMERO DE SERIE */}
      <td>
        <div className="inv-celda-doble">
          <strong>
            {equipo.nombre || 'Sin nombre'}
          </strong>

          <small>
            Serie{' '}
            {equipo.serie || 'no registrada'}
          </small>
        </div>
      </td>

      {/* CATEGORÍA */}
      <td>
        {equipo.categoria || '—'}
      </td>

      {/* MARCA Y MODELO */}
      <td>
        <div className="inv-celda-doble">
          <strong>
            {equipo.marca || '—'}
          </strong>

          <small>
            {equipo.modelo || 'Sin modelo'}
          </small>
        </div>
      </td>

      {/* UBICACIÓN */}
      <td>
        <div className="inv-celda-doble">
          <strong>
            {equipo.laboratorio || 'Sin laboratorio'}
          </strong>

          <small>
            {ubicacion || 'Ubicación no detallada'}
          </small>
        </div>
      </td>

      {/* ESTADO */}
      <td>
        <span
          className={`inv-estado ${claseEstado(
            equipo.estado
          )}`}
        >
          {equipo.estado || 'Sin estado'}
        </span>
      </td>

      {/* ACCIONES */}
      {acciones.length > 0 && (
        <td className="inv-columna-acciones">
          <div className="inv-menu-contenedor">

            {/* BOTÓN DE TRES PUNTOS */}
            <button
              ref={botonRef}
              type="button"
              className="inv-menu-boton"
              aria-label={`Opciones de ${equipo.nombre}`}
              aria-expanded={menuAbierto}
              aria-haspopup="true"
              onClick={onAlternarMenu}
            >
              <MoreHorizontal size={20} />
            </button>

            {/* MENÚ FLOTANTE */}
            {menuAbierto &&
              posicionMenu &&
              createPortal(
                <div
                  className="inv-menu-desplegable"
                  style={posicionMenu}
                >
                  {acciones.map((accion) => (
                    <button
                      key={accion.texto}
                      type="button"
                      onClick={accion.ejecutar}
                    >
                      {accion.texto}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        </td>
      )}
    </tr>
  );
}
