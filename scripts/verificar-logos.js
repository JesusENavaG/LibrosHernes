// Verifica que la línea blanca desapareció en footer y en el login del admin
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 700, deviceScaleFactor: 1 });

  // Footer de la tienda
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 45000 });
  await page.evaluate(() => document.querySelector('.footer')?.scrollIntoView());
  await new Promise((r) => setTimeout(r, 700));
  const footer = await page.$('.footer');
  if (footer) { await footer.screenshot({ path: 'ver-footer.png' }); console.log('OK ver-footer.png'); }

  // Login del admin
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle0', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 700));
  const login = await page.$('.login');
  if (login) { await login.screenshot({ path: 'ver-login.png' }); console.log('OK ver-login.png'); }
  else { await page.screenshot({ path: 'ver-login.png' }); console.log('OK ver-login.png (pagina completa)'); }

  await browser.close();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
