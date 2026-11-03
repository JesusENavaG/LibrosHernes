// ============================================================
//  LibrosHernes - Capturas del nuevo tema oscuro
//  Uso: node scripts/capturar-tema.js
// ============================================================
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

  const errores = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE: ' + m.text()); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));

  const estado = await page.evaluate(() => {
    const cs = (s) => getComputedStyle(document.querySelector(s));
    return {
      fondoBody: getComputedStyle(document.body).backgroundColor,
      textoBody: getComputedStyle(document.body).color,
      fondoHeader: cs('.header').backgroundColor,
      fondoTarjeta: cs('.tarjeta').backgroundColor,
      textoTarjetaTitulo: cs('.tarjeta__titulo').color,
      fondoFooter: cs('.footer').backgroundColor,
      tarjetas: document.querySelectorAll('.tarjeta').length,
    };
  });

  await page.screenshot({ path: salida('tema-oscuro-viewport.png') });
  await page.screenshot({ path: salida('tema-oscuro-tienda.png'), fullPage: true });

  // Carrito
  await page.click('[data-accion="agregar"]');
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnCarrito');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: salida('tema-oscuro-carrito.png') });

  // Formulario
  await page.click('#btnIrPedido');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: salida('tema-oscuro-formulario.png') });
  await page.keyboard.press('Escape');

  // Chat del Buhito
  await new Promise((r) => setTimeout(r, 300));
  const fab = await page.$('.btn-buho-fab');
  if (fab) {
    await fab.click();
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: salida('tema-oscuro-chat.png') });
  }

  // Admin
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1366, height: 900 });
  page2.on('pageerror', (e) => errores.push('ADMIN PAGEERROR: ' + e.message));
  await page2.goto(BASE + '/admin', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await page2.screenshot({ path: salida('tema-oscuro-admin-login.png') });

  await browser.close();
  console.log(JSON.stringify(estado, null, 2));
  console.log('=== ERRORES ===');
  console.log(errores.length ? errores.join('\n') : '(ninguno)');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
