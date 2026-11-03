// ============================================================
//  LibrosHernes - Asignar categorías a los libros existentes
//
//  Lee scripts/categorias-existentes.json (título -> categoría)
//  y actualiza la columna 'categoria' de la tabla 'libros'.
//
//  IMPORTANTE: por defecto solo SIMULA y no escribe nada.
//  Para aplicar los cambios hay que pasar --aplicar.
//
//  Uso:
//    node scripts/asignar-categorias.js              (simulacro)
//    node scripts/asignar-categorias.js --aplicar    (escribe)
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MAPA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'categorias-existentes.json'), 'utf8')
);
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // La columna 'categoria' se crea con sql/agregar_categoria.sql.
  // Si todavía no existe, avisamos en vez de fallar en crudo.
  const cols = await client.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'libros'`
  );
  const tieneColumna = cols.rows.some((c) => c.column_name === 'categoria');
  if (!tieneColumna) {
    await client.end();
    console.log('⚠️  La tabla "libros" todavía no tiene la columna "categoria".');
    console.log('    Primero hay que ejecutar sql/agregar_categoria.sql en Supabase');
    console.log('    (SQL Editor). Esto NO se hace hasta que se confirme el cambio.');
    console.log('    Salgo sin tocar nada.');
    return;
  }

  const { rows } = await client.query(
    'select id, titulo, categoria from libros order by titulo'
  );

  const actualizaciones = [];
  const sinMapa = [];
  const noEncontrados = Object.keys(MAPA).filter((k) => !k.startsWith('_'));

  for (const libro of rows) {
    const cat = MAPA[libro.titulo];
    if (cat === undefined) {
      sinMapa.push(libro.titulo);
      continue;
    }
    if (libro.categoria !== cat) {
      actualizaciones.push({ id: libro.id, titulo: libro.titulo, desde: libro.categoria, hasta: cat });
    }
    const i = noEncontrados.indexOf(libro.titulo);
    if (i >= 0) noEncontrados.splice(i, 1);
  }

  console.log('=== CATEGORÍAS (' + (APLICAR ? 'APLICANDO' : 'simulacro') + ') ===');
  console.log('libros en la tabla :', rows.length);
  console.log('a actualizar       :', actualizaciones.length);
  console.log('sin categoría en el mapa:', sinMapa.length);

  if (actualizaciones.length) {
    console.log('\nCambios:');
    actualizaciones.forEach((a) =>
      console.log(`  ${a.titulo}\n     ${a.desde || '(vacía)'}  ->  ${a.hasta}`)
    );
  }
  if (sinMapa.length) {
    console.log('\nLibros SIN categoría definida en el mapa:');
    sinMapa.forEach((t) => console.log('  - ' + t));
  }
  if (noEncontrados.length) {
    console.log('\nTítulos del mapa que NO están en la tabla:');
    noEncontrados.forEach((t) => console.log('  - ' + t));
  }

  if (APLICAR && actualizaciones.length) {
    for (const a of actualizaciones) {
      await client.query('update libros set categoria = $1, updated_at = now() where id = $2', [
        a.hasta,
        a.id,
      ]);
    }
    console.log('\n✅ Actualizados', actualizaciones.length, 'libros.');
  } else if (!APLICAR) {
    console.log('\n⚠️  Simulacro: no se escribió nada. Ejecutá con --aplicar para aplicar.');
  }

  await client.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
