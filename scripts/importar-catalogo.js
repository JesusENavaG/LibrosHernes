// ============================================================
//  LibrosHernes - Importar catalogo a la base de datos
//
//  Lee catalogo-libros.csv y carga los libros en la tabla
//  'libros' (Supabase) con precio y stock configurables.
//  Las fotos se sirven desde public/img/libros/.
//
//  Uso:  node scripts/importar-catalogo.js              (carga)
//        node scripts/importar-catalogo.js --borrar-demo (ademas borra demo)
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PRECIO = 5000;   // precio unico para todos los libros
const STOCK = 1;       // ejemplares usados, normalmente 1 c/u
const CARPETA_IMG = '/img/libros'; // carpeta publica (public/img/libros)

// ---- Parser de CSV simple (respeta comillas y comas internas) ----
function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else entreComillas = false;
      } else campo += c;
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'catalogo-libros.csv');
  const lineas = parseCsv(fs.readFileSync(csvPath, 'utf8'));

  // Encabezado: archivo,titulo,autor,editorial,precio,stock,notas
  const datos = lineas.slice(1).map((f) => ({
    archivo: (f[0] || '').trim(),
    titulo: (f[1] || '').trim(),
    autor: (f[2] || '').trim(),
    editorial: (f[3] || '').trim(),
    notas: (f[6] || '').trim(),
  })).filter((d) => d.titulo);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const borrarDemo = process.argv.includes('--borrar-demo');
  if (borrarDemo) {
    // Los libros de ejemplo usan las tapas SVG incluidas en el proyecto
    const r = await client.query(
      "delete from libros where imagen_url like '/img/covers/%' returning titulo"
    );
    console.log(`Borrados ${r.rowCount} libros de ejemplo:`, r.rows.map((x) => x.titulo).join(', '));
  }

  // Evitar duplicados: borra los que tengan el mismo archivo de foto ya cargado
  let insertados = 0;
  const omitidos = [];

  for (const d of datos) {
    const imagenUrl = `${CARPETA_IMG}/${d.archivo}`;
    // Editorial y notas van en la descripcion
    const partes = [];
    if (d.editorial) partes.push(`Editorial: ${d.editorial}.`);
    if (d.notas) partes.push(d.notas + '.');
    const descripcion = partes.join(' ') || null;

    const existe = await client.query(
      'select id from libros where imagen_url = $1 limit 1',
      [imagenUrl]
    );
    if (existe.rowCount > 0) {
      omitidos.push(`${d.titulo} (ya cargado)`);
      continue;
    }

    await client.query(
      `insert into libros (titulo, autor, descripcion, precio, imagen_url, stock, activo)
       values ($1, $2, $3, $4, $5, $6, true)`,
      [d.titulo, d.autor || null, descripcion, PRECIO, imagenUrl, STOCK]
    );
    insertados++;
  }

  const total = await client.query('select count(*)::int as n from libros');
  console.log('\n=== IMPORTACIÓN DE CATÁLOGO ===');
  console.log('insertados :', insertados);
  console.log('omitidos   :', omitidos.length, omitidos.length ? `\n  ${omitidos.join('\n  ')}` : '');
  console.log('total libros en tabla:', total.rows[0].n);
  await client.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
