// Regenerates web/icons/*.png from tools/icon.html with headless Chromium (Playwright).
// Usage: node tools/make-icons.mjs   (serves the repo root on a temporary port)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer(async (q, r) => { try { const f = join(root, decodeURIComponent(q.url.split('?')[0])); const body = await readFile(f); r.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); r.end(body); } catch { r.writeHead(404); r.end(); } }).listen(0);
const port = srv.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.goto(`http://localhost:${port}/tools/icon.html`);
await page.waitForFunction('window.done');
const shot = async (size, name, round = false) => {
  await page.evaluate(([s, r]) => { window.render(s); const c = document.getElementById('c'); c.style.width = c.style.height = s + 'px'; c.style.borderRadius = r ? '22%' : '0'; }, [size, round]);
  await page.setViewportSize({ width: size, height: size });
  await page.locator('#c').screenshot({ path: join(root, 'web/icons', name), omitBackground: round });
};
await shot(512, 'icon-512.png'); await shot(192, 'icon-192.png'); await shot(180, 'apple-touch-icon.png'); await shot(32, 'favicon-32.png', true);
await browser.close(); srv.close();
console.log('icons written to web/icons/');
