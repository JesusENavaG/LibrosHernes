// ============================================================
//  LibrosHernes - Capturas de pantalla para revisión
//  Uso: node scripts/capturar.js
// ============================================================
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const salida = (nombre) => path.join(__dirname, '..', nombre);

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

  // ---------- 1) Página principal ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));

  const estado = await page.evaluate(() => ({
    tarjetas: document.querySelectorAll('.tarjeta').length,
    modalesVisibles: [...document.querySelectorAll('.modal')].filter((m) => m.offsetParent !== null).length,
    drawerAbierto: document.querySelector('#drawerCarrito').classList.contains('abierto'),
    fondo: getComputedStyle(document.body).backgroundColor,
  }));

  await page.screenshot({ path: salida('captura-tienda.png'), fullPage: true });
  await page.screenshot({ path: salida('captura-viewport.png') });

  // ---------- 2) Carrito + formulario (solo al pedirlo) ----------
  await page.click('[data-accion="agregar"]');           // agrega el 1er libro
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnCarrito');                        // abre carrito
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: salida('captura-carrito.png') });

  await page.click('#btnIrPedido');                        // abre el formulario
  await new Promise((r) => setTimeout(r, 400));
  const estadoForm = await page.evaluate(() => ({
    modalPedidoVisible: document.querySelector('#modalPedido').offsetParent !== null,
    modalLibroVisible: document.querySelector('#modalLibro').offsetParent !== null,
  }));
  await page.screenshot({ path: salida('captura-formulario.png') });

  // ---------- 3) Panel de administración ----------
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1366, height: 900 });
  page2.on('pageerror', (e) => errores.push('ADMIN PAGEERROR: ' + e.message));
  await page2.goto(BASE + '/admin', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  await page2.screenshot({ path: salida('captura-admin-login.png') });

  // Ingresar al panel
  await page2.type('#passwordLogin', 'Chiquita123');
  await page2.click('#formLogin button[type="submit"]');
  await new Promise((r) => setTimeout(r, 900));
  const estadoAdmin = await page2.evaluate(() => ({
    panelVisible: document.querySelector('#vistaPanel').offsetParent !== null,
    filas: document.querySelectorAll('.fila-libro').length,
    estado: (document.querySelector('#estadoBbdd') || {}).textContent,
  }));
  await page2.screenshot({ path: salida('captura-admin-panel.png'), fullPage: true });

  await browser.close();

  console.log('=== TIENDA ===');
  console.log(JSON.stringify(estado, null, 2));
  console.log('=== FORMULARIO (al pedirlo) ===');
  console.log(JSON.stringify(estadoForm, null, 2));
  console.log('=== ADMIN ===');
  console.log(JSON.stringify(estadoAdmin, null, 2));
  console.log('=== ERRORES ===');
  console.log(errores.length ? errores.join('\n') : '(ninguno ✅)');
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
