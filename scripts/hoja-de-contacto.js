// Valida las fotos de imagenes-libros/ y arma "hojas de contacto"
// (grillas con varias fotos) para poder identificar los libros de un vistazo.
// Uso: node scripts/hoja-de-contacto.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ORIGEN = path.join(__dirname, '..', process.argv[2] || 'imagenes-libros');
const SALIDA = path.join(ORIGEN, 'contacto');

const COLS = 4;
const FILAS = 3;
const POR_HOJA = COLS * FILAS;
const W = 420;
const H = 320;

(async () => {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

  const archivos = fs
    .readdirSync(ORIGEN)
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort();

  if (!archivos.length) {
    console.log('No hay .jpg en', ORIGEN);
    process.exit(1);
  }

  // 1) Validar y medir
  const validas = [];
  const fallidas = [];
  for (const f of archivos) {
    try {
      const meta = await sharp(path.join(ORIGEN, f)).metadata();
      validas.push({ archivo: f, w: meta.width, h: meta.height });
    } catch (e) {
      fallidas.push(f + ' -> ' + e.message);
    }
  }

  console.log('=== VALIDACIÓN ===');
  console.log('archivos .jpg:', archivos.length, '| válidas:', validas.length, '| fallidas:', fallidas.length);
  if (fallidas.length) console.log(fallidas.join('\n'));
  const tams = new Set(validas.map((v) => v.w + 'x' + v.h));
  console.log('dimensiones únicas:', [...tams].join(', '));

  // 2) Hojas de contacto
  const hojas = [];
  for (let i = 0; i < validas.length; i += POR_HOJA) {
    hojas.push(validas.slice(i, i + POR_HOJA));
  }

  console.log('\n=== HOJAS DE CONTACTO ===');
  for (let n = 0; n < hojas.length; n++) {
    const grupo = hojas[n];
    const tiles = [];
    for (let j = 0; j < POR_HOJA; j++) {
      const idx = n * POR_HOJA + j;
      const celda = sharp({
        create: { width: W, height: H, channels: 3, background: { r: 240, g: 240, b: 240 } },
      });
      if (grupo[j]) {
        const buf = await sharp(path.join(ORIGEN, grupo[j].archivo))
          .resize(W, H, { fit: 'cover', position: 'attention' })
          .jpeg({ quality: 72 })
          .toBuffer();
        tiles.push({
          input: buf,
          left: (j % COLS) * W,
          top: Math.floor(j / COLS) * H,
        });
      } else {
        const buf = await celda.jpeg().toBuffer();
        tiles.push({ input: buf, left: (j % COLS) * W, top: Math.floor(j / COLS) * H });
      }
    }

    const nombre = `hoja-${n + 1}.jpg`;
    await sharp({
      create: {
        width: COLS * W,
        height: FILAS * H,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(tiles)
      .jpeg({ quality: 78 })
      .toFile(path.join(SALIDA, nombre));

    console.log(`\n${nombre}  (posiciones en orden de lectura, fila por fila):`);
    grupo.forEach((g, j) => {
      const idx = n * POR_HOJA + j;
      const pos = `${String(idx + 1).padStart(2, '0')} [fila ${Math.floor(j / COLS) + 1}, col ${(j % COLS) + 1}]`;
      console.log(`  ${pos}  ${g.archivo}`);
    });
  }

  console.log('\nSalida en:', SALIDA);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
