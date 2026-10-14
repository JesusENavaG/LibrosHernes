// ============================================================
//  LibrosHernes - Consulta 1: infraestructura de la BBDD
//  Uso: node scripts/consultar_esquema.js
// ============================================================
require('dotenv').config();
const { Client } = require('pg');

// Supabase: session pooler (6543 o 5432) y conexion directa (5432)
function candidatos() {
  const base = process.env.DATABASE_URL || '';
  const lista = [base];

  const reemplazar = (str, host, puerto) =>
    str.replace(/@[^/]+:\d+\/postgres/, `@${host}:${puerto}/postgres`);

  if (base.includes('pooler.supabase.com')) {
    // Puerto 5432 -> probar 6543 (session pooler clásico)
    lista.push(reemplazar(base, 'aws-0-us-east-1.pooler.supabase.com', 6543));
    // Conexion directa (host del proyecto sin pooler)
    const ref = base.match(/@(postgres\.[a-z0-9]+)\.supabase\.com/) ||
                base.match(/postgres\.([a-z0-9]+)\.pooler/);
    const hostDirecto = base
      .replace(/.*@/, '')
      .replace(/\.pooler/, '')
      .replace(/:\d+\/postgres/, '');
    if (hostDirecto) lista.push(reemplazar(base, hostDirecto, 5432));
    console.log('Host directo detectado:', hostDirecto, ref ? '' : '');
  }
  return [...new Set(lista)];
}

async function probar(cadena) {
  const client = new Client({ connectionString: cadena, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

let client = null;

async function main() {
  const opciones = candidatos();
  for (const cadena of opciones) {
    try {
      console.log('Conectando a:', cadena.replace(/:[^:@/]+@/, ':****@'));
      client = await probar(cadena);
      console.log('Conexión exitosa ✅\n');
      break;
    } catch (e) {
      console.log('  ✗ falló:', e.message);
    }
  }
  if (!client) throw new Error('Ninguna variante de conexión funcionó');


  // 1) Columnas de todas las tablas
  const columnas = await client.query(`
    select
      c.table_name  as tabla,
      c.ordinal_position as posicion,
      c.column_name as columna,
      c.data_type   as tipo,
      case when c.data_type in ('character varying','character','text')
           then coalesce('(' || c.character_maximum_length || ')', '') else '' end as largo,
      case when c.is_nullable = 'NO' then 'NOT NULL' else '' end as nulo,
      coalesce(c.column_default, '') as valor_default
    from information_schema.columns c
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position;
  `);

  console.log('===== 1) COLUMNAS =====');
  console.table(columnas.rows);

  // 2) Claves y relaciones
  const constraints = await client.query(`
    select
      tc.table_name as tabla,
      tc.constraint_type as tipo,
      kcu.column_name as columna,
      ccu.table_name || '.' || ccu.column_name as referencia
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    left join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
    order by tc.table_name, tc.constraint_type, kcu.ordinal_position;
  `);

  console.log('===== 2) CLAVES / RELACIONES =====');
  console.log(constraints.rows.length ? constraints.rows : '(sin constraints)');

  // 3) Tablas con RLS
  const rls = await client.query(`
    select c.relname as tabla, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname;
  `);
  console.log('===== 3) RLS =====');
  console.table(rls.rows);

  // 4) Storage
  try {
    const buckets = await client.query(`select id, name, public from storage.buckets;`);
    console.log('===== 4) BUCKETS =====');
    console.log(buckets.rows.length ? buckets.rows : '(sin buckets)');
  } catch (e) {
    console.log('===== 4) BUCKETS ===== error:', e.message);
  }

  await client.end();
}

main().catch((e) => {
  console.error('ERROR DE CONEXION:', e.message);
  process.exit(1);
});
