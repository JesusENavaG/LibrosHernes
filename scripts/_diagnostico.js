// Diagnóstico: qué falla al leer con supabase-js
require('dotenv').config();
const datos = require('../datos');

(async () => {
  console.log('fuente detectada:', datos.fuente());
  try {
    const libros = await datos.listarLibros({ soloActivos: true });
    console.log('listarLibros OK, cantidad:', libros.length);
    console.log('ejemplo:', libros[0]);
  } catch (e) {
    console.log('listarLibros FALLO:', e.message);
    console.log('detalle:', JSON.stringify(e, null, 2).slice(0, 800));
  }
  process.exit(0);
})();
