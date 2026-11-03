// Ejecuta sql/agregar_categoria.sql contra Supabase y verifica el resultado.
// Migración segura e idempotente: solo ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const ARCHIVO = 'sql/agregar_categoria.sql';

(async () => {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL en .env'); process.exit(2); }

  const sql = fs.readFileSync(ARCHIVO, 'utf8');
  console.log('Ejecutando', ARCHIVO, `(${sql.split('\n').length} lineas)...`);

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const antes = await c.query('select count(*)::int as n from libros');
  console.log('  libros antes:', antes.rows[0].n);

  await c.query(sql);          // comentarios -- no se ejecutan (el UPDATE opcional queda fuera)

  // ---- verificación ----
  const col = await c.query(
    "select data_type from information_schema.columns where table_schema='public' and table_name='libros' and column_name='categoria'"
  );
  const idx = await c.query(
    "select indexname from pg_indexes where schemaname='public' and tablename='libros' and indexname='idx_libros_categoria'"
  );
  const despues = await c.query('select count(*)::int as n from libros');

  console.log('--- RESULTADO ---');
  console.log('  columna libros.categoria :', col.rows.length ? 'EXISTE (' + col.rows[0].data_type + ')' : 'FALTA');
  console.log('  indice idx_libros_categoria:', idx.rows.length ? 'EXISTE' : 'FALTA');
  console.log('  libros despues           :', despues.rows[0].n, despues.rows[0].n === antes.rows[0].n ? '(sin cambios, OK)' : '(!CAMBIO!)');

  const ok = col.rows.length === 1 && idx.rows.length === 1 && despues.rows[0].n === antes.rows[0].n;
  console.log(ok ? 'MIGRACION OK' : 'MIGRACION CON PROBLEMAS');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
