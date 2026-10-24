// Smoke test: serves web/ and plays the game in headless Chromium through a set of scenes, then
// reports every page error, any bird that lost its position (NaN), and a line per scene.
//   node tools/smoke.mjs            all scenes
//   node tools/smoke.mjs menu tour  only those
// Needs Playwright (npm i -g playwright, or npx playwright install chromium once). Headless WebGL
// is software (SwiftShader), so frame rates here mean nothing; it is for errors and broken flows.
// Exits 1 when anything failed. Add a scene to SCENES as an async function of the page's
// window.__aloft3d (A), returning a short line.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const load = () => {
  try { return createRequire(import.meta.url)('playwright'); } catch { /* not local */ }
  const g = execSync('npm root -g').toString().trim();
  return createRequire(path.join(g, 'x.js'))('playwright');
};
const { chromium } = load();

// each runs in the page: A = window.__aloft3d, E = earth.js, wait(s)
const SCENES = {
  boot: `return 'bird ' + A.b.state + ' at ' + A.b.p.map(v => v | 0);`,
  // the first flight (sys/lessons.js), flown on the keyboard step by step, then the first lesson
  lessons: `const L = A.G.lessons; if (!L.flying) return 'no first flight on a new journey (lost)';
    const start = A.b.state, title = () => document.querySelector('.coach3 .ct3')?.textContent || '';
    const until = async (f, s) => { for (let i = 0; i < s * 10; i++) { if (f()) return true; await wait(.1); } return false; };
    const down = c => dispatchEvent(new KeyboardEvent('keydown', { code: c })), up = c => dispatchEvent(new KeyboardEvent('keyup', { code: c }));
    const KEYS = { Climb: ['KeyW'], Dive: ['KeyS'], 'Turn left': ['KeyA'], 'Turn right': ['KeyD'], Soar: ['KeyQ'], 'Fast glide': ['ShiftLeft'], Land: ['KeyQ', 'KeyS'] };
    const seen = [];
    for (let n = 0; n < 40 && L.flying; n++) {
      const t = title(); seen.push(t);
      if (t === 'Take off' || t === 'Take off again') { for (let i = 0; i < 60 && title() === t; i++) { if (A.b.state !== 'fly') A.G.actions.takeoff.run(); await wait(2); } }
      if (t === 'Flap') for (let i = 0; i < 4; i++) { down('Space'); await wait(.05); up('Space'); await wait(.6); }
      for (const k of KEYS[t] || []) down(k);
      await until(() => title() !== t || !L.flying, t === 'Land' ? 400 : 150);
      for (const k of KEYS[t] || []) up(k);
      if (title() === t && L.flying) return 'stuck at ' + t + ' after ' + seen.join(', ') + ' (lost)';
    }
    if (L.flying) return 'first flight did not end: ' + seen.join(', ') + ' (lost)';
    const card = await until(() => !document.querySelector('.lveil3')?.classList.contains('hidden'), 60);
    document.querySelector('.lveil3 [data-i="go"]')?.click(); await wait(7);
    const today = document.querySelector('.aims3 [data-order="3"]');
    A.G.menu.set(true, 'today'); await wait(.4); const shown = today && !today.classList.contains('hidden'); A.G.menu.set(false);
    return 'from ' + start + ': ' + seen.join(', ') + '; then ' + (card ? 'the lessons card, ' : '(no lessons card: lost) ') + (L.learning ? 'lessons' : 'done') + (shown ? ', Today lists ' + today.querySelector('.lch3 b')?.textContent : ' (Today has no lessons: lost)');`,
  menu: `const out = [];
    for (const tab of ['today', 'map', 'journal', 'how', 'play']) {
      A.G.menu.set(true, tab); await wait(.5);
      const pages = [...document.querySelectorAll('[data-for="' + tab + '"] [data-page]')].filter(e => e.tagName === 'BUTTON');
      for (const p of pages) { p.click(); await wait(.25); }
      out.push(tab + ' ' + pages.length);
    }
    A.G.menu.set(false); await wait(.5);
    return 'tabs and pages: ' + out.join(', ');`,
  tour: `const out = [];
    for (const [n, la, lo] of [['Sahara', 23, 10], ['Amazon', -4, -62], ['Himalaya', 30, 85], ['Siberia', 65, 105], ['Pacific', 0, -150], ['Greenland', 72, -40], ['Australia', -25, 133], ['Antarctica', -80, 20]]) {
      const p = E.toXZ(la, lo); A.b.p = [p[0], 0, p[1]]; A.dbg.fly(50); A.b.yaw = 1.2; A.b.s = 14; await wait(3);
      out.push(n + (A.b.p.every(Number.isFinite) ? '' : ' (NaN!)'));
    }
    A.b.p = [E.EARTH.W / 2 - 30, 0, 0]; A.dbg.fly(60); A.b.yaw = Math.PI / 2; A.b.s = 20; await wait(4);
    return out.join(', ') + '; across the date line to x ' + (A.b.p[0] | 0);`,
  travel: `const out = [];
    for (const [la, lo] of [[85, 0], [27.98, 86.92], [-33.9, 18.4]]) {
      const [x, z] = E.toXZ(la, lo); let done = false; A.G.travelTo(x, z, () => { done = true; }); await wait(5);
      out.push(la + ',' + lo + ' ' + (done ? A.b.state : 'not arrived'));
    }
    return out.join('; ');`,
  hunt: `const m = A.dbg.mouse(); if (!m) return 'no mouse near';
    A.b.p = [m.x, m.y + 1.5, m.z]; A.b.vy = -2; await wait(1.5);
    const got = A.b.carry?.kind; A.G.actions.eat?.run(); await wait(4);
    return 'caught ' + (got || 'nothing') + ', then ' + (A.b.carry ? 'still carrying' : 'eaten');`,
  perch: `A.G.tod = .45; let s = null;
    for (let i = 0; i < 20 && !s; i++) { s = A.G.systems.songs.near().find(q => q.out); if (!s) { A.dbg.forest(); await wait(2); } }
    if (!s) return 'no songbird found';
    Object.assign(A.b, { state: 'perch', p: [s.x + 4, s.y, s.z], perch: { x: s.x + 4, y: s.y, z: s.z }, s: 0, settle: 0 }); await wait(2);
    A.G.systems.songs.ui.sing?.(true); await wait(1);
    for (let i = 0; i < 12; i++) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + (1 + i % 5), key: String(1 + i % 5) })); await wait(.3); }
    A.G.tod = .95; await wait(1); const can = A.G.actions.sleep?.when(); A.G.actions.sleep?.run(); await wait(5);
    const slept = A.b.asleep; A.G.actions.takeoff?.run?.(); await wait(2);
    return 'perched by a ' + s.sp.name + ', sang, sleep offered ' + !!can + ', slept ' + !!slept + ', took off: ' + A.b.state;`,
};
const BIRDS = ['hawk', 'osprey', 'owl', 'raven', 'albatross'];

