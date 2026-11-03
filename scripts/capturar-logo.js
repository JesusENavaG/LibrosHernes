// Captura el header en varios anchos para revisar el logo alargado
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

const ANCHOS = [1920, 1366, 900, 390];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  for (const w of ANCHOS) {
    await page.setViewport({ width: w, height: 620, deviceScaleFactor: 1 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 600));

    const archivo = `logo-${w}.png`;
    await page.screenshot({ path: archivo });

    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
      const logo = r('.logo img'), cat = r('.nav__enlace'), cont = r('.header__contenido'), head = r('.header');
      return { margenIzq: cont && cont.l, logoDcha: logo && logo.r, catIzq: cat && cat.l,
               hueco: (logo && cat) ? Math.round(cat - logo.r) : null, altoHeader: head && head.h };
    });
    console.log(`${archivo} | ${JSON.stringify(m)}`);
  }
  await browser.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
