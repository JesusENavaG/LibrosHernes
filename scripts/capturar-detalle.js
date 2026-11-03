// Capturas de detalle: footer, pasos, CTA, sección vacía
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const salida = (n) => path.join(__dirname, '..', n);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));

  for (const [sel, nombre] of [
    ['.pasos', 'detalle-pasos.png'],
    ['.cta', 'detalle-cta.png'],
    ['.footer', 'detalle-footer.png'],
    ['.catalogo__filtros', 'detalle-buscador.png'],
  ]) {
    const el = await page.$(sel);
    if (!el) { console.log('no encontrado:', sel); continue; }
    await el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 350));
    await el.screenshot({ path: salida(nombre) });
    console.log('ok:', nombre);
  }

  await browser.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
