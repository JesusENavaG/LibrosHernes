// Recorta la barra blanca del borde derecho de los logos
const sharp = require('sharp');

const objetivos = [
  'public/img/logo-verde.png',
  'public/img/logo-transparente.png',
];

(async () => {
  for (const f of objetivos) {
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;

    // 1ª columna blanca (>=50% de píxeles casi blancos opacos)
    let primeraBlanca = w;
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * ch;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const a = ch === 4 ? data[i + 3] : 255;
        if (a > 200 && r > 200 && g > 200 && b > 190) n++;
      }
      if (n > h * 0.5) { primeraBlanca = x; break; }
    }

    if (primeraBlanca >= w) { console.log(f + ': sin barra blanca, no se recorta'); continue; }

    const nuevoAncho = primeraBlanca; // deja fuera la barra + su borde de mezcla
    await sharp(f)
      .extract({ left: 0, top: 0, width: nuevoAncho, height: h })
      .toFile(f + '.nuevo');

    require('fs').renameSync(f + '.nuevo', f);

    // verificar
    const v = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    let blancas = 0;
    for (let x = 0; x < v.info.width; x++) {
      let n = 0;
      for (let y = 0; y < v.info.height; y++) {
        const i = (y * v.info.width + x) * v.info.channels;
        const r = v.data[i], g = v.data[i + 1], b = v.data[i + 2];
        const a = v.info.channels === 4 ? v.data[i + 3] : 255;
        if (a > 200 && r > 200 && g > 200 && b > 190) n++;
      }
      if (n > v.info.height * 0.5) blancas++;
    }
    console.log(`${f}: ${w}px -> ${v.info.width}px | columnas blancas restantes: ${blancas}`);
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
