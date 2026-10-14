// ============================================================
//  LibrosHernes - Crea tablas (libros, pedidos) + bucket Storage
//  Uso: node scripts/crear_tablas.js
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function cadenaConexion() {
  const base = process.env.DATABASE_URL || '';
  // El session pooler clásico usa el puerto 6543
  if (base.includes('pooler.supabase.com')) {
    return base.replace(/(@[^/]+):\d+(\/postgres)/, '$1:6543$2');
  }
  return base;
}

async function main() {
  const client = new Client({
    connectionString: cadenaConexion(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Conectado a Supabase ✅\n');

  const archivo = path.join(__dirname, '..', 'sql', 'crear_tablas.sql');
  const sql = fs.readFileSync(archivo, 'utf8');

  // Dividir por punto y coma (el archivo no tiene funciones con ';' internos)
  const sentencias = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);

  let n = 0;
  for (const sentencia of sentencias) {
    n++;
    try {
      await client.query(sentencia);
      const primera = sentencia.split('\n').find((l) => l && !l.trim().startsWith('--')) || '';
      console.log(`  ${n}. ✓ ${primera.trim().slice(0, 70)}...`);
    } catch (e) {
      console.log(`  ${n}. ✗ ERROR: ${e.message}`);
      console.log(`     Sentencia: ${sentencia.slice(0, 120)}...`);
    }
  }

  // Verificación final
  const tablas = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('libros','pedidos');
  `);
  const buckets = await client.query(`select id, public from storage.buckets;`);
  const total = await client.query(`select count(*) from public.libros;`);

  console.log('\n===== VERIFICACIÓN =====');
  console.log('Tablas creadas :', tablas.rows.map((r) => r.table_name).join(', ') || '(ninguna)');
  console.log('Buckets        :', buckets.rows.map((b) => `${b.id} (público: ${b.public})`).join(', ') || '(ninguno)');
  console.log('Libros de ejemplo:', total.rows[0].count);

  await client.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
