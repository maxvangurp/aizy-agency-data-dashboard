import { chromium } from 'playwright';
const KLANT = process.argv[2] ?? 'Pouw';
const PAGINAS = process.argv.slice(3).map((a) => a.split('='));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0,200)));
await page.goto('http://localhost:8000/index.html');
await page.evaluate(() => {
  localStorage.setItem('aizy.theme','light'); localStorage.setItem('aizy.dataMode','live');
  localStorage.removeItem('aizy.session'); localStorage.removeItem('aizy.state'); location.hash='#/login';
});
await page.reload(); await page.waitForSelector('#loginForm');
await page.fill('#loginForm [name="email"]','enrico@aizy.demo');
await page.fill('#loginForm [name="wachtwoord"]','demo123');
await page.click('#loginForm button[type="submit"]');
await page.waitForFunction(() => !location.hash.includes('/login'));
await page.waitForTimeout(1200);
await page.evaluate(() => { location.hash = '#/pulse'; });
await page.waitForTimeout(1200);
for (const sel of await page.$$('select')) {
  if (!(await sel.isVisible())) continue;
  const opties = await sel.$$eval('option', (o) => o.map((x) => x.textContent.trim()));
  const t = opties.find((x) => new RegExp(KLANT, 'i').test(x));
  if (t) { await sel.selectOption({ label: t }); break; }
}
await page.waitForTimeout(2500);
for (const [hash, naam] of PAGINAS) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `/tmp/shots/${naam}.png`, fullPage: true });
  console.log(naam, 'ok');
}
await browser.close();
