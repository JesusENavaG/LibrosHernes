// Verifica que cerrarModal ya no lanza error y que el scroll se restaura
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE: ' + m.text()); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));

  // Abrir detalle de un libro (modal) y cerrarlo con Escape
  await page.evaluate(() => document.querySelector('.tarjeta__titulo').click());
  await new Promise((r) => setTimeout(r, 400));
  const abierto = await page.evaluate(() => ({
    modalVisible: !document.querySelector('#modalLibro').hidden,
    scrollBloqueado: document.body.style.overflow === 'hidden',
  }));

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  const cerrado = await page.evaluate(() => ({
    modalOculto: document.querySelector('#modalLibro').hidden,
    scrollRestaurado: document.body.style.overflow === '',
  }));

  // Carrito: abrir y cerrar drawer
  await page.click('#btnCarrito');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#btnCarrito').click());
  await new Promise((r) => setTimeout(r, 300));

  await browser.close();

  console.log('ABIERTO :', JSON.stringify(abierto));
  console.log('CERRADO :', JSON.stringify(cerrado));
  console.log('ERRORES :', errores.length ? '\n' + errores.join('\n') : '(ninguno ✅)');
  const ok = cerrado.modalOculto && cerrado.scrollRestaurado && errores.length === 0;
  console.log('RESULTADO:', ok ? '✅ PASA' : '❌ FALLA');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
