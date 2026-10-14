// ============================================================
//  LibrosHernes - Subir fotos al bucket de Supabase Storage
//
//  - Sube imagenes-libros/web/*.jpg al bucket 'libros'
//  - Les pone de nombre el titulo del libro (catalogo-libros.csv)
//  - Actualiza imagen_url en la tabla 'libros' con la URL publica
//
//  Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
//  Uso: node scripts/subir-imagenes.js
// ============================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const URL_BASE = process.env.SUPABASE_URL || '';
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.BUCKET_IMAGENES || 'libros';
const ORIGEN = path.join(__dirname, '..', 'imagenes-libros', 'web');
const VIEJA_CARPETA = '/img/libros'; // ruta anterior (servidor local)

// ---- Parser de CSV (respeta comillas y comas internas) ----
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

// Título -> nombre de archivo seguro (sin acentos ni símbolos)
function aSlug(titulo) {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')              // no alfanuméricos -> guion
    .replace(/^-+|-+$/g, '')                  // guiones al inicio/fin
    .slice(0, 60) || 'libro';
}

async function subir(nombreDestino, buffer, mime) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${nombreDestino}`, {
    method: 'POST',
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${CLAVE}`,
      'Content-Type': mime,
      'x-upsert': 'true', // si ya existe, lo reemplaza
    },
    body: buffer,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${res.statusText} -> ${t}`);
  }
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${nombreDestino}`;
}

async function main() {
  if (!URL_BASE || !CLAVE) {
    console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const csv = parseCsv(fs.readFileSync(path.join(__dirname, '..', 'catalogo-libros.csv'), 'utf8'));
  const datos = csv.slice(1).map((f) => ({
    archivo: (f[0] || '').trim(),
    titulo: (f[1] || '').trim(),
  })).filter((d) => d.titulo && d.archivo);

  // Conexión directa a la tabla (para actualizar imagen_url)
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const usados = new Map(); // para no repetir nombres
  let subidas = 0;
  const fallidas = [];

  for (const d of datos) {
    const origen = path.join(ORIGEN, d.archivo);
    if (!fs.existsSync(origen)) { fallidas.push(`${d.archivo} -> no existe el archivo`); continue; }

    // Nombre final: titulo del libro, sin repetir
    let slug = aSlug(d.titulo);
    const n = usados.get(slug) || 0;
    usados.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n + 1}`;
    const nombreDestino = `${slug}.jpg`;

    try {
      const buffer = fs.readFileSync(origen);
      const urlPublica = await subir(nombreDestino, buffer, 'image/jpeg');

      // Actualiza la fila que tenía la ruta local vieja
      await db.query(
        'update libros set imagen_url = $1, updated_at = now() where imagen_url = $2',
        [urlPublica, `${VIEJA_CARPETA}/${d.archivo}`]
      );
      subidas++;
      process.stdout.write(`  ✔ ${d.titulo.slice(0, 45)} -> ${nombreDestino}\n`);
    } catch (e) {
      fallidas.push(`${d.archivo} -> ${e.message}`);
    }
  }

  // Estado final de la tabla
  const conUrl = await db.query(
    "select count(*)::int as n from libros where imagen_url like 'https://%'"
  );
  const total = await db.query('select count(*)::int as n from libros');

  console.log('\n=== SUBIDA A SUPABASE STORAGE ===');
  console.log('bucket      :', BUCKET);
  console.log('subidas     :', subidas, '/', datos.length);
  console.log('con URL nube:', conUrl.rows[0].n, '/', total.rows[0].n, 'libros');
  if (fallidas.length) console.log('\nFALLIDAS:\n  ' + fallidas.join('\n  '));

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