const want = process.argv.slice(2);
const types = { js: 'text/javascript', mjs: 'text/javascript', html: 'text/html', css: 'text/css', json: 'application/json', webmanifest: 'application/json', woff2: 'font/woff2', png: 'image/png', svg: 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[f.split('.').pop()] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
const url = `http://localhost:${srv.address().port}/index.html?seed=3${process.env.SMOKE_Q ? '&' + process.env.SMOKE_Q : ''}`;   // SMOKE_Q: more of the query (look=all)
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const run = async (bird, names) => {
  const pg = await br.newPage({ viewport: { width: 640, height: 300 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]?.trim()));
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.addInitScript(b => { try { localStorage.setItem('aloft.bird', JSON.stringify(b)); } catch { /* */ } }, bird);
  await pg.goto(url);
  await pg.waitForFunction(() => window.__aloft3d, null, { timeout: 60000 });
  await pg.evaluate(() => { document.body.click(); return new Promise(r => setTimeout(r, 4000)); });
  for (const n of names) {
    const before = errs.length;
    let line;
    try {
      line = await pg.evaluate(`(async () => { const A = window.__aloft3d, E = await import('/3d/earth.js'), wait = s => new Promise(r => setTimeout(r, s * 1000)); ${SCENES[n]} })()`);
    } catch (e) { line = 'threw: ' + e.message.split('\n')[0]; errs.push(line); }
    const bad = errs.length > before || / NaN|lost/.test(line);
    if (bad) failed++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${bird.padEnd(9)} ${n.padEnd(7)} ${line}`);
    for (const e of [...new Set(errs.slice(before))].slice(0, 5)) console.log('       ' + e);
  }
  await pg.close();
};
const names = Object.keys(SCENES).filter(n => !want.length || want.includes(n));
await run('hawk', names);
if (!want.length || want.includes('birds')) for (const b of BIRDS.slice(1)) await run(b, ['boot']);
await br.close(); srv.close();
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
