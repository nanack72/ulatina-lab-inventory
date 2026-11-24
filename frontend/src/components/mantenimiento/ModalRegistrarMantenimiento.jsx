import { useEffect, useRef, useState } from 'react';
import { DialogoModulo, Aviso } from '../comunes/Modulo';
import { registrarMantenimiento } from '../../services/mantenimientosService';
import { subirEvidenciaFotografica } from '../../services/evidenciasService';
import { TIPOS_MANTENIMIENTO, ESTADOS_MANTENIMIENTO } from '../../utils/mantenimiento';
export default function ModalRegistrarMantenimiento({
  abierto,
  alCerrar,
  alGuardarExitoso,
  equiposDisponibles = [],
  errorEquipos,
  cargandoEquipos,
  token,
}) {
  const [equipo, setEquipo] = useState(''),
    [tipo, setTipo] = useState('Preventivo'),
    [motivo, setMotivo] = useState(''),
    [trabajo, setTrabajo] = useState(''),
    [horas, setHoras] = useState('1'),
    [estado, setEstado] = useState('En Proceso');
  const [foto, setFoto] = useState(null),
    [tipoFoto, setTipoFoto] = useState('Antes'),
    [descripcionFoto, setDescripcionFoto] = useState(''),
    [preview, setPreview] = useState('');
  const enlaceFoto = useRef(null);
  const [guardando, setGuardando] = useState(false),
    [error, setError] = useState(''),
    [idGuardado, setIdGuardado] = useState(null),
    ocupado = useRef(false);
  useEffect(
    () => () => {
      if (enlaceFoto.current) URL.revokeObjectURL(enlaceFoto.current);
    },
    []
  );
  function seleccionarFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) {
      if (enlaceFoto.current) URL.revokeObjectURL(enlaceFoto.current);
      enlaceFoto.current = null;
      setFoto(null);
      setPreview('');
      return;
    }
    if (!/\.(jpe?g|png|webp)$/i.test(archivo.name) || archivo.size > 5242880 || !archivo.size) {
      setError('Adjunte una imagen JPG, PNG o WEBP de hasta 5 MB.');
      e.target.value = '';
      return;
    }
    if (enlaceFoto.current) URL.revokeObjectURL(enlaceFoto.current);
    enlaceFoto.current = URL.createObjectURL(archivo);
    setPreview(enlaceFoto.current);
    setFoto(archivo);
    setError('');
  }
  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    setError('');
    try {
      let id = idGuardado;
      if (!id) {
        const creado = await registrarMantenimiento(
          {
            id_equipo: Number(equipo),
            tipo_mantenimiento: tipo,
            motivo_falla: tipo === 'Correctivo' ? motivo.trim() : null,
            descripcion_trabajo: trabajo.trim(),
            horas_invertidas: Number(horas),
            estado_mantenimiento: estado,
          },
          token
        );
        id = creado.id_bitacora;
        setIdGuardado(id);
      }
      if (foto)
        await subirEvidenciaFotografica(
          { foto, id_bitacora: id, tipo_evidencia: tipoFoto, descripcion: descripcionFoto.trim() },
          token
        );
      alGuardarExitoso('Mantenimiento registrado' + (foto ? ' con su evidencia.' : '.'));
    } catch (err) {
      setError(err.message);
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  }
  return (
    <DialogoModulo
      abierto={abierto}
      alCerrar={() =>
        idGuardado
          ? alGuardarExitoso('Mantenimiento guardado. Quedó pendiente su evidencia.')
          : alCerrar()
      }
      titulo="Registrar mantenimiento"
      descripcion="Registre el trabajo realizado y agregue una evidencia si la necesita."
      ocupado={guardando}
    >
      <form className="mod-formulario" onSubmit={guardar}>
        <Aviso error>{error || errorEquipos}</Aviso>
        {idGuardado && (
          <Aviso>
            El mantenimiento ya está guardado. Puede reintentar la evidencia sin crear otro
            registro.
          </Aviso>
        )}
        <fieldset disabled={guardando || !!idGuardado} className="mod-formulario mod-fieldset">
          <legend className="mod-sr">Datos de mantenimiento</legend>
          <label className="mod-campo" htmlFor="mant-equipo">
            Equipo *
            <select
              id="mant-equipo"
              name="id_equipo"
              value={equipo}
              required
              disabled={cargandoEquipos || !!idGuardado}
              onChange={(e) => setEquipo(e.target.value)}
            >
              <option value="">
                {cargandoEquipos ? 'Cargando equipos…' : 'Seleccione un equipo'}
              </option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id_equipo} value={eq.id_equipo}>
                  {eq.placa_institucional || eq.numero_serie || 'Sin placa'} · {eq.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="mod-campos">
            <label className="mod-campo" htmlFor="mant-tipo">
              Tipo
              <select
                id="mant-tipo"
                name="tipo_mantenimiento"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS_MANTENIMIENTO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="mod-campo" htmlFor="mant-estado">
              Estado inicial
              <select
                id="mant-estado"
                name="estado_mantenimiento"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADOS_MANTENIMIENTO.filter((t) => t !== 'Completado').map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          {tipo === 'Correctivo' && (
            <>
              <div className="mant-aviso-regla" role="note">
                Al registrar un correctivo, el equipo pasará automáticamente a estado{' '}
                <strong>En mantenimiento</strong>. Para finalizar la orden luego, deberá adjuntar
                evidencias <strong>Antes</strong> y <strong>Después</strong>.
              </div>
              <label className="mod-campo" htmlFor="mant-motivo">
                Motivo de la falla
                <input
                  id="mant-motivo"
                  name="motivo_falla"
                  value={motivo}
                  maxLength={10000}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
            </>
          )}
          <label className="mod-campo" htmlFor="mant-trabajo">
            Trabajo realizado *
            <textarea
              id="mant-trabajo"
              name="descripcion_trabajo"
              required
              rows={4}
              maxLength={10000}
              value={trabajo}
              onChange={(e) => setTrabajo(e.target.value)}
            />
          </label>
          <label className="mod-campo" htmlFor="mant-horas">
            Horas invertidas
            <input
              id="mant-horas"
              name="horas_invertidas"
              type="number"
              min="0"
              max="9999.99"
              step="0.01"
              required
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
            />
          </label>
        </fieldset>
        <label className="mod-campo" htmlFor="mant-foto">
          Evidencia opcional · JPG, PNG o WEBP, hasta 5 MB
          <input
            id="mant-foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={guardando}
            onChange={seleccionarFoto}
          />
        </label>
        {foto && (
          <>
            <img className="mod-imagen-previa" src={preview} alt="Vista previa de la evidencia" />
            <div className="mod-campos">
              <label className="mod-campo" htmlFor="mant-tipofoto">
                Momento
                <select
                  id="mant-tipofoto"
                  name="tipo_evidencia"
                  value={tipoFoto}
                  disabled={guardando}
                  onChange={(e) => setTipoFoto(e.target.value)}
                >
                  {['Antes', 'Durante', 'Después'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="mod-campo" htmlFor="mant-descfoto">
                Descripción de la foto
                <input
                  id="mant-descfoto"
                  name="descripcion"
                  maxLength={1000}
                  value={descripcionFoto}
                  disabled={guardando}
                  onChange={(e) => setDescripcionFoto(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        <footer className="mod-acciones">
          <button
            type="button"
            className="btn btn-secundario"
            disabled={guardando}
            onClick={() =>
              idGuardado
                ? alGuardarExitoso('Mantenimiento guardado. Quedó pendiente su evidencia.')
                : alCerrar()
            }
          >
            {idGuardado ? 'Finalizar sin evidencia' : 'Cancelar'}
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={guardando || (!idGuardado && (cargandoEquipos || !!errorEquipos))}
          >
            {guardando
              ? 'Guardando…'
              : idGuardado
                ? 'Reintentar evidencia'
                : 'Registrar mantenimiento'}
          </button>
        </footer>
      </form>
    </DialogoModulo>
  );
}
