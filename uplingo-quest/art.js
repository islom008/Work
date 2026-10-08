// UpLingo Quest · illustrations drawn as inline SVG (no image assets):
// icons, guild crests, banners, the world map, hero art, chest and medals.
(function () {
  'use strict';
  const h = React.createElement;

  // ---------------------------------------------------------------- icons (stroke, 24×24)
  const ICONS = {
    home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    map: ['M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z', 'M9 4v13.5', 'M15 6.5V20'],
    list: ['M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
    guild: ['M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z', 'M9 11.5l2 2 4-4'],
    user: ['M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M3.5 21c.8-4.2 4.2-6.5 8.5-6.5s7.7 2.3 8.5 6.5'],
    bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
    chevR: ['m9 18 6-6-6-6'], chevL: ['m15 18-6-6 6-6'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
    gear: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    book: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
    doc: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
    pencil: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
    mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
    headphones: ['M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3'],
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    check: ['M20 6 9 17l-5-5'],
    lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
    swords: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'm13 19 6-6', 'm16 16 4 4', 'm19 21 2-2', 'M9.5 6.5 14 2h3v3l-4.5 4.5', 'm5 14 4 4', 'm7 17-3 3', 'm3 19 2 2'],
    gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
    shop: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
    x: ['M18 6 6 18', 'm6 6 12 12'],
  };
  const FILLED = { star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z' };
  const Icon = ({ n, s = 22, w = 2, fill, style }) => {
    if (FILLED[n]) return h('svg', { width: s, height: s, viewBox: '0 0 24 24', style, 'aria-hidden': true }, h('path', { d: FILLED[n], fill: fill || 'currentColor' }));
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: fill || 'none', stroke: 'currentColor', strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round', style, 'aria-hidden': true },
      (ICONS[n] || []).map((d, i) => h('path', { key: i, d })));
  };

  // ---------------------------------------------------------------- crests & medals
  const TONES = {
    blue: ['#7CC0FF', '#2F80FF', '#0B3A9E'], red: ['#FF8A7A', '#E5383B', '#7E0D12'], gold: ['#FFE38A', '#F5B83D', '#9A5B05'],
    purple: ['#C4B1FF', '#8B5CF6', '#3D1D8F'], green: ['#86EFAC', '#22C55E', '#0F5B2C'], grey: ['#9AA4B5', '#5D6A86', '#2A3142'],
  };
  const EMBLEM = { lion: '🦁', dragon: '🐉', wolf: '🐺', eagle: '🦅', bear: '🐻' };
  let gid = 0;
  const SHIELD = 'M50 4 L93 17 V56 C93 86 73 104 50 116 C27 104 7 86 7 56 V17 Z';
  // A guild crest or an achievement medal: shield with metal rim and an emblem.
  const Crest = ({ tone = 'blue', icon, crest, size = 96, rim = 'silver', spikes = true }) => {
    const id = 'c' + (++gid);
    const [hi, mid, lo] = TONES[tone] || TONES.blue;
    const rimC = rim === 'gold' ? ['#FFF0B8', '#E2A93A', '#8C5A0B'] : ['#FFFFFF', '#B9C6DA', '#5C6B85'];
    const emoji = icon || EMBLEM[crest] || '★';
    return h('svg', { className: 'crest', width: size, height: size * 1.2, viewBox: '0 0 100 120', 'aria-hidden': true },
      h('defs', null,
        h('linearGradient', { id: id + 'r', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: rimC[0] }), h('stop', { offset: 0.5, stopColor: rimC[1] }), h('stop', { offset: 1, stopColor: rimC[2] })),
        h('radialGradient', { id: id + 'f', cx: 0.4, cy: 0.3, r: 0.85 }, h('stop', { offset: 0, stopColor: hi }), h('stop', { offset: 0.5, stopColor: mid }), h('stop', { offset: 1, stopColor: lo })),
        h('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 1, y2: 1 }, h('stop', { offset: 0, stopColor: '#fff', stopOpacity: 0.5 }), h('stop', { offset: 0.5, stopColor: '#fff', stopOpacity: 0 }))),
      spikes && h('g', { fill: 'url(#' + id + 'r)' },
        h('path', { d: 'M34 8 L38 -2 L42 7 Z' }), h('path', { d: 'M46 5 L50 -6 L54 5 Z' }), h('path', { d: 'M58 7 L62 -2 L66 8 Z' })),
      h('path', { d: SHIELD, fill: 'url(#' + id + 'r)' }),
      h('path', { d: SHIELD, fill: 'url(#' + id + 'f)', transform: 'translate(50 60) scale(0.84) translate(-50 -60)' }),
      h('path', { d: 'M50 16 L82 26 V40 C60 36 40 46 18 58 V26 Z', fill: 'url(#' + id + 'g)', opacity: 0.6 }),
      h('text', { x: 50, y: 74, textAnchor: 'middle', fontSize: 44, style: { filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.45))' } }, emoji));
  };

  // A hanging war banner with a crest (battle screen).
  const Banner = ({ tone, crest, w = 150 }) => {
    const id = 'b' + (++gid);
    const [hi, mid, lo] = TONES[tone];
    return h('svg', { width: w, height: w * 1.45, viewBox: '0 0 150 218', 'aria-hidden': true, style: { filter: 'drop-shadow(0 14px 20px rgba(0,0,0,0.55))' } },
      h('defs', null,
        h('linearGradient', { id: id + 'f', x1: 0, y1: 0, x2: 1, y2: 0 }, h('stop', { offset: 0, stopColor: lo }), h('stop', { offset: 0.45, stopColor: mid }), h('stop', { offset: 0.55, stopColor: mid }), h('stop', { offset: 1, stopColor: lo })),
        h('linearGradient', { id: id + 'p', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#FFE7A0' }), h('stop', { offset: 1, stopColor: '#9A5B05' }))),
      h('rect', { x: 2, y: 6, width: 146, height: 8, rx: 4, fill: 'url(#' + id + 'p)' }),
      h('circle', { cx: 4, cy: 10, r: 6, fill: '#F5B83D' }), h('circle', { cx: 146, cy: 10, r: 6, fill: '#F5B83D' }),
      h('path', { d: 'M12 14 H138 V186 L75 214 L12 186 Z', fill: 'url(#' + id + 'f)' }),
      h('path', { d: 'M20 14 V182 L75 206 L130 182 V14', fill: 'none', stroke: '#F5B83D', strokeWidth: 2.5, opacity: 0.85 }),
      h('path', { d: 'M12 30 H138', stroke: hi, strokeWidth: 1, opacity: 0.4 }),
      h('g', { transform: 'translate(29 44) scale(0.92)' }, h(CrestInner, { tone, crest })));
  };
  const CrestInner = ({ tone, crest }) => {
    const id = 'ci' + (++gid);
    const [hi, mid, lo] = TONES[tone];
    return h('g', null,
      h('defs', null,
        h('linearGradient', { id: id + 'r', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#fff' }), h('stop', { offset: 0.5, stopColor: '#B9C6DA' }), h('stop', { offset: 1, stopColor: '#5C6B85' })),
        h('radialGradient', { id: id + 'f', cx: 0.4, cy: 0.3, r: 0.85 }, h('stop', { offset: 0, stopColor: hi }), h('stop', { offset: 0.5, stopColor: mid }), h('stop', { offset: 1, stopColor: lo }))),
      h('path', { d: SHIELD, fill: 'url(#' + id + 'r)' }),
      h('path', { d: SHIELD, fill: 'url(#' + id + 'f)', transform: 'translate(50 60) scale(0.84) translate(-50 -60)' }),
      h('text', { x: 50, y: 74, textAnchor: 'middle', fontSize: 44 }, EMBLEM[crest]));
  };

  // ---------------------------------------------------------------- chest
  const Chest = ({ size = 56, open }) => h('svg', { width: size, height: size * 0.9, viewBox: '0 0 64 58', 'aria-hidden': true, style: { filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.45))' } },
    h('defs', null,
      h('linearGradient', { id: 'chw', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#C97A3A' }), h('stop', { offset: 1, stopColor: '#6E3412' })),
      h('linearGradient', { id: 'chg', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#FFE38A' }), h('stop', { offset: 1, stopColor: '#B9770F' }))),
    open && h('ellipse', { cx: 32, cy: 22, rx: 24, ry: 8, fill: '#FFD45A', opacity: 0.9 }),
    h('rect', { x: 4, y: 24, width: 56, height: 30, rx: 4, fill: 'url(#chw)' }),
    h('path', { d: open ? 'M4 22 L8 4 H56 L60 22 Z' : 'M4 26 V16 C4 7 14 3 32 3 C50 3 60 7 60 16 V26 Z', fill: 'url(#chw)', stroke: '#4A220A', strokeWidth: 1 }),
    h('rect', { x: 12, y: 3, width: 6, height: 51, fill: 'url(#chg)', opacity: 0.95 }),
    h('rect', { x: 46, y: 3, width: 6, height: 51, fill: 'url(#chg)', opacity: 0.95 }),
    h('rect', { x: 4, y: 23, width: 56, height: 5, fill: 'url(#chg)' }),
    h('rect', { x: 26, y: 20, width: 12, height: 15, rx: 2, fill: 'url(#chg)', stroke: '#8C5A0B', strokeWidth: 1 }),
    h('circle', { cx: 32, cy: 26, r: 2.2, fill: '#3A1D05' }), h('rect', { x: 31, y: 27, width: 2, height: 4, fill: '#3A1D05' }));

  // ---------------------------------------------------------------- homework hero art
  const Mountains = () => h('svg', { className: 'art', viewBox: '0 0 220 120', preserveAspectRatio: 'xMaxYMax slice', 'aria-hidden': true },
    h('defs', null,
      h('linearGradient', { id: 'mtA', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#B07A8E' }), h('stop', { offset: 1, stopColor: '#4B3466' })),
      h('linearGradient', { id: 'mtB', x1: 0, y1: 0, x2: 1, y2: 1 }, h('stop', { offset: 0, stopColor: '#E3A27A' }), h('stop', { offset: 0.55, stopColor: '#8A4E5E' }), h('stop', { offset: 1, stopColor: '#3A2648' })),
      h('linearGradient', { id: 'mtF', x1: 0, y1: 0, x2: 1, y2: 0 }, h('stop', { offset: 0, stopColor: '#1B2A55', stopOpacity: 0 }), h('stop', { offset: 0.35, stopColor: '#1B2A55', stopOpacity: 1 }))),
    h('circle', { cx: 160, cy: 40, r: 26, fill: '#FFB86B', opacity: 0.35 }),
    h('polygon', { points: '40,120 95,46 130,80 170,30 220,74 220,120', fill: 'url(#mtA)', opacity: 0.8 }),
    h('polygon', { points: '80,120 150,14 220,96 220,120', fill: 'url(#mtB)' }),
    h('polygon', { points: '150,14 136,36 146,32 152,40 160,30 166,34', fill: '#FFF4EC' }),
    h('polygon', { points: '150,14 166,34 172,32', fill: '#E8D5CF' }),
    h('path', { d: 'M60 120 C 100 96, 150 104, 220 92 V120 Z', fill: '#1E1A3A' }),
    [[118, 104], [130, 100], [196, 96], [208, 98], [184, 100]].map(([x, y], i) =>
      h('polygon', { key: i, points: `${x},${y - 14} ${x - 5},${y} ${x + 5},${y}`, fill: '#141230' })),
    h('rect', { x: 0, y: 0, width: 90, height: 120, fill: 'url(#mtF)' }));

  // ---------------------------------------------------------------- world map terrain
  const MAP_W = 390, MAP_H = 900;
  const LOCK_Y = 545;
  // Road from the castle (Unit 5 hub) down through lessons 1–5, then into locked land.
  const ROAD = [[40, -20], [62, 70], [112, 196], [160, 250], [205, 288], [172, 334], [200, 382], [246, 422], [286, 462], [290, 512], [240, 584], [172, 640], [150, 700], [205, 770], [252, 836], [240, 920]];
  const LESSON_PTS = [[205, 288], [172, 334], [200, 382], [246, 422], [286, 462]];
  const BOSS_PT = [290, 512];
  const LOCK_PTS = [[240, 584], [150, 700], [252, 836]];
  const RIVER = [[300, -20], [286, 80], [322, 170], [302, 262], [338, 352], [348, 440], [334, 530], [362, 640], [338, 760], [368, 920]];
  const smooth = (pts) => {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L ${l[0]} ${l[1]}`;
  };
  const densify = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
      for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    return out;
  };
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const TREES = (() => {
    const r = rng(11), road = densify(ROAD), river = densify(RIVER), out = [];
    const clear = [[112, 180, 62], [250, 690, 62], [300, 215, 0]];
    for (let i = 0; i < 420 && out.length < 230; i++) {
      const x = r() * MAP_W, y = r() * MAP_H;
      if (road.some(([a, b]) => Math.hypot(a - x, b - y) < 24)) continue;
      if (river.some(([a, b]) => Math.hypot(a - x, b - y) < 22)) continue;
      if (clear.some(([a, b, rad]) => Math.hypot(a - x, b - y) < rad)) continue;
      if (out.some((t) => Math.hypot(t.x - x, t.y - y) < 13)) continue;
      out.push({ x, y, s: 0.8 + r() * 0.6, pine: r() < 0.6 });
    }
    return out.sort((a, b) => a.y - b.y);
  })();

  const Tree = ({ t }) => {
    const dead = t.y > LOCK_Y;
    const dark = dead ? '#2B3A36' : '#17452A', mid = dead ? '#3A4A45' : '#23603A', lit = dead ? '#4A5953' : '#3C8A4A';
    const { x, y, s } = t;
    if (t.pine) {
      return h('g', { transform: `translate(${x} ${y}) scale(${s})` },
        h('ellipse', { cx: 2, cy: 1, rx: 9, ry: 3, fill: '#000', opacity: 0.25 }),
        h('rect', { x: -1.5, y: -4, width: 3, height: 5, fill: '#4A3220' }),
        h('polygon', { points: '0,-26 -10,-4 10,-4', fill: dark }),
        h('polygon', { points: '0,-26 0,-4 10,-4', fill: mid }),
        h('polygon', { points: '0,-32 -7,-15 7,-15', fill: mid }),
        h('polygon', { points: '0,-32 -7,-15 -1,-15', fill: lit }));
    }
    return h('g', { transform: `translate(${x} ${y}) scale(${s})` },
      h('ellipse', { cx: 2, cy: 1, rx: 9, ry: 3, fill: '#000', opacity: 0.25 }),
      h('rect', { x: -1.5, y: -6, width: 3, height: 7, fill: '#4A3220' }),
      h('circle', { cx: 0, cy: -13, r: 9, fill: dark }),
      h('circle', { cx: -2.5, cy: -15.5, r: 5.5, fill: mid }),
      h('circle', { cx: -4, cy: -17, r: 2.5, fill: lit }));
  };

  const Castle = ({ x, y, dark }) => {
    const wall = dark ? '#2A3140' : '#E6D8BC', wallS = dark ? '#1B202B' : '#B9A783', roof = dark ? '#1B202B' : '#2F64D8', roofL = dark ? '#262C39' : '#5A8DFF';
    const tower = (tx, ty, w, hh) => h('g', null,
      h('rect', { x: tx, y: ty, width: w, height: hh, fill: wall, stroke: wallS, strokeWidth: 1 }),
      h('rect', { x: tx + w / 2 - 2, y: ty + 10, width: 4, height: 7, rx: 2, fill: dark ? '#4B1D1D' : '#3A2A1A' }),
      h('polygon', { points: `${tx - 3},${ty} ${tx + w / 2},${ty - w * 1.1} ${tx + w + 3},${ty}`, fill: roof }),
      h('polygon', { points: `${tx + w / 2},${ty - w * 1.1} ${tx + w + 3},${ty} ${tx + w / 2},${ty}`, fill: roofL, opacity: 0.6 }));
    return h('g', { transform: `translate(${x - 55} ${y - 70})` },
      h('ellipse', { cx: 55, cy: 92, rx: 56, ry: 10, fill: '#000', opacity: 0.35 }),
      h('rect', { x: 14, y: 52, width: 82, height: 38, fill: wall, stroke: wallS, strokeWidth: 1 }),
      Array.from({ length: 9 }, (_, i) => h('rect', { key: i, x: 15 + i * 9, y: 47, width: 6, height: 6, fill: wall, stroke: wallS, strokeWidth: 0.8 })),
      h('path', { d: 'M46 90 V74 a9 9 0 0 1 18 0 V90 Z', fill: dark ? '#120E14' : '#4A3220' }),
      tower(4, 40, 18, 50), tower(88, 40, 18, 50), tower(44, 18, 22, 40),
      !dark && h('g', null,
        h('line', { x1: 55, y1: -6, x2: 55, y2: -26, stroke: '#8B7B5E', strokeWidth: 1.5 }),
        h('path', { d: 'M55 -26 L74 -21 L55 -15 Z', fill: '#2F80FF', stroke: '#F5B83D', strokeWidth: 1 })),
      dark && h('g', null, [[12, 62], [96, 62], [53, 30]].map(([wx, wy], i) => h('rect', { key: i, x: wx, y: wy, width: 3, height: 5, fill: '#FF4D4D', opacity: 0.7 }))));
  };

  const Coin = ({ x, y, state }) => {
    const c = state === 'done' ? ['#FFE38A', '#E0A42B', '#8C5A0B'] : state === 'current' ? ['#FFF1B8', '#F5B83D', '#A86A08'] : ['#E9DDB8', '#BFAE7E', '#6E6247'];
    return h('g', null,
      h('ellipse', { cx: x, cy: y + 4, rx: 15, ry: 9, fill: '#000', opacity: 0.3 }),
      h('ellipse', { cx: x, cy: y + 2, rx: 15, ry: 9.5, fill: c[2] }),
      h('ellipse', { cx: x, cy: y, rx: 15, ry: 9.5, fill: c[1] }),
      h('ellipse', { cx: x, cy: y - 1, rx: 10, ry: 5.5, fill: c[0], opacity: 0.7 }),
      state === 'current' && h('ellipse', { cx: x, cy: y, rx: 21, ry: 13.5, fill: 'none', stroke: '#FFD978', strokeWidth: 2, opacity: 0.8 }, h('animate', { attributeName: 'opacity', values: '0.9;0.2;0.9', dur: '1.8s', repeatCount: 'indefinite' })));
  };

  // `states[i]` is 'done' | 'current' | 'todo' for each lesson point.
  const WorldTerrain = ({ states, bossAlive }) => {
    const fogTop = LOCK_Y - 30;
    return h('svg', { className: 'terrain', viewBox: `0 0 ${MAP_W} ${MAP_H}`, 'aria-hidden': true },
      h('defs', null,
        h('linearGradient', { id: 'grass', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#4E8A3E' }), h('stop', { offset: 0.55, stopColor: '#3D7436' }), h('stop', { offset: 0.62, stopColor: '#3A4A44' }), h('stop', { offset: 1, stopColor: '#262E30' })),
        h('radialGradient', { id: 'meadow', cx: 0.5, cy: 0.5, r: 0.5 }, h('stop', { offset: 0, stopColor: '#8CC063', stopOpacity: 0.55 }), h('stop', { offset: 1, stopColor: '#8CC063', stopOpacity: 0 })),
        h('linearGradient', { id: 'fog', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#0B1220', stopOpacity: 0 }), h('stop', { offset: 0.18, stopColor: '#0B1220', stopOpacity: 0.55 }), h('stop', { offset: 1, stopColor: '#0B1220', stopOpacity: 0.78 })),
        h('linearGradient', { id: 'riv', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#3B9BE8' }), h('stop', { offset: 0.6, stopColor: '#2B7CC4' }), h('stop', { offset: 1, stopColor: '#3E5A6E' }))),
      h('rect', { width: MAP_W, height: MAP_H, fill: 'url(#grass)' }),
      [[90, 120, 90], [240, 260, 110], [120, 420, 100], [60, 300, 70], [260, 120, 80]].map(([cx, cy, r], i) => h('circle', { key: i, cx, cy, r, fill: 'url(#meadow)' })),
      // River with banks and shimmer.
      h('path', { d: smooth(RIVER), fill: 'none', stroke: '#6E5A3A', strokeWidth: 32, strokeLinecap: 'round', opacity: 0.5 }),
      h('path', { d: smooth(RIVER), fill: 'none', stroke: 'url(#riv)', strokeWidth: 24, strokeLinecap: 'round' }),
      h('path', { d: smooth(RIVER), fill: 'none', stroke: '#8FD0FF', strokeWidth: 2, strokeDasharray: '6 18', strokeLinecap: 'round', opacity: 0.7 },
        h('animate', { attributeName: 'stroke-dashoffset', from: 0, to: -48, dur: '3s', repeatCount: 'indefinite' })),
      // Road.
      h('path', { d: smooth(ROAD), fill: 'none', stroke: '#6B4E25', strokeWidth: 17, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.85 }),
      h('path', { d: smooth(ROAD), fill: 'none', stroke: '#D7B46A', strokeWidth: 12, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('path', { d: smooth(ROAD), fill: 'none', stroke: '#F1D893', strokeWidth: 2, strokeDasharray: '2 9', strokeLinecap: 'round', opacity: 0.9 }),
      TREES.map((t, i) => h(Tree, { key: i, t })),
      h(Castle, { x: 112, y: 196 }),
      h('rect', { x: 0, y: fogTop, width: MAP_W, height: MAP_H - fogTop, fill: 'url(#fog)' }),
      h(Castle, { x: 252, y: 700, dark: true }),
      LESSON_PTS.map(([x, y], i) => h(Coin, { key: i, x, y, state: states[i] })),
      bossAlive && h('circle', { cx: BOSS_PT[0], cy: BOSS_PT[1], r: 22, fill: '#8B5CF6', opacity: 0.35 },
        h('animate', { attributeName: 'r', values: '20;26;20', dur: '2.2s', repeatCount: 'indefinite' })));
  };

  window.Art = { Icon, Crest, Banner, Chest, Mountains, WorldTerrain, MAP_W, MAP_H, LESSON_PTS, BOSS_PT, LOCK_PTS, TONES };
})();
