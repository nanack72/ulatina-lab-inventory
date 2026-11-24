import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacenNotificaciones } from '../src/utils/notificaciones.js';

test('apila avisos distintos sin reemplazarlos', () => {
  const centro=crearAlmacenNotificaciones();
  const a=centro.notificar({tipo:'exito',mensaje:'Guardado'});
  const b=centro.notificar({tipo:'error',mensaje:'Error de conexión'});
  assert.deepEqual(centro.obtener().map(a=>a.id),[b,a]);
});
test('un mismo aviso declarativo no se duplica por renders repetidos', () => {
  const centro=crearAlmacenNotificaciones();
  centro.notificar({id:'formulario',tipo:'error',mensaje:'Falta el nombre'});
  const inicial=centro.obtener();
  centro.notificar({id:'formulario',tipo:'error',mensaje:'Falta el nombre'});
  assert.strictEqual(centro.obtener(),inicial);
  assert.equal(centro.obtener().length,1);
});
test('cerrar un aviso no afecta a los demás ni permite reaparecer por un render', () => {
  const centro=crearAlmacenNotificaciones();
  centro.notificar({id:'a',tipo:'error',mensaje:'Error A'});
  centro.notificar({id:'b',tipo:'exito',mensaje:'Guardado'});
  centro.cerrar('a');
  centro.notificar({id:'a',tipo:'error',mensaje:'Error A'});
  assert.deepEqual(centro.obtener().map(a=>a.id),['b']);
});
test('un error nuevo puede aparecer después de cerrar el anterior', () => {
  const centro=crearAlmacenNotificaciones();
  centro.notificar({id:'a',tipo:'error',mensaje:'Error A'});
  centro.cerrar('a');
  centro.notificar({id:'a',tipo:'error',mensaje:'Error B'});
  assert.equal(centro.obtener()[0].mensaje,'Error B');
});
test('retirar un formulario permite mostrar el mismo error en otro intento', () => {
  const centro=crearAlmacenNotificaciones();
  centro.notificar({id:'a',tipo:'error',mensaje:'Error A'});
  centro.cerrar('a');centro.retirar('a');
  centro.notificar({id:'a',tipo:'error',mensaje:'Error A'});
  assert.equal(centro.obtener().length,1);
});
test('los consumidores pueden suscribirse y darse de baja', () => {
  const centro=crearAlmacenNotificaciones();let llamadas=0;
  const salir=centro.suscribir(()=>llamadas++);
  centro.notificar({mensaje:'Primero'});salir();centro.notificar({mensaje:'Segundo'});
  assert.equal(llamadas,1);
});
test('limpiar elimina mensajes y descartes de la sesión anterior', () => {
  const centro=crearAlmacenNotificaciones();
  centro.notificar({id:'a',mensaje:'Mensaje'});centro.cerrar('a');centro.limpiar();
  assert.equal(centro.obtener().length,0);
  centro.notificar({id:'a',mensaje:'Mensaje'});
  assert.equal(centro.obtener().length,1);
});
