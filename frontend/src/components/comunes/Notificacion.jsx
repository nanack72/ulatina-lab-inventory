import { Children, isValidElement, useEffect, useId } from 'react';
import { almacenNotificaciones } from '../../utils/notificaciones';

function textoContenido(contenido) {
  return Children.toArray(contenido)
    .map((elemento) => {
      if (typeof elemento === 'string' || typeof elemento === 'number') return String(elemento);
      return isValidElement(elemento) ? textoContenido(elemento.props.children) : '';
    })
    .join(' ');
}

// Adapta los mensajes existentes sin cambiar la validación de sus formularios.
export default function Notificacion({ children, tipo = 'error', titulo, alCerrar }) {
  const id = useId();
  const clave = `${tipo}|${titulo ?? ''}|${textoContenido(children)}`;
  useEffect(() => {
    almacenNotificaciones.notificar({ id, clave, tipo, titulo, contenido: children, alCerrar });
  }, [id, clave, tipo, titulo, children, alCerrar]);
  useEffect(
    () => () => {
      if (tipo !== 'exito') almacenNotificaciones.retirar(id);
    },
    [id, tipo]
  );
  return null;
}
