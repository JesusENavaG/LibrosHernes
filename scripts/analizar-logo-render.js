// Analiza los píxeles renderizados del logo del footer (borde derecho)
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 700, deviceScaleFactor: 4 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => document.querySelector('.footer')?.scrollIntoView());
  await new Promise((r) => setTimeout(r, 700));

  const img = await page.$('.footer__marca img');
  await img.screenshot({ path: 'zoom-footer-logo.png' });
  await browser.close();

  const { data, info } = await sharp('zoom-footer-logo.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  console.log(`render: ${w}x${h} (dsf=4, o sea ${w / 4}px reales)`);
  console.log('--- 8 últimas columnas (promedio) ---');
  for (let x = w - 8; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let y = 0; y < h; y++) { const i = (y * w + x) * ch; r += data[i]; g += data[i + 1]; b += data[i + 2]; if (ch === 4) a += data[i + 3]; }
    const n = h;
    console.log(`  col ${x}: rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})${ch === 4 ? ' a=' + Math.round(a / n) : ''}`);
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
