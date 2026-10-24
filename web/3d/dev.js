// Settings > Dev tools > Feature list: a window that lists the small things added to the game, one
// line each with where to find it and how to try it, and a tick for each one tested (remembered on
// this device). A second tab shows the frame cost from G.perf when the frame loop measures it.
// Systems add their own features with G.dev?.add({ id, title, how, area, round, pr, go }) (go: an
// optional 'Try it' that makes it happen now; the menu closes first); the ones
// shipped before that are listed here in SHIPPED, newest first.
import { store } from './util.js';
import { icon } from './icons.js';
import { BIRD } from './hawk.js';

export const AREAS = ['Flight', 'Ground and perch', 'World', 'Wildlife', 'Food and water', 'Songs and music', 'HUD', 'Menu and map',
  'Journal and story', 'Settings and performance', 'Birds'];

// [id, area, pr, title, how to try it]
const SHIPPED = [
  ['lefty', 'Settings and performance', 181, 'Left-handed layout', 'Settings > Gameplay > Left-handed: Take off and the note pad go left, Sing goes right.'],
  ['mice-farms', 'Wildlife', 179, 'Mice gather round the old farms', 'Fly over a barn, farmyard or village: more mice than in open country.'],
  ['ruins', 'World', 178, 'Abandoned farmsteads, villages, tracks and bridges', 'Explore: villages show in Journal > Landmarks; things people left glint near ruins.'],
  ['drink-tap', 'Food and water', 177, 'Drink by tapping the water, puddles too', 'Land by water or a puddle after rain and tap the water.'],
  ['season-sing', 'HUD', 176, 'Day count hides while the note pad is out', 'Perch, switch Sing on: the line under the dial goes.'],
  ['valley-awvfts', 'Songs and music', 175, 'Valley in the manner of A Winged Victory for the Sullen', 'Turn Music on and listen for a few minutes; Settings > Dev tools > Music lab.'],
  ['sing-switch', 'Songs and music', 175, 'Sing is a switch over the song card; notes ringed, fading 2 s after each', 'Perch, switch Sing on, play a few notes on the pad.'],
  ['dial-cw', 'HUD', 174, 'Day dial turns clockwise, bead in the gap, forecast on the left', 'Watch the dial top right through a morning.'],
  ['hud-bead', 'HUD', 173, 'Bead top HUD: bubble meters, height ladder, compass under the message line', 'Fly: bubbles beside the menu button, ladder under it; a message hides the compass.'],
  ['call-hub', 'HUD', 173, 'Call sits in a cut-out at the day dial’s hub', 'Tap or hold the bird in the middle of the dial.'],
  ['gfx-choice', 'Settings and performance', 171, 'Graphics, Frame rate and Ground detail as choice buttons', 'Settings > Graphics: each pick says what it changes.'],
  ['water-painted', 'World', 170, 'Water: painted depths only', 'Fly over a lake: darker where deep, no wave noise.'],
  ['mice-dig', 'Wildlife', 169, 'Mice dig down out of reach; squeak marks', 'Dive at a mouse slowly: it may vanish into its hole.'],
  ['aurora', 'World', 168, 'Northern lights', 'Fly far north at night, or sing at a summit cairn.'],
  ['hint-settings', 'Menu and map', 167, 'Hint settings: a gear on tips and messages', 'Tap the sliders icon on any tip or message: How to play > Hints.'],
  ['song-tries', 'Songs and music', 165, 'Each try sings from the top; unknown songs as question marks', 'Learn a song: wrong notes are boxed; open the bird list.'],
  ['perch-glide-down', 'Ground and perch', 164, 'Perched, tap the ground to glide down to it', 'Perch in a tree, tap the grass below.'],
  ['clouds-half', 'World', 163, 'Half see-through clouds', 'Fly into a cloud.'],
  ['sleep-perch', 'Ground and perch', 160, 'Sleep only on a perch', 'At night, perch: Sleep shows; on the ground it does not.'],
  ['actions-right', 'Ground and perch', 160, 'Take off and Sleep bottom right, left of the note pad', 'Perch, then switch Sing on: the buttons step left.'],
  ['battery', 'Settings and performance', 159, 'Battery use readings per setting', 'Play 10-20 min on battery, then Settings > Graphics > Battery use.'],
  ['flare-sink', 'Flight', 159, 'Gentler sink while flaring; drinking stops when full', 'Flare (thumbs apart) at speed and watch the height.'],
  ['tree-dissolve', 'World', 157, 'Trees dissolve in at full size at the edge of view', 'Fly fast over forest and watch the far edge.'],
  ['look-up', 'Ground and perch', 150, 'Look up into the boughs from the ground or a perch', 'Perched, swipe down: the view tilts up, then eases back.'],
  ['song-touches', 'Songs and music', 152, 'Five touches on the note pad: swipes and taps', 'Sing: swipe up, down, left, right, or tap a row.'],
  ['icons', 'Menu and map', 146, 'James’s icons across the app', 'Open the menu and look at each section.'],
  ['bird-stats', 'Birds', 148, 'Bird card stats in colour with icons', 'Game > Your bird.'],
  ['perch-only-lit', 'Ground and perch', 143, 'Land only on the highlighted perch', 'Fly slowly at a tree: the green ring is where you land.'],
  ['ground-cam', 'Ground and perch', 142, 'On the ground: face away, pinch zoom, tap to hop', 'Land in a field; pinch; tap a spot near by.'],
  ['menu-columns', 'Menu and map', 141, 'Game and Settings as one column of sections', 'Open the menu: Game, then Settings.'],
  ['float-hover', 'Flight', 137, 'Float in to land and hover', 'Flare and push both thumbs up; at a stop, up and outward hovers.'],
  ['slope-takeoff', 'Ground and perch', 137, 'Take off on a slope turns toward open air', 'Land on a hillside, tap Take off.'],
  ['walls', 'World', 135, 'Uneven stone walls with fallen stones', 'Look for walls across fields and moors.'],
  ['map-corners', 'Menu and map', 134, 'Map corners: dial, place, tallies; pins by colour', 'Menu > Map; hold to drop a pin.'],
  ['rivers', 'World', 133, 'Winding rivers with foam and rapids; water rises after rain', 'Follow a river downhill; watch it after rain.'],
  ['ring-aim', 'Flight', 132, 'Rings: soft yellow aim when lined up', 'Line up on a ring of mist.'],
  ['far-terrain', 'World', 131, 'Finer ground, real far terrain', 'Climb high and look at the horizon.'],
  ['wildlife-lands', 'Wildlife', 128, 'Squirrels, crows, the eagle, hunters that show food, monarchs and dragonflies', 'Watch other hunters stoop: there is food there.'],
  ['ground-worker', 'Settings and performance', 127, 'Ground built off the main thread; auto quality', 'Fly fast: no stutter as ground loads; Graphics on Auto.'],
  ['land-air', 'World', 126, 'Land air, night glow, far horizon, grass waves', 'Fly at dusk over different lands; watch the grass in wind.'],
  ['catch-pins', 'Menu and map', 125, 'Catches left on branches show as brown pins', 'Cache a catch on a branch, then open the Map.'],
  ['prey-reads', 'Food and water', 124, 'Prey that reads you; carry and cache catches', 'Take off while eating to carry the catch to a branch.'],
  ['gust-haptic', 'Settings and performance', 123, 'Haptics: wing beats, landings, a flutter for a gust', 'On a phone with Haptics on, fly into a gust.'],
  ['traces', 'World', 121, 'Barns, fire lookouts, wind pumps, sea stacks, fences', 'Explore the lands.'],
  ['flight-feel', 'Flight', 120, 'Ground effect, visible gusts, slipstream, under-canopy flying', 'Skim low over water; fly behind the wild hawk; fly under the trees.'],
  ['seasons-ground', 'World', 119, 'Real winter, spring and autumn on the ground', 'Play through a season change (8 days).'],
  ['first-season', 'Journal and story', 118, 'A guided first season, ghost flights by link, your life in the Journal', 'New world: follow the companion’s lessons; Journal > Log.'],
  ['bird-goals', 'Birds', 117, 'Each bird’s own move and life goal', 'Fly as the osprey (plunge), owl (silent glide), raven (tumble), red-tail (kite).'],
  ['song-places', 'Songs and music', 116, 'Songs that open places; teach a young bird your song', 'Sing at a summit cairn, under arches, at redwoods, at falls.'],
  ['race', 'Journal and story', 113, 'Race the companion round a ring course', 'Wait for the companion to start a race; finish first for a mouse.'],
  ['new-singers', 'Songs and music', 112, 'Birds of the new lands, night singers, rock-wall echoes', 'Sing in the desert, the mountains, at night, by a cliff.'],
  ['daily-aim', 'Journal and story', 111, 'A daily aim with feathers; the lands collection', 'Journal: today’s aim and the lands you have found.'],
  ['share-cards', 'Journal and story', 109, 'Captioned share cards; screen stays awake; colour-blind aim', 'Photo mode, then share; Settings > Gameplay.'],
  ['species', 'Birds', 74, 'Fly as the red-tail, osprey, barn owl or raven', 'Game > Your bird.'],
  ['ring-courses', 'Flight', 93, 'Rings in climbing courses, new each day', 'Find a low ring; the next one glows a little higher.'],
  ['forecast', 'HUD', 93, 'Weather forecast on the day dial', 'Watch the band beside the dial before rain.'],
  ['stamina-cap', 'Food and water', 95, 'Low food or water lowers max stamina', 'Let hunger fall below a third: the wings bubble shows a hatched cap.'],
  ['new-world', 'Settings and performance', 90, 'Start a new world', 'Game > Play > Start a new world (tap twice).'],
  ['biomes', 'World', 89, 'Biomes in patches, seeded worlds, 20 lands', 'Fly a few km in any direction; Journal > Biomes.'],
  ['yaw', 'Flight', 88, 'Both thumbs slid one way yaw', 'Slide both thumbs left together.'],
  ['map-fly', 'Menu and map', 81, 'Map: double tap to fly there', 'Menu > Map, double tap a known place.'],
];

