// Comprueba si la migración sql/agregar_categoria.sql ya se aplicó
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  if (!process.env.DATABASE_URL) { console.log('SIN DATABASE_URL en .env'); process.exit(2); }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const col = await c.query(
    "select data_type from information_schema.columns where table_schema='public' and table_name='libros' and column_name='categoria'"
  );
  console.log('columna libros.categoria:', col.rows.length ? 'EXISTE (' + col.rows[0].data_type + ')' : 'NO EXISTE  <-- falta migracion');

  const idx = await c.query(
    "select indexname from pg_indexes where schemaname='public' and tablename='libros' and indexname='idx_libros_categoria'"
  );
  console.log('indice idx_libros_categoria:', idx.rows.length ? 'EXISTE' : 'NO EXISTE');

  const n = await c.query('select count(*)::int as n from libros');
  console.log('libros en la tabla:', n.rows[0].n);

  const conCat = await c.query("select count(*)::int as n from libros where categoria is not null and categoria <> ''");
  console.log('libros ya con categoria:', conCat.rows[0].n);

  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
