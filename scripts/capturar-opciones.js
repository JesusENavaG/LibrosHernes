// Compara en 1920 el hueco actual (= margen izquierdo) vs. uno más corto
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 620, deviceScaleFactor: 1 });

  // Opcion A: hueco actual = margen izquierdo (370px)
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'opc-a-1920.png', clip: { x: 0, y: 0, width: 1920, height: 140 } });

  // Opcion B: hueco corto (240px) -> logo mas cerca de Catalogo
  await page.addStyleTag({ content: ':root { --gap-header: 240px !important; }' });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'opc-b-1920.png', clip: { x: 0, y: 0, width: 1920, height: 140 } });

  console.log('OK: opc-a-1920.png (hueco 370 = margen) / opc-b-1920.png (hueco 240)');
  await browser.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