export function createDev(G, M) {
  const tested = store.get('tested3d', {});
  const list = SHIPPED.map(([id, area, pr, title, how]) => ({ id, area, pr, title, how }));
  const D = {
    add(f) { if (!f?.id || list.some(x => x.id === f.id)) return; list.unshift({ area: 'World', ...f }); if (open) draw(); },
    list,
  };
  let open = false, tab = 'list', area = '', todo = false, timer = 0;
  const el = document.createElement('div');
  el.className = 'dev3 hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Feature list');
  document.body.append(el);   // over the menu (the HUD layer hides while the menu is open)
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const listHtml = () => {
    const shown = list.filter(f => (!area || f.area === area) && (!todo || !tested[f.id]));
    const done = list.filter(f => tested[f.id]).length;
    return `<div class="devbar3"><span>${done} of ${list.length} tested</span>
      <button data-f="todo" class="${todo ? 'on' : ''}">Untested only</button></div>
      <div class="devareas3"><button data-a="" class="${area ? '' : 'on'}">All</button>${AREAS.filter(a => list.some(f => f.area === a)).map(a => `<button data-a="${a}" class="${area === a ? 'on' : ''}">${a}</button>`).join('')}</div>
      <ul>${shown.map(f => `<li class="${tested[f.id] ? 'done3' : ''}"><button data-t="${esc(f.id)}" role="checkbox" aria-checked="${!!tested[f.id]}" aria-label="Tested"><i></i></button>
        <span><b>${esc(f.title)}</b><span>${esc(f.how)}</span></span><em>${esc(f.area)}${f.round ? ' · ' + esc(f.round) : ''}${f.pr ? ' · #' + f.pr : ''}${f.go ? `<button class="go3" data-go="${esc(f.id)}">Try it</button>` : ''}</em></li>`).join('') || '<li class="none3">Nothing here.</li>'}</ul>`;
  };
  // the frame cost: G.perf = { frame, cpu, gpu, gpuHow, deep, note, groups: { name: { item: ms } } }, from perf.js
  const ms = v => v == null ? '–' : `${v.toFixed(1)} ms`;
  const costHtml = () => {
    const P = G.perf;
    if (!P) return '<p class="none3">The frame loop does not measure its parts yet.</p>';
    const groups = Object.entries(P.groups || {}).map(([g, items]) => {
      const rows = Object.entries(items).sort((a, b) => b[1] - a[1]), max = Math.max(.01, ...rows.map(r => r[1]));
      const empty = g === 'Render passes' ? 'This phone has no GPU timers; turn on Measure the GPU to time each pass.' : 'Nothing measured yet.';
      return `<h4>${esc(g)}</h4>${rows.length ? rows.map(([k, v]) => `<div class="cost3"><span>${esc(k)}</span><i style="--w:${(v / max * 100).toFixed(1)}%"></i><b>${v.toFixed(2)} ms</b></div>`).join('') : `<p class="none3">${empty}</p>`}`;
    }).join('');
    return `<div class="devbar3"><span class="devframe3">Frame <b>${ms(P.frame)}</b> · main thread <b>${ms(P.cpu)}</b> · GPU <b>${ms(P.gpu)}</b></span>
      <button data-deep class="${P.deep ? 'on' : ''}">Measure the GPU (slower)</button></div>
      ${P.note ? `<p class="devnote3">${esc(P.note)}</p>` : ''}${groups}`;
  };
  const draw = () => {
    el.innerHTML = `<div class="devcard3"><header><div class="devtabs3"><button data-tab="list" class="${tab === 'list' ? 'on' : ''}">Features</button><button data-tab="cost" class="${tab === 'cost' ? 'on' : ''}">Frame cost</button></div>
      <button class="devx3" data-x aria-label="Close">${icon('done')}</button></header><div class="devbody3">${tab === 'list' ? listHtml() : costHtml()}</div></div>`;
  };
  const show = on => {
    open = on; el.classList.toggle('hidden', !on);
    clearInterval(timer);
    if (on) { draw(); timer = setInterval(() => { if (tab === 'cost') el.querySelector('.devbody3').innerHTML = costHtml(); }, 500); }
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === el || b?.hasAttribute('data-x')) { show(false); return; }
    if (!b) return;
    if (b.dataset.go) { const f = list.find(x => x.id === b.dataset.go); show(false); G.menu.set(false); setTimeout(() => f?.go?.(), 50); return; }
    if (b.dataset.tab) tab = b.dataset.tab;
    else if (b.dataset.a !== undefined) area = b.dataset.a;
    else if (b.dataset.f === 'todo') todo = !todo;
    else if (b.hasAttribute('data-deep') && G.perf) G.perf.deep = !G.perf.deep;
    else if (b.dataset.t) { const id = b.dataset.t; if (tested[id]) delete tested[id]; else tested[id] = 1; store.set('tested3d', tested); }
    const y = el.querySelector('.devbody3')?.scrollTop || 0;
    draw(); el.querySelector('.devbody3').scrollTop = y;
  });
  G.on?.('resume', () => show(false));
  M.button('play', { label: 'Feature list', sub: 'what was added, to test', group: 'dev', onClick: () => show(true) });
  // Copy debug link: this very moment as a link (where you are, which way you face, the time,
  // the date, the weather, the bird, the graphics), to paste to Claude, who opens it and sees the
  // same view; ?dbg=... puts you there a moment after the world has loaded
  const snap = () => {
    const b = G.b, W = G.systems?.weather;
    return { p: b.p.map(v => +v.toFixed(2)), yaw: +b.yaw.toFixed(3), gamma: +(b.gamma || 0).toFixed(3), state: b.state, tod: +G.tod.toFixed(4), day: G.day,
      wx: W?.spell, fog: +(G.fog || 0).toFixed(2), rain: +(G.rain || 0).toFixed(2), bird: BIRD, gfx: G.gfx && [G.gfx.preset, G.gfx.level], res: +(G.res || 1).toFixed(2),
      build: G.build, looks: Object.keys(G.R.look || {}).filter(k => G.R.look[k]), ua: navigator.userAgent.slice(0, 120) };
  };
  M.button('play', { label: 'Copy debug link', sub: 'this place, time and weather as a link, to paste to Claude with what looks wrong', group: 'dev', onClick: async el => {
    const u = new URL(location.href); u.search = ''; u.searchParams.set('dbg', btoa(JSON.stringify(snap()))); if (BIRD !== 'hawk') u.searchParams.set('bird', BIRD);
    try { await navigator.clipboard.writeText(u.href); el.firstChild.textContent = 'Copied: paste it to Claude '; } catch { prompt('Debug link', u.href); }
  } });
  const dq = new URLSearchParams(location.search).get('dbg');
  if (dq) try {
    const o = JSON.parse(atob(dq));
    setTimeout(() => {
      const b = G.b; b.p = o.p.slice(); b.yaw = o.yaw; b.gamma = o.gamma || 0; b.state = 'fly'; b.vy = 0;
      G.tod = o.tod; if (o.day) G.day = o.day; if (o.wx) G.systems?.weather?.set(o.wx, 300);
      if (o.fog > .2) G.fog = o.fog;
      console.log('[aloft dbg]', o);
    }, 2500);
  } catch (e) { console.log('[aloft dbg] bad link', e); }
  return D;
}
