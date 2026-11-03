// Prueba el camino de escritura de categorías contra Supabase DENTRO de una
// transacción con ROLLBACK: valida que el INSERT/UPDATE de datos.js funcione
// sin dejar ningún dato en la base.
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const antes = await c.query('select count(*)::int as n from libros');
  console.log('libros antes:', antes.rows[0].n);

  await c.query('BEGIN');
  try {
    // Mismo enunciado que usa datos.js > crearLibro()
    const ins = await c.query(
      `insert into libros (titulo, autor, descripcion, precio, imagen_url, stock, activo, categoria)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, categoria`,
      ['__TEST_MIGRACION__', 'autor', 'desc', 0, '', 0, false, 'Novela']
    );
    console.log('INSERT con categoria  -> OK (id=' + ins.rows[0].id + ', categoria=' + ins.rows[0].categoria + ')');

    // Mismo enunciado que usa datos.js > editarLibro()
    await c.query(
      `update libros
          set titulo = $1, autor = $2, descripcion = $3, precio = $4,
              imagen_url = $5, stock = $6, activo = $7, categoria = $8, updated_at = now()
        where id = $9`,
      ['__TEST_MIGRACION__2', 'autor', 'desc', 0, '', 0, false, 'Clásicos', ins.rows[0].id]
    );
    console.log('UPDATE con categoria  -> OK');
  } finally {
    await c.query('ROLLBACK');
    console.log('ROLLBACK ejecutado (no se guardó nada)');
  }

  const despues = await c.query('select count(*)::int as n from libros');
  const limpio = await c.query("select count(*)::int as n from libros where titulo like '__TEST%'");
  console.log('--- RESULTADO ---');
  console.log('  libros despues   :', despues.rows[0].n, despues.rows[0].n === antes.rows[0].n ? '(sin cambios, OK)' : '(!CAMBIO!)');
  console.log('  residuos de prueba:', limpio.rows[0].n, limpio.rows[0].n === 0 ? '(ninguno, OK)' : '(!HAY RESIDUOS!)');

  const ok = despues.rows[0].n === antes.rows[0].n && limpio.rows[0].n === 0;
  console.log(ok ? 'ESCRITURA DE CATEGORIAS VERIFICADA' : 'HAY PROBLEMAS');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
