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
  // the last row of Settings > Graphics: a small table, one line per setting measured (lightest first),
  // a bar for its share of the hungriest, then %/hour and how long it was timed
  const box = document.createElement('div'); box.className = 'batt3';
  G.menu.button('play', { label: 'Battery use', group: 'app' }).replaceWith(box);
  box.dataset.row = 90;
  let sure = false;
  const draw = () => {
    const rows = Object.keys(log).filter(k => log[k].n).sort((a, q) => rate(a) - rate(q));
    const top = Math.max(...rows.map(rate), 1);
    const note = !navigator.getBattery ? 'This browser does not report the battery.'
      : bat?.charging ? 'Charging: unplug and play to measure.'
      : `Measuring now: ${now()}. Play on battery 10 to 20 minutes per setting.`;
    box.innerHTML = `<div class="bhead3"><b>Battery use</b>${rows.length ? `<button class="bclr3">${sure ? 'Tap again to clear' : 'Clear'}</button>` : ''}</div>
      ${rows.length ? `<ul>${rows.map(k => `<li${k === now() ? ' class="now"' : ''}><span>${k}</span><i><s style="width:${rate(k) / top * 100}%"></s></i><b>${rate(k).toFixed(0)}% <small>/ hour</small></b><small>${Math.round(log[k].s / 60)} min</small></li>`).join('')}</ul>` : ''}
      <p>${note}</p>`;
    box.querySelector('.bclr3')?.addEventListener('click', () => {
      if (sure) { for (const k in log) delete log[k]; G.store.set(KEY, log); }
      sure = !sure; draw();
    });
  };
  G.menu.onOpen(() => { sure = false; draw(); });

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
