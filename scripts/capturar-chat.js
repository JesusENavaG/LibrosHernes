// ============================================================
//  LibrosHernes - Capturas del chat flotante del Buhito Sabio 🦉
//  Uso: node scripts/capturar-chat.js   (el servidor debe estar arriba)
// ============================================================
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:' + (process.env.PORT || 3000);
const salida = (nombre) => path.join(__dirname, '..', nombre);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // ---------- 1) Tienda con el botón flotante ----------
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await esperar(600);
  await page.evaluate(() => document.querySelector('#catalogo').scrollIntoView());
  await esperar(400);
  await page.screenshot({ path: salida('captura-tienda-buho.png') });

  const estadoTienda = await page.evaluate(() => ({
    botonesBuho: document.querySelectorAll('[data-accion="chat"]').length,
    fabVisible: !document.querySelector('#btnBuhoFab')?.hidden,
    chatOculto: document.querySelector('#buhitoWidget')?.hidden,
    abreEnPestaniaNueva: !!document.querySelector('a[href*="chat.html"]'),
  }));

  // ---------- 2) Abrir el chat desde el botón flotante ----------
  await page.click('#btnBuhoFab');
  await esperar(500);
  await page.screenshot({ path: salida('captura-chat.png') });

  const estadoAbierto = await page.evaluate(() => ({
    abierto: !document.querySelector('#buhitoWidget').hidden,
    fabOculto: document.querySelector('#btnBuhoFab').hidden,
    saludo: document.querySelector('.mensaje__burbuja')?.textContent.slice(0, 60),
    sugerencias: document.querySelectorAll('.chip').length,
    cerradorVisible: document.querySelector('#btnBuhitoCerrar')?.offsetParent !== null,
  }));

  // ---------- 3) La página sigue scrolleando con el chat abierto ----------
  const scrollAntes = await page.evaluate(() => window.scrollY);
  await page.mouse.move(200, 300);
  await page.mouse.wheel({ deltaY: 700 });
  await esperar(500);
  const scrollDespues = await page.evaluate(() => window.scrollY);
  const panelSigueFijo = await page.evaluate(() => {
    const r = document.querySelector('#buhitoWidget').getBoundingClientRect();
    return Math.round(r.bottom) > 0 && Math.round(r.top) < window.innerHeight;
  });
  await page.screenshot({ path: salida('captura-chat-scrolleando.png') });

  // ---------- 4) Mensaje de prueba ----------
  await page.type('#buhitoInput', '¿Tienen algo de García Márquez?');
  await page.click('#buhitoEnviar');
  await esperar(2500);
  await page.screenshot({ path: salida('captura-chat-mensaje.png') });

  const estadoChat = await page.evaluate(() => ({
    mensajes: document.querySelectorAll('.mensaje').length,
    burbujas: [...document.querySelectorAll('.mensaje__burbuja')].map((b) => b.textContent.slice(0, 70)),
    sugerencias: document.querySelectorAll('.chip').length,
  }));

  // ---------- 5) Cerrar y reabrir: conserva la conversación ----------
  const mensajesAntesDeCerrar = await page.evaluate(() => document.querySelectorAll('.mensaje').length);
  await page.click('#btnBuhitoCerrar');
  await esperar(300);
  const estadoCerrado = await page.evaluate(() => ({
    oculto: document.querySelector('#buhitoWidget').hidden,
    fabVisible: !document.querySelector('#btnBuhoFab').hidden,
  }));
  await page.click('#btnBuhoFab');
  await esperar(400);
  const mensajesAlReabrir = await page.evaluate(() => document.querySelectorAll('.mensaje').length);
  await page.screenshot({ path: salida('captura-chat-reabierto.png') });

  // ---------- 6) Chat abierto desde una ficha de libro ----------
  await page.evaluate(() => document.querySelector('#btnBuhitoCerrar').click());
  await esperar(250);
  await page.evaluate(() => document.querySelector('[data-accion="chat"]').click());
  await esperar(700);
  await page.screenshot({ path: salida('captura-chat-libro.png') });

  const estadoLibro = await page.evaluate(() => ({
    contextoVisible: !document.querySelector('#buhitoContexto').hidden,
    contextoTitulo: document.querySelector('#buhitoContextoTitulo').textContent,
    abierto: !document.querySelector('#buhitoWidget').hidden,
  }));

  // ---------- 7) Vista móvil ----------
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await esperar(700);
  await page.evaluate(() => document.querySelector('#btnBuhoFab').click());
  await esperar(500);
  await page.screenshot({ path: salida('captura-chat-movil.png') });

  const estadoMovil = await page.evaluate(() => {
    const r = document.querySelector('#buhitoWidget').getBoundingClientRect();
    return {
      abierto: !document.querySelector('#buhitoWidget').hidden,
      ancho: Math.round(r.width),
      alto: Math.round(r.height),
      ocupaPantalla: Math.round((r.height / window.innerHeight) * 100) + '%',
      ocupandoAncho: Math.round((r.width / window.innerWidth) * 100) + '%',
    };
  });

  await browser.close();

  console.log('=== TIENDA ===');
  console.log(JSON.stringify(estadoTienda, null, 2));
  console.log('=== CHAT ABIERTO ===');
  console.log(JSON.stringify(estadoAbierto, null, 2));
  console.log('=== SCROLL CON CHAT ABIERTO ===');
  console.log(JSON.stringify({ scrollAntes, scrollDespues, scrolleo: scrollDespues > scrollAntes, panelSigueFijo }, null, 2));
  console.log('=== MENSAJE ===');
  console.log(JSON.stringify(estadoChat, null, 2));
  console.log('=== CERRAR / REABRIR ===');
  console.log(JSON.stringify({ mensajesAntesDeCerrar, estadoCerrado, mensajesAlReabrir, conserva: mensajesAlReabrir >= mensajesAntesDeCerrar }, null, 2));
  console.log('=== DESDE UN LIBRO ===');
  console.log(JSON.stringify(estadoLibro, null, 2));
  console.log('=== MÓVIL ===');
  console.log(JSON.stringify(estadoMovil, null, 2));
  console.log('=== ERRORES ===');
  console.log(errores.length ? errores.join('\n') : '(ninguno ✅)');
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
