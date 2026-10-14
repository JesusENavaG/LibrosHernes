// ============================================================
//  LibrosHernes - Sincronizar catalogo con la base de datos
//
//  Actualiza titulo, autor y descripcion de los libros que ya
//  existen (match por imagen_url) segun catalogo-libros.csv.
//  No borra ni inserta nada.
//
//  Uso: node scripts/sincronizar-catalogo.js
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CARPETA_IMG = '/img/libros';

function parseCsv(texto) {
  const filas = [];
  let fila = [], campo = '', entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else entreComillas = false; }
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'catalogo-libros.csv');
  const lineas = parseCsv(fs.readFileSync(csvPath, 'utf8'));

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

  let actualizados = 0;
  const cambios = [];

  for (const d of datos) {
    const imagenUrl = `${CARPETA_IMG}/${d.archivo}`;
    const partes = [];
    if (d.editorial) partes.push(`Editorial: ${d.editorial}.`);
    if (d.notas) partes.push(d.notas + '.');
    const descripcion = partes.join(' ') || null;

    const r = await client.query(
      `update libros
         set titulo = $1, autor = $2, descripcion = $3, updated_at = now()
       where imagen_url = $4
       returning titulo, autor`,
      [d.titulo, d.autor || null, descripcion, imagenUrl]
    );
    if (r.rowCount > 0) actualizados++;
  }

  const total = await client.query('select count(*)::int as n from libros');
  console.log('=== SINCRONIZACIÓN DE CATÁLOGO ===');
  console.log('filas sincronizadas :', actualizados, '/', datos.length);
  console.log('total libros en tabla:', total.rows[0].n);

  // Muestra los 5 primeros para confirmar
  const muestra = await client.query(
    'select titulo, autor, precio, stock, imagen_url from libros order by titulo limit 5'
  );
  console.table(muestra.rows);
  await client.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
