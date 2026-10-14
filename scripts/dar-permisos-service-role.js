// Otorga permisos al rol service_role sobre las tablas de la tienda.
// (La clave service_role no venía con acceso a 'libros'/'pedidos'.)
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  for (const tabla of ['libros', 'pedidos']) {
    await db.query(`grant usage on schema public to service_role;`);
    await db.query(
      `grant select, insert, update, delete on public.${tabla} to service_role;`
    );
    console.log(`Permisos otorgados a service_role sobre: ${tabla}`);
  }

  // Verifica los permisos resultantes
  const r = await db.query(`
    select grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
    from information_schema.role_table_grants
    where table_name in ('libros','pedidos') and grantee = 'service_role'
    group by grantee;
  `);
  console.log('Permisos actuales de service_role:', r.rows);

  await db.end();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
