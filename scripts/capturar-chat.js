// ============================================================
//  LibrosHernes - Capturas del chat del Buhito Sabio 🦉
//  Uso: node scripts/capturar-chat.js   (el servidor debe estar arriba)
// ============================================================
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:' + (process.env.PORT || 3000);
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

  // ---------- 1) Tienda: botón por libro + botón flotante ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => document.querySelector('#catalogo').scrollIntoView());
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: salida('captura-tienda-buho.png') });

  const estadoTienda = await page.evaluate(() => ({
    botonesBuho: document.querySelectorAll('[data-accion="chat"]').length,
    fabVisible: document.querySelector('#btnBuhoFab')?.offsetParent !== null,
  }));

  // ---------- 2) Chat genérico ----------
  await page.goto(BASE + '/chat.html', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: salida('captura-chat.png') });

  // Un mensaje de prueba (responde el fallback sin clave de IA)
  await page.type('#inputMensaje', '¿Tienen algo de García Márquez?');
  await page.click('#btnEnviar');
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: salida('captura-chat-mensaje.png') });

  const estadoChat = await page.evaluate(() => ({
    mensajes: document.querySelectorAll('.mensaje').length,
    burbujas: [...document.querySelectorAll('.mensaje__burbuja')].map((b) => b.textContent.slice(0, 60)),
    sugerencias: document.querySelectorAll('.chip').length,
  }));

  // ---------- 3) Chat abierto desde un libro ----------
  await page.goto(BASE + '/chat.html?libro=demo-2', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: salida('captura-chat-libro.png') });

  const estadoLibro = await page.evaluate(() => ({
    contextoVisible: document.querySelector('#contextoLibro').offsetParent !== null,
    contextoTitulo: document.querySelector('#contextoTitulo').textContent,
    saludo: document.querySelector('.mensaje__burbuja')?.textContent.slice(0, 80),
  }));

  // ---------- 4) Vista móvil ----------
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/chat.html', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: salida('captura-chat-movil.png') });

  await browser.close();

  console.log('=== TIENDA ===');
  console.log(JSON.stringify(estadoTienda, null, 2));
  console.log('=== CHAT ===');
  console.log(JSON.stringify(estadoChat, null, 2));
  console.log('=== CHAT CON LIBRO ===');
  console.log(JSON.stringify(estadoLibro, null, 2));
  console.log('=== ERRORES ===');
  console.log(errores.length ? errores.join('\n') : '(ninguno ✅)');
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
