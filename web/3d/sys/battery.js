// Battery use: while the phone runs on battery and the game is being played, each 1% the battery
// drops is timed and filed under the settings in force for the whole of it (frame rate cap and
// graphics level), so Settings > Battery use can show %/hour for each. The phone reports its level
// only in whole percents, so a reading needs a few drops (10-20 minutes) to mean much; screen
// brightness and what else the phone runs count too, so compare at one brightness.
const KEY = 'batteryUse3d';

export function batterySystem(G) {
  const log = G.store.get(KEY, {});   // setting -> { s: seconds, n: percents dropped }
  let bat = null, level = null, t = 0, mixed = false, primed = false, setting = '', wall = 0;
  const now = () => `${G.settings.fpsCap} fps, ${['low', 'medium', 'high'][G.gfx?.level ?? 1]}`;
  navigator.getBattery?.().then(x => { bat = x; level = x.level; }).catch(() => {});
  const restart = () => { t = 0; mixed = false; primed = false; level = bat?.level ?? null; setting = now(); };

  const rate = k => { const e = log[k]; return e && e.n ? e.n / e.s * 3600 : null; };
  const sub = () => {
    if (!navigator.getBattery) return 'this browser does not report the battery';
    const rows = Object.keys(log).filter(k => log[k].n).sort((a, q) => rate(a) - rate(q));
    if (!rows.length) return 'play on battery for 10-20 minutes per setting to measure';
    return rows.map(k => `${k}: ${rate(k).toFixed(0)}%/h (${Math.round(log[k].s / 60)} min)`).join(' · ');
  };
  const row = G.menu.button('play', { label: 'Battery use', sub: sub(), group: 'app', onClick: el => {
    if (el.dataset.sure) { for (const k in log) delete log[k]; G.store.set(KEY, log); delete el.dataset.sure; }
    else el.dataset.sure = 1;
    el.querySelector('em').textContent = el.dataset.sure ? 'tap again to clear the readings' : sub();
  } });
  G.menu.onOpen(() => { delete row.dataset.sure; row.querySelector('em').textContent = sub(); });

  return {
    id: 'battery',
    update() {
      if (!bat) return;
      if (bat.charging || document.hidden) { restart(); return; }
      if (setting !== now()) { restart(); return; }   // a change of setting starts the timing again
      // a pause or a hitch (no frames for a while) muddies this percent: skip it
      const w = performance.now(), gap = w - wall; wall = w;
      if (gap > 500) mixed = true; else t += gap / 1000;   // wall time: dt is capped, so it undercounts at 15 fps
      if (level == null) { level = bat.level; return; }
      if (bat.level < level - .005) {
        // the first drop only starts the clock (it may have been part-way through a percent)
        if (primed && !mixed) {
          const e = log[setting] ||= { s: 0, n: 0 };
          e.s += t; e.n += Math.round((level - bat.level) * 100);
          G.store.set(KEY, log);
        }
        level = bat.level; t = 0; mixed = false; primed = true;
      }
    },
  };
}
