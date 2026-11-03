// Mide posiciones del header para diseñar el logo alargado
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  for (const w of [1920, 1600, 1366, 1100, 900, 760, 560, 390]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 450));

    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
      const logo = r('.logo img');
      const nav = r('.nav');
      const cat = r('.nav__enlace');
      const cont = r('.header__contenido');
      const acciones = r('.header__acciones');
      return {
        vw: window.innerWidth,
        contenedor: cont, logo, nav, cat: cat && cat.l, acciones,
        margenIzq: cont ? cont.l : null,
        gapLogoCat: (logo && cat) ? Math.round(cat - logo.r) : null,
        gapLogoNav: (logo && nav) ? Math.round(nav.l - logo.r) : null,
        libreDcha: (acciones && cont) ? Math.round(cont.r - acciones.r) : null,
      };
    });
    console.log(JSON.stringify(m));
  }
  await browser.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
