// ============================================================
//  LibrosHernes - Preparación de fotos de libros para la web
//
//  - Endereza la foto 90° (las tapas están fotografiadas de lado)
//  - Redimensiona a 1200px de alto (peso apto para catálogo)
//  - Recorta al formato del catálogo (2:2.6, el de .tarjeta__media)
//  - Exporta JPEG calidad 80
//
//  Uso: node scripts/preparar-imagenes.js
//  Entrada: imagenes-libros/*.jpg   Salida: imagenes-libros/web/*.jpg
// ============================================================
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ORIGEN = path.join(__dirname, '..', 'imagenes-libros');
const SALIDA = path.join(ORIGEN, 'web');

const ALTO = 1200;                       // alto de la imagen final
const RATIO = 2 / 2.6;                   // aspecto del catálogo (tarjeta)
const CALIDAD = 80;
const GIRO = 90;                         // giro para dejar la tapa derecha

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

  const ancho = Math.round(ALTO * RATIO);
  let totalOrigen = 0;
  let totalSalida = 0;
  const fallidas = [];

  for (const f of archivos) {
    try {
      const src = path.join(ORIGEN, f);
      totalOrigen += fs.statSync(src).size;

      // 1) Girar PRIMERO (sharp aplicaría el resize antes del giro si van en la
      //    misma cadena, y entonces recortaría la foto apaisada como si fuera
      //    la definitiva, cortando los títulos).
      const girada = await sharp(src).rotate(GIRO).toBuffer();

      // 2) Recortar al formato del catálogo y comprimir
      const info = await sharp(girada)
        .resize(ancho, ALTO, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: CALIDAD, progressive: true })
        .toFile(path.join(SALIDA, f));

      totalSalida += info.size;
    } catch (e) {
      fallidas.push(f + ' -> ' + e.message);
    }
  }

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('=== PREPARACIÓN DE IMÁGENES ===');
  console.log('procesadas :', archivos.length - fallidas.length, '/', archivos.length);
  console.log('formato    :', ancho + 'x' + ALTO + ' px (2:2.6), JPEG q' + CALIDAD + ', giro ' + GIRO + '°');
  console.log('origen     :', kb(totalOrigen));
  console.log('resultado  :', kb(totalSalida));
  console.log('reducción  :', (100 - (totalSalida / totalOrigen) * 100).toFixed(1) + ' %');
  if (fallidas.length) {
    console.log('\nFALLIDAS:');
    console.log(fallidas.join('\n'));
  }
  console.log('\nSalida en:', SALIDA);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
