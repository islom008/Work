// UpLingo Quest · UI. Plain React (no JSX / no build step), like UpLingo.
(function () {
  'use strict';
  const { useState, useEffect, useMemo, useRef } = React;
  const h = React.createElement;
  const G = window.Game;
  const { Icon, Crest, Banner, Chest, Mountains, WorldTerrain, Emo, isAsset } = window.Art;

  // The hosted student prototype sets window.UQ_STUDENT_ONLY: it hides the teacher view and
  // simulates the teacher checking homework a few seconds after each attack.
  const STUDENT_ONLY = !!window.UQ_STUDENT_ONLY;

  // ---------------------------------------------------------------- storage
  const STORE = 'uplingo-quest-v6';
  const loadState = () => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      // A battle that ended while the demo was closed starts a fresh demo week.
      if (s && s.version === 6 && Date.now() < s.battle.endsAt) return s;
    } catch (e) { /* storage blocked: fall through to a fresh seed */ }
    return G.seed();
  };
  const saveState = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  const loadPref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const savePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  // ---------------------------------------------------------------- helpers
  const cx = (...a) => a.filter(Boolean).join(' ');
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / b) * 100)));
  const fmtLeft = (ms) => {
    const abs = Math.max(0, ms);
    const d = Math.floor(abs / 86400000), hh = Math.floor((abs % 86400000) / 3600000), m = Math.floor((abs % 3600000) / 60000);
    if (d >= 2) return d + ' days';
    if (d === 1) return '1 day ' + hh + 'h';
    if (hh >= 1) return hh + 'h ' + m + 'm';
    return m + 'm';
  };
  const ago = (t, now) => {
    const ms = now - t;
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
    return Math.floor(ms / 86400000) + 'd ago';
  };
  const TYPE_ICON = { vocab: 'book', grammar: 'doc', writing: 'pencil', speaking: 'mic', listening: 'headphones', reading: 'eye' };
  const TYPE_NAME = { vocab: 'vocabulary', grammar: 'grammar', writing: 'writing', speaking: 'speaking', listening: 'listening', reading: 'reading' };
  const SEG_CLS = { 'Full': 'on-full', '75%': 'on-most', '50%': 'on-half', 'Not full': 'on-notfull' };
  const isMarked = (st) => st && st !== 'Not started' && st !== 'Not full';
  const unitName = (s, n) => ((s.units.find((u) => u.unit === n) || {}).name) || 'Unit ' + n;

  // Everything screens derive from state, computed once per render.
  const derive = (s, now) => {
    const { myGuild, battle, feed, homeworks, bosses, me } = s;
    const enemy = battle.enemy;
    const attackers = myGuild.members.filter((m) => m.week > 0).length;
    const myShield = G.shieldPct(attackers, myGuild.members.length, (me.charmUsed ? 0.05 : 0) + (battle.shieldBonus || 0));
    const enemyShield = G.shieldPct(enemy.attackers.length, enemy.members.length);
    const landed = (side) => feed.filter((f) => f.side === side && !f.pending).reduce((a, f) => a + f.dmg, 0);
    const usHP = Math.max(0, G.FORTRESS_HP - battle.base.enemy - landed('enemy'));
    const enemyHP = Math.max(0, G.FORTRESS_HP - battle.base.us - landed('us'));
    const pendingOnEnemy = feed.filter((f) => f.side === 'us' && f.pending).reduce((a, f) => a + f.dmg, 0);
    const notAttacked = myGuild.members.length - attackers;
    // Battle damage is a share of each side's weekly potential (see game.js).
    const myMax = G.weeklyMax(myGuild.members.length, battle.perStudent);
    const enemyMax = G.weeklyMax(enemy.members.length, enemy.perStudent);
    const liveBoss = bosses.filter((b) => !b.defeated).sort((a, b) => a.unit - b.unit)[0] || null;
    const currentUnit = liveBoss ? liveBoss.unit : Infinity;
    const locked = (hw) => hw.unit > currentUnit;
    const unitHws = homeworks.filter((hw) => hw.unit === Math.min(currentUnit, 99));
    const nextHw = homeworks.find((hw) => !me.submitted[hw.id] && !locked(hw)) || null;
    const lessonIdx = nextHw ? unitHws.indexOf(nextHw) : unitHws.length;
    const cur = nextHw ? (me.tasks[nextHw.id] || []) : [];
    const curFrac = nextHw ? cur.filter(isMarked).length / nextHw.tasks.length : 0;
    const doneInUnit = unitHws.filter((hw) => me.submitted[hw.id]).length;
    const unitPct = unitHws.length ? pct(doneInUnit + curFrac, unitHws.length) : 100;
    const unit = s.units.find((u) => u.unit === currentUnit) || s.units[s.units.length - 1];
    return {
      enemy, myMax, enemyMax, attackers, myShield, enemyShield, usHP, enemyHP, pendingOnEnemy, notAttacked, liveBoss, currentUnit, locked,
      unitHws, nextHw, lessonIdx, doneInUnit, unitPct, unit, lvl: G.levelProgress(me.xp), rank: G.rankFor(me.seasonPts),
      pendingQueue: s.submissions.filter((x) => x.state === 'pending'), battleLeft: battle.endsAt - now,
      unitsDone: s.units.filter((u) => u.unit < currentUnit).length,
    };
  };

  // ---------------------------------------------------------------- small UI
  const Face = ({ face, size = 36, ring }) => h('div', { className: 'av', style: { width: size, height: size, fontSize: size * 0.66, boxShadow: ring ? '0 0 0 2px ' + ring : null } },
    isAsset(face) ? h(Emo, { v: face, size: Math.round(size * 0.86), style: { marginTop: size * 0.12 } }) : face);
  const MeAvatar = ({ s, size = 40, crown }) => {
    const av = s.shop.find((x) => x.id === s.me.avatar);
    const fr = s.shop.find((x) => x.id === s.me.frame);
    return h('div', { className: 'av-ring', style: { background: fr ? fr.css : 'var(--accent)' } },
      h(Face, { face: av ? av.icon : 'face_man_curly_hair_light', size }),
      crown && h('span', { className: 'crown' }, h(Emo, { v: 'crown', size: Math.max(22, size * 0.3) })));
  };
  const Badge = ({ k, children }) => h('span', { className: cx('badge', k) }, children);
  const Bar = ({ value, max, color = 'var(--green)', style }) => h('div', { className: 'bar', style }, h('i', { style: { width: pct(value, max) + '%', background: color } }));
  const VsBar = ({ us, them, thick }) => h('div', { className: cx('vsbar', thick && 'thick') }, h('i', { style: { width: pct(us, us + them) + '%' } }), h('b'));
  const Sheet = ({ onClose, children }) => {
    useEffect(() => {
      const k = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return h('div', { className: 'scrim', onClick: onClose },
      h('div', { className: 'sheet', role: 'dialog', 'aria-modal': true, onClick: (e) => e.stopPropagation() }, h('div', { className: 'grab' }), children));
  };
  const Topbar = ({ title, left, right }) => h('header', { className: 'topbar' },
    h('div', { style: { minWidth: 36 } }, left), h('div', { className: 'title' }, title), h('div', { style: { minWidth: 36, display: 'flex', justifyContent: 'flex-end' } }, right));
  const SectionHead = ({ title, right }) => h('div', { className: 'row', style: { marginTop: 4 } }, h('div', { className: 'h2 grow' }, title), right);

  // Weekly battle summary card (Home + Guild).
  const BattleCard = ({ s, d, onView, compact }) => h('div', { className: 'battle-card' },
    !compact && h('div', { style: { fontWeight: 800, fontSize: 19, letterSpacing: 0.5 } }, 'WEEKLY BATTLE'),
    !compact && h('div', { style: { marginTop: 2, color: '#E6E9F2' } }, fmtLeft(d.battleLeft) + ' left'),
    compact && h('div', { className: 'row', style: { marginBottom: 4 } }, h('div', { className: 'grow', style: { fontWeight: 800, fontSize: 17, textAlign: 'left' } }, 'Weekly Battle'), h('span', { style: { color: 'var(--gold)', fontWeight: 600 } }, fmtLeft(d.battleLeft) + ' left')),
    h('div', { className: 'row', style: { alignItems: 'flex-end', margin: '10px 0 12px' } },
      h('div', { className: 'side' }, h('div', { className: 'float' }, h(Crest, { tone: 'green', crest: s.myGuild.crest, size: compact ? 60 : 80 })),
        h('div', { className: 'n' }, s.myGuild.name), h('div', { className: 'hp' }, fmt(d.usHP), h('small', null, 'HP'))),
      h('div', { className: 'vs', style: { paddingBottom: compact ? 30 : 46 } }, 'VS'),
      h('div', { className: 'side' }, h('div', { className: 'float', style: { animationDelay: '1.2s' } }, h(Crest, { tone: 'red', crest: d.enemy.crest, size: compact ? 60 : 80 })),
        h('div', { className: 'n' }, d.enemy.name), h('div', { className: 'hp' }, fmt(d.enemyHP), h('small', null, 'HP')))),
    h(VsBar, { us: d.usHP, them: d.enemyHP }),
    h('button', { className: 'btn gold block', style: { marginTop: 14 }, onClick: onView }, 'View Battle'));

  // A homework task row with its state on the right.
  const TaskRow = ({ task, status, audio, onClick, iconStyle = 'type' }) => {
    const full = status === 'Full';
    const part = isMarked(status) && !full;
    let lead;
    if (iconStyle === 'check') {
      lead = task.type === 'speaking' && !isMarked(status)
        ? h('div', { className: 'ico', style: { width: 26, color: 'var(--gold)' } }, h(Icon, { n: 'mic', s: 22 }))
        : h('div', { className: cx('ck', full ? 'on' : part ? 'part' : 'off') }, full ? h(Icon, { n: 'check', s: 16, w: 3 }) : part ? status : null);
    } else lead = h('div', { className: 'ico' }, h(Icon, { n: TYPE_ICON[task.type], s: 26, w: 1.8 }));
    const trail = iconStyle === 'type' && full
      ? h('div', { className: 'ck on' }, h(Icon, { n: 'check', s: 16, w: 3 }))
      : iconStyle === 'type' && part ? h(Badge, { k: 'b-gold' }, status)
        : h('span', { className: 'muted' }, h(Icon, { n: 'chevR', s: 20 }));
    return h('button', { className: 'item', onClick },
      lead,
      h('div', { className: 'grow' },
        h('div', { className: 't' }, task.label),
        h('div', { className: 's' }, h('span', { className: 'dmg' }, '+' + G.DAMAGE[task.type] + ' damage'),
          task.type === 'speaking' && audio ? ' · 🎧 ' + audio : '')),
      trail);
  };

  // ---------------------------------------------------------------- Heroes
  const SKILL_ICON = { vocab: 'book', grammar: 'doc', listening: 'headphones', reading: 'eye', speaking: 'mic', writing: 'pencil' };
  const SKILL_NAME = { vocab: 'Vocabulary', grammar: 'Grammar', listening: 'Listening', reading: 'Reading', speaking: 'Speaking', writing: 'Writing' };
  const heroOf = (s) => G.HEROES.find((x) => x.key === (s.me.hero || {}).cls) || G.HEROES[1];
  const heroSrc = (cls, g) => 'assets/heroes/' + cls + '_' + g + '.webp';
  // Character art; falls back to the 3D portrait if the image can't load.
  const HeroImg = ({ cls, g, height, style, fallback }) => {
    const [bad, setBad] = useState(false);
    if (bad) return h(Face, { face: fallback || 'face_man_curly_hair_light', size: Math.round(height * 0.6) });
    return h('img', { src: heroSrc(cls, g), alt: '', height, draggable: false, onError: () => setBad(true),
      style: { height, width: 'auto', display: 'block', filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))', ...style } });
  };
  const power = (s) => Object.values(s.me.skills || {}).reduce((a, v) => a + v, 0) * 10;
  const has3D = () => !!(window.Heroes3D && window.Heroes3D.available());
  // Still picture of a code-built hero (falls back to the image files without WebGL).
  const HeroPortrait = ({ hero, height }) => {
    if (!has3D()) return h(HeroImg, { cls: hero.cls, g: hero.g, height });
    let src = null;
    try { src = window.Heroes3D.portrait(hero, 256); } catch (e) { return h(HeroImg, { cls: hero.cls, g: hero.g, height }); }
    return h('img', { src, alt: '', height, draggable: false, style: { height, width: 'auto', display: 'block', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))' } });
  };
  // Live 3D hero on the lobby pedestal: idles, breathes, drag to turn.
  const HeroStage = ({ hero }) => {
    const ref = useRef(null);
    const stage = useRef(null);
    useEffect(() => {
      if (!has3D()) return undefined;
      stage.current = window.Heroes3D.mountStage(ref.current, hero);
      return () => stage.current && stage.current.destroy();
    }, []);
    useEffect(() => { if (stage.current) stage.current.set(hero); }, [hero.cls, hero.g, hero.skin]);
    if (!has3D()) return h('div', { className: 'hero-bob' }, h(HeroImg, { cls: hero.cls, g: hero.g, height: 230 }));
    return h('div', { ref, className: 'hero-3d', 'aria-label': 'Your hero. Drag to turn.', role: 'img' });
  };
  const abilityReady = (s) => s.me.abilityUsed !== s.battle.startedAt;

  // ---------------------------------------------------------------- Home (game lobby)
  const HomeScreen = ({ s, d, openTask, openBattle, openNotifs, notifCount, openHero, go, useAbility }) => {
    const hw = d.nextHw;
    const sts = hw ? (s.me.tasks[hw.id] || hw.tasks.map(() => 'Not started')) : [];
    const done = sts.filter(isMarked).length;
    const hero = heroOf(s);
    const skills = s.me.skills || {};
    const top = Math.max(60, ...Object.values(skills));
    return h('div', null,
      h('header', { className: 'topbar hud' },
        h('button', { className: 'hud-lvl', onClick: () => go('profile'), 'aria-label': 'Profile' },
          h('span', { className: 'lv' }, d.lvl.lvl),
          h('span', { className: 'grow' }, h('b', null, s.me.name), h('span', { className: 'bar', style: { height: 5, marginTop: 4 } }, h('i', { style: { width: Math.round(d.lvl.pct * 100) + '%', background: 'var(--accent)' } })))),
        h('span', { className: 'grow' }),
        h('span', { className: 'hud-chip' }, h(Emo, { v: 'coin', size: 18 }), fmt(s.me.coins)),
        h('button', { className: 'icon-btn', onClick: openNotifs, 'aria-label': 'Notifications' }, h(Icon, { n: 'bell' }), notifCount > 0 && h('span', { className: 'dot' }))),
      h('section', { className: 'stage' },
        h('div', { className: 'stage-floor' }),
        h('div', { className: 'stage-top' },
          h('div', null, h('div', { className: 'eyebrow', style: { color: 'var(--accent)' } }, hero.role + ' class'), h('div', { className: 'display', style: { fontSize: 26 } }, hero.name)),
          h('div', { style: { textAlign: 'right' } }, h('div', { className: 'eyebrow' }, 'Power'), h('div', { className: 'display num', style: { fontSize: 26, color: 'var(--accent)' } }, fmt(power(s))))),
        h('div', { className: 'hero-wrap' },
          h('div', { className: 'pedestal' }, h('i'), h('b')),
          h(HeroStage, { hero: s.me.hero })),
        h('div', { className: 'stage-bottom' },
          h('span', { className: 'badge', style: { background: 'rgba(255,255,255,0.06)', color: d.rank.color } }, d.rank.icon + ' ' + d.rank.name),
          h('span', { className: 'badge b-green' }, hero.type),
          h('span', { className: 'badge b-gold' }, '🔥 ' + s.me.streak + ' days'),
          h('button', { className: 'btn ghost sm', onClick: openHero }, 'Change hero'))),
      h('div', { className: 'page', style: { paddingTop: 10 } },
        h('div', { className: 'card battle-strip' },
          h('div', { className: 'row' },
            h(Crest, { tone: 'green', crest: s.myGuild.crest, size: 40, spikes: false }),
            h('div', { className: 'grow' },
              h('div', { className: 'row tiny', style: { justifyContent: 'space-between', fontWeight: 700 } }, h('span', null, fmt(d.usHP) + ' HP'), h('span', { className: 'muted' }, fmtLeft(d.battleLeft) + ' left'), h('span', null, fmt(d.enemyHP) + ' HP')),
              h('div', { style: { marginTop: 6 } }, h(VsBar, { us: d.usHP, them: d.enemyHP }))),
            h(Crest, { tone: 'red', crest: d.enemy.crest, size: 40, spikes: false })),
          h('button', { className: 'btn gold block battle-btn', style: { marginTop: 12 }, onClick: openBattle }, h(Icon, { n: 'swords', s: 20 }), 'BATTLE')),
        h('div', { className: 'card ability-card' },
          h('div', { className: 'row' },
            h('div', { className: 'ability-ico' }, h(Icon, { n: 'star', s: 22, fill: 'currentColor' })),
            h('div', { className: 'grow' },
              h('div', { className: 'eyebrow', style: { color: 'var(--accent)' } }, 'Ability · once per battle'),
              h('div', { style: { fontWeight: 800, fontSize: 15 } }, hero.ability.name),
              h('div', { className: 'tiny muted', style: { marginTop: 2 } }, hero.ability.text)),
            h('button', { className: 'btn gold sm', disabled: !abilityReady(s), onClick: useAbility }, abilityReady(s) ? 'Use' : 'Used')),
          h('div', { className: 'tiny', style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', color: 'var(--text-2)' } },
            h('b', { style: { color: 'var(--text)' } }, 'Passive: '), hero.passive)),
        h('div', { className: 'card' },
          h('div', { className: 'row', style: { marginBottom: 10 } }, h('div', { className: 'h2 grow' }, 'Skills'), h('span', { className: 'tiny muted' }, 'Grow them with approved homework')),
          h('div', { style: { display: 'grid', gap: 9 } }, Object.keys(SKILL_NAME).map((k) => h('div', { key: k, className: 'row', style: { gap: 10 } },
            h('span', { style: { color: k === hero.skill ? 'var(--accent)' : 'var(--text-2)', width: 22, display: 'grid', placeItems: 'center' } }, h(Icon, { n: SKILL_ICON[k], s: 18 })),
            h('span', { style: { width: 86, fontSize: 13, fontWeight: k === hero.skill ? 700 : 500 } }, SKILL_NAME[k] + (k === hero.skill ? ' ★' : '')),
            h('div', { className: 'grow' }, h(Bar, { value: skills[k] || 0, max: top, color: k === hero.skill ? 'linear-gradient(90deg,#1fae5b,#5cffa3)' : 'linear-gradient(90deg,#2d5c44,#3f8a63)' })),
            h('span', { className: 'num', style: { width: 26, textAlign: 'right', fontSize: 13 } }, skills[k] || 0))))),
        h(SectionHead, { title: 'Today\'s quests', right: hw && h('span', { className: 'muted' }, done + '/' + hw.tasks.length) }),
        hw
          ? h('div', { className: 'list' },
            hw.tasks.map((t, i) => h(TaskRow, { key: i, task: t, status: sts[i], audio: (s.me.audio[hw.id] || {})[i], iconStyle: 'check', onClick: () => openTask(hw.id, i) })))
          : h('div', { className: 'card muted', style: { textAlign: 'center' } }, 'All homework is in. Nice work! 🎉'),
        hw && h('div', { className: 'tiny muted' }, hw.label + ' · ' + hw.title + ' · Unit ' + hw.unit + ' ' + unitName(s, hw.unit))));
  };

  const SKIN_SWATCH = { light: '#f1c6a0', medium: '#d39a6a', tan: '#a8703f' };
  const HeroSheet = ({ s, onClose, setHero }) => {
    const [g, setG] = useState(s.me.hero.g);
    const [skin, setSkin] = useState(s.me.hero.skin || 'light');
    const [pick, setPick] = useState(s.me.hero.cls);
    const sel = G.HEROES.find((x) => x.key === pick);
    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 10 } }, h('div', { className: 'h1 grow' }, 'Choose your hero'),
        h('div', { className: 'pill-tabs' }, [['m', 'Boy'], ['f', 'Girl']].map(([k, l]) => h('button', { key: k, className: g === k ? 'on' : '', onClick: () => setG(k) }, l)))),
      h('div', { className: 'row', style: { marginBottom: 12, gap: 8 } },
        h('span', { className: 'tiny muted' }, 'Skin'),
        Object.keys(SKIN_SWATCH).map((k) => h('button', { key: k, 'aria-label': 'Skin ' + k, onClick: () => setSkin(k),
          style: { width: 26, height: 26, borderRadius: '50%', background: SKIN_SWATCH[k], boxShadow: skin === k ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : 'none' } }))),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 } }, G.HEROES.map((x) =>
        h('button', { key: x.key + g + skin, className: cx('hero-card', pick === x.key && 'on'), onClick: () => setPick(x.key) },
          h('div', { className: 'hero-card-art' }, h(HeroPortrait, { hero: { cls: x.key, g, skin }, height: 112 })),
          h('div', { style: { fontWeight: 700, fontSize: 13 } }, x.name),
          h('div', { className: 'tiny', style: { color: 'var(--accent)' } }, x.role + ' · ' + x.type)))),
      sel && h('div', { className: 'card', style: { marginTop: 12 } },
        h('div', { className: 'row' }, h('div', { className: 'h2 grow' }, sel.name), h(Badge, { k: 'b-green' }, sel.type)),
        h('div', { className: 'tiny', style: { marginTop: 8, lineHeight: 1.5 } }, h('b', null, 'Passive: '), sel.passive),
        h('div', { className: 'tiny', style: { marginTop: 4, lineHeight: 1.5 } }, h('b', null, 'Ability (once per battle): ' + sel.ability.name + '. '), sel.ability.text),
        h('button', { className: 'btn gold block', style: { marginTop: 12 }, onClick: () => { setHero({ cls: sel.key, g, skin }); onClose(); } }, 'Play as ' + sel.name)),
      h('div', { className: 'tiny muted', style: { marginTop: 10, lineHeight: 1.5 } }, 'Every student can choose any hero. All bonuses still count toward the battle cap, so no class can win a battle alone.'));
  };

  // ---------------------------------------------------------------- Map (3D islands)
  const themeFor = (name) => {
    const t = (name || '').toLowerCase();
    if (/custom|culture|bazaar|market|shop|consum|money|city/.test(t)) return 'bazaar';
    if (/holiday|tour|travel|journey|beach|leisure/.test(t)) return 'beach';
    if (/health|body|sport|adventure|planet|nature|science|camp/.test(t)) return 'camp';
    return 'park';
  };
  const MapScreen = (props) => {
    const { s, d, openHw, goHomework, openLocked, openRaid, openInfo } = props;
    const ref = useRef(null);
    const [lay, setLay] = useState(null);
    if (!window.World3D || !window.World3D.available()) return h(MapScreen2D, props);
    const cu = d.currentUnit;
    const units = [cu - 2, cu - 1, cu, cu + 1].filter((u) => u >= 1 && u <= s.course.units);
    const specs = units.map((u) => {
      const name = unitName(s, u);
      let stops;
      if (u === cu) {
        stops = d.unitHws.slice(0, 5).map((hw) => ({ key: 'hw-' + hw.id, state: s.me.submitted[hw.id] ? 'done' : d.nextHw && d.nextHw.id === hw.id ? 'current' : 'todo' }));
        stops.push({ key: 'boss', state: d.liveBoss ? 'boss' : 'done' });
      } else stops = [0, 1, 2, 3, 4].map((k) => ({ key: 'u' + u + '-' + k, state: u < cu ? 'done' : 'todo' }));
      return { unit: u, name, theme: themeFor(name), locked: u > cu, stops, size: u === cu ? 7 : 5 };
    });
    const sig = JSON.stringify(specs);
    useEffect(() => {
      const w = window.World3D.build(ref.current, { islands: specs, onLayout: (pos) => setLay(pos) });
      return () => w.destroy();
    }, [sig]);
    const mates = s.myGuild.members.filter((m) => !m.me);
    const hero = heroOf(s);
    const P = (key) => (lay && lay[key]) || null;
    const pos = (p, dx = 0, dy = 0) => ({ left: p.x + dx, top: p.y + dy });
    return h('div', null,
      h('div', { className: 'map-head' },
        h('div', { style: { width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0f3b25,#1fae5b)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.4)' } }, h(Emo, { v: 'map', size: 34 })),
        h('div', { className: 'grow' }, h('div', { className: 'h1' }, 'World Map'), h('div', { className: 'muted tiny' }, s.course.name + ' · ' + d.unitsDone + '/' + s.course.units + ' units')),
        h('button', { className: 'icon-btn', onClick: openInfo, 'aria-label': 'About the map' }, h(Icon, { n: 'info' }))),
      h('div', { className: 'world' },
        h('div', { ref, className: 'world-canvas' }),
        lay && h('div', { className: 'world-ov' },
          specs.map((sp) => {
            const p = P('island-' + sp.unit); if (!p) return null;
            const current = sp.unit === cu;
            return h('button', { key: 'i' + sp.unit, className: cx('isle-tag', current && 'cur', sp.locked && 'lock'), style: pos(p, 0, -6),
              onClick: sp.locked ? openLocked : current ? goHomework : undefined },
              sp.locked ? h(Emo, { v: 'lock', size: 16 }) : !current ? h(Icon, { n: 'check', s: 14, w: 3 }) : null,
              h('span', null, 'Unit ' + sp.unit + ' · ' + sp.name));
          }),
          d.unitHws.slice(0, 5).map((hw, i) => {
            const p = P('hw-' + hw.id); if (!p) return null;
            const here = mates.filter((m) => m.lesson - 1 === i);
            const mine = d.nextHw && d.nextHw.id === hw.id;
            return h(React.Fragment, { key: hw.id },
              h('button', { className: 'stop-hit', style: pos(p), onClick: () => openHw(hw.id), 'aria-label': 'Class ' + hw.label + ': ' + hw.title }),
              h('span', { className: cx('stop-label', mine && 'cur'), style: pos(p, i % 2 ? 44 : -44, 0) }, hw.label),
              !mine && here.length > 0 && h('div', { className: 'mate-pin', style: pos(p, 0, -6) }, h(Face, { face: here[0].face, size: 28 }),
                here.length > 1 && h('span', { className: 'badge b-green', style: { position: 'absolute', top: -8, right: -14 } }, '+' + (here.length - 1))),
              mine && h('div', { className: 'me-pin', style: pos(p, 0, 4) }, h(HeroPortrait, { hero: s.me.hero, height: 78 })));
          }),
          d.liveBoss && P('boss') && h('button', { className: 'boss-pin', style: { ...pos(P('boss'), 46, 6), transform: 'translate(-50%, -50%)' }, onClick: openRaid, 'aria-label': 'Boss raid: ' + d.liveBoss.name + ', ' + pct(d.liveBoss.hp - d.liveBoss.dealt, d.liveBoss.hp) + '% HP left' },
            h(Emo, { v: d.liveBoss.icon, size: 24 }), h('span', null, pct(d.liveBoss.hp - d.liveBoss.dealt, d.liveBoss.hp) + '%')))));
  };

  // ---------------------------------------------------------------- Map
  const MapScreen2D = ({ s, d, openHw, goHomework, openLocked, openRaid, openInfo }) => {
    const A = window.Art;
    const L = A.LESSON_PTS, B = A.BOSS_PT, LK = A.LOCK_PTS;
    const at = ([x, y]) => ({ left: (x / A.MAP_W) * 100 + '%', top: (y / A.MAP_H) * 100 + '%' });
    const hws = d.unitHws;
    const states = hws.slice(0, L.length).map((hw) => {
      if (s.me.submitted[hw.id]) return 'done';
      return d.nextHw && d.nextHw.id === hw.id ? 'current' : 'todo';
    });
    // Teammates by lesson (lesson is 1-based in the seed).
    const mates = s.myGuild.members.filter((m) => !m.me);
    const byLesson = (i) => mates.filter((m) => m.lesson - 1 === i);
    const myIdx = Math.min(d.lessonIdx, L.length - 1);
    const nextUnit = s.units.find((u) => u.unit === d.currentUnit + 1);
    return h('div', null,
      h('div', { className: 'map-head' },
        h('div', { style: { width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4E8A3E,#2B7CC4)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.4)' } }, h(Emo, { v: 'map', size: 34 })),
        h('div', { className: 'grow' }, h('div', { className: 'h1' }, 'World Map'), h('div', { className: 'muted tiny' }, s.course.name + ' · ' + d.unitsDone + '/' + s.course.units + ' units')),
        h('button', { className: 'icon-btn', onClick: openInfo, 'aria-label': 'About the map' }, h(Icon, { n: 'info' }))),
      h('div', { className: 'map-wrap', style: { marginTop: -68 } },
        h(WorldTerrain, { states, bossAlive: !!d.liveBoss }),
        h('div', { className: 'map-ov' },
          h('button', { className: 'map-card', style: at([300, 150]), onClick: goHomework },
            h('div', { className: 'grow' }, h('div', { className: 't' }, 'Unit ' + d.unit.unit), h('div', { className: 's', style: { color: '#E6E9F2' } }, d.unit.name), h('div', { className: 's' }, d.doneInUnit + '/' + hws.length + ' classes done')),
            h('span', { style: { color: 'var(--text-2)' } }, h(Icon, { n: 'chevR', s: 18 }))),
          L.map((p, i) => hws[i] && h('button', { key: 'n' + i, className: 'node-hit', style: at(p), onClick: () => openHw(hws[i].id), 'aria-label': 'Class ' + hws[i].label + ': ' + hws[i].title })),
          L.map((p, i) => {
            const list = byLesson(i);
            if (!list.length || (i === myIdx && d.nextHw)) return null;
            const off = [42, -42, -48, 42, -42][i] || 42;
            return h('div', { key: 'p' + i, className: 'pin', style: { left: `calc(${at(p).left} + ${off}px)`, top: `calc(${at(p).top} + 4px)` } },
              h('div', { className: 'face' }, h(Face, { face: list[0].face, size: 38 })),
              h('div', { className: 'tip' }),
              list.length > 1 && h('span', { className: 'badge b-gold', style: { position: 'absolute', top: -6, right: -16, background: '#3A2A08' } }, '+' + (list.length - 1)));
          }),
          d.nextHw && h('div', { className: 'pin me', style: { left: at(L[myIdx]).left, top: `calc(${at(L[myIdx]).top} - 6px)` } },
            h('div', { className: 'face' }, h(Face, { face: (s.shop.find((x) => x.id === s.me.avatar) || {}).icon, size: 44 })),
            h('div', { className: 'tip' })),
          d.liveBoss && h('button', { className: 'lock-badge', onClick: openRaid, style: { ...at(B), width: 46, height: 46, fontSize: 24, borderColor: '#B9A2FF', background: 'radial-gradient(circle at 35% 30%, #8B5CF6, #3D1D8F)' }, 'aria-label': 'Boss raid: ' + d.liveBoss.name }, h(Emo, { v: d.liveBoss.icon, size: 30 })),
          LK.map((p, i) => h('button', { key: 'l' + i, className: 'lock-badge', style: at(p), onClick: openLocked, 'aria-label': 'Locked' }, h(Emo, { v: 'lock', size: 24 }))),
          h('button', { className: 'map-card lock', style: at([100, 590]), onClick: openLocked },
            h('div', { className: 'grow' }, h('div', { className: 't', style: { color: '#C9D0DC' } }, 'Unit ' + (d.currentUnit + 1)), h('div', { className: 's' }, nextUnit ? 'Locked · ' + nextUnit.name : 'Locked')),
            h(Icon, { n: 'chevR', s: 18 })))));
  };

  // ---------------------------------------------------------------- Homework
  const HomeworkScreen = ({ s, d, now, hwSel, setHwSel, openTask, openQuests, submit }) => {
    const [tab, setTab] = useState('current');
    const hw = s.homeworks.find((x) => x.id === hwSel) || d.nextHw || s.homeworks[0];
    const sts = s.me.tasks[hw.id] || hw.tasks.map(() => 'Not started');
    const audio = s.me.audio[hw.id] || {};
    const sub = s.me.submitted[hw.id];
    const est = G.calcDamage({ hw, statuses: sts, audio, submittedAt: now, streak: s.me.streak, classSkill: heroOf(s).skill, earlyHours: s.me.scoutReady ? 12 : undefined });
    const fortress = G.fortressDamage(est.total, d.myMax, d.enemyShield, hw);
    const anyDone = sts.some(isMarked);
    const completed = s.homeworks.filter((x) => s.me.submitted[x.id]);
    const upcoming = s.homeworks.filter((x) => !s.me.submitted[x.id] && x.id !== (d.nextHw && d.nextHw.id));
    const mySub = s.submissions.find((x) => x.who === s.me.id && x.hwId === hw.id);
    const isLocked = d.locked(hw);

    return h('div', null,
      h(Topbar, { title: 'Homework' }),
      h('div', { className: 'page', style: { paddingTop: 0 } },
        h('div', { className: 'utabs' }, [['current', 'Current'], ['completed', 'Completed'], ['upcoming', 'Upcoming']].map(([k, l]) => h('button', { key: k, className: tab === k ? 'on' : '', onClick: () => setTab(k) }, l))),
        tab === 'current' && h(React.Fragment, null,
          h('div', { className: 'hero' },
            h(Mountains),
            h('div', { className: 'content' },
              h('div', { style: { color: '#D8DDF0', fontSize: 13.5 } }, 'Unit ' + hw.unit + ' · ' + unitName(s, hw.unit)),
              h('div', { className: 'h1', style: { margin: '4px 0 2px' } }, hw.label),
              h('div', { style: { color: '#D8DDF0', fontSize: 13.5, marginBottom: 10 } }, hw.title),
              h('span', { className: 'badge', style: { background: 'rgba(10,17,32,0.55)', color: '#E6E9F2', padding: '5px 10px' } },
                h(Icon, { n: 'clock', s: 13 }), hw.dueAt < now ? 'Overdue' : fmtLeft(hw.dueAt - now) + ' left'))),
          h('div', { className: 'list' },
            hw.tasks.map((t, i) => h(TaskRow, { key: i, task: t, status: sts[i], audio: audio[i], onClick: () => openTask(hw.id, i) }))),
          h('div', { className: 'list' },
            h('button', { className: 'item', onClick: openQuests },
              h('div', { className: 'ico', style: { color: 'var(--gold)' } }, h(Icon, { n: 'star', s: 28 })),
              h('div', { className: 'grow' }, h('div', { className: 't' }, 'Extra quest (optional)'), h('div', { className: 's' }, '+5 coins · ' + Math.max(0, G.SIDE_QUEST_DAILY_CAP - s.me.sideToday) + ' rewards left today')),
              h('span', { className: 'muted' }, h(Icon, { n: 'chevR', s: 20 })))),
          h('div', { className: 'card row', style: { borderColor: est.allFull ? 'var(--gold)' : 'rgba(245,184,61,0.35)', background: 'linear-gradient(90deg, rgba(245,184,61,0.12), rgba(245,184,61,0.03))' } },
            h(Chest, { size: 54, open: est.allFull }),
            h('div', { className: 'grow' },
              h('div', { style: { color: 'var(--gold)', fontWeight: 800, fontSize: 15 } }, 'Full homework bonus'),
              h('div', { style: { color: 'var(--gold)', fontSize: 13 } }, est.allFull ? 'All main tasks Full — bonus unlocked!' : 'Complete all main tasks'),
              h('div', { style: { color: 'var(--gold)', fontSize: 13, fontWeight: 700 } }, '+' + G.FULL_BONUS + ' damage + a chest'))),
          sub
            ? h('div', { className: 'card', style: { borderColor: sub === 'verified' ? 'var(--green)' : 'var(--gold)' } },
              sub === 'verified'
                ? h('div', { style: { color: 'var(--green)', fontWeight: 700 } }, '✓ Approved by your teacher' + (mySub && mySub.dmg ? ' · ' + mySub.dmg + ' damage landed' : ''))
                : h('div', { style: { color: 'var(--gold)', fontWeight: 700 } }, '⏳ ' + fortress + ' damage pending — lands when your teacher checks it'))
            : isLocked
              ? h('div', { className: 'card muted', style: { textAlign: 'center' } }, '🔒 Unlocks when your guild defeats ' + (d.liveBoss ? d.liveBoss.name : 'the boss'))
              : h('div', { className: 'card' },
                h('div', { className: 'row tiny muted', style: { flexWrap: 'wrap', gap: 6 } },
                  h('span', null, 'Tasks ' + est.base),
                  est.fullBonus > 0 && h(Badge, { k: 'b-gold' }, '+' + est.fullBonus + ' bonus'),
                  est.timing === 'early' && h(Badge, { k: 'b-gold' }, '⚡ Early Strike ×1.5'),
                  est.timing === 'late' && h(Badge, { k: 'b-red' }, 'Late ×0.5'),
                  est.streakMult > 1 && h(Badge, { k: 'b-red' }, '🔥 Streak +10%'),
                  hw.tasks.some((t) => t.type === heroOf(s).skill) && h(Badge, { k: 'b-green' }, heroOf(s).name + ' +10%'),
                  s.me.scoutReady && h(Badge, { k: 'b-green' }, 'Echo Scout ready'),
                  h('span', null, '· assumes ★★')),
                h('button', { className: 'btn gold block', style: { marginTop: 12 }, disabled: !anyDone, onClick: () => submit(hw, sts, audio, est, fortress) },
                  h(Icon, { n: 'swords', s: 18 }), anyDone ? 'Attack the Dragons · ' + fortress + ' damage' : 'Mark a task to attack'))),
        tab === 'completed' && h('div', { className: 'list' },
          completed.length ? completed.slice().reverse().map((x) => {
            const sx = s.submissions.find((y) => y.who === s.me.id && y.hwId === x.id);
            const ok = s.me.submitted[x.id] === 'verified';
            return h('button', { key: x.id, className: 'item', onClick: () => { setHwSel(x.id); setTab('current'); } },
              h('div', { className: cx('ck', ok ? 'on' : 'part') }, ok ? h(Icon, { n: 'check', s: 16, w: 3 }) : '⏳'),
              h('div', { className: 'grow' }, h('div', { className: 't' }, x.label + ' · ' + x.title), h('div', { className: 's' }, 'Unit ' + x.unit + ' · ' + unitName(s, x.unit) + (sx && sx.dmg ? ' · ' : ''), sx && sx.dmg ? h('span', { className: 'dmg' }, sx.dmg + ' damage') : null)),
              h('span', { className: 'muted' }, h(Icon, { n: 'chevR', s: 20 })));
          }) : h('div', { className: 'item muted' }, 'Nothing yet')),
        tab === 'upcoming' && h('div', { className: 'list' },
          upcoming.map((x) => {
            const lk = d.locked(x);
            return h('button', { key: x.id, className: 'item', style: { opacity: lk ? 0.55 : 1 }, onClick: () => { setHwSel(x.id); setTab('current'); } },
              h('div', { className: 'ico' }, h(Icon, { n: lk ? 'lock' : 'clock', s: 22 })),
              h('div', { className: 'grow' }, h('div', { className: 't' }, x.label + ' · ' + x.title), h('div', { className: 's' }, 'Unit ' + x.unit + ' · ' + unitName(s, x.unit) + ' · ' + (lk ? 'locked' : 'due in ' + fmtLeft(x.dueAt - now)))),
              h('span', { className: 'muted' }, h(Icon, { n: 'chevR', s: 20 })));
          }))));
  };

  // ---------------------------------------------------------------- Battle
  const feedIcon = (what) => /writing/.test(what) ? 'pencil' : /speaking/.test(what) ? 'mic' : /grammar/.test(what) ? 'doc' : /vocab/.test(what) ? 'book' : /bonus|full/.test(what) ? 'gift' : /quest/.test(what) ? 'star' : 'swords';
  const ActivityList = ({ s, now, items, fresh }) => h('div', { className: 'list' },
    items.map((f) => {
      const ours = f.side === 'us';
      const pool = ours ? s.myGuild.members : s.battle.enemy.members;
      const who = pool.find((m) => m.name === f.who) || { face: '🧑' };
      const ic = feedIcon(f.what);
      const iconColor = ic === 'gift' || ic === 'star' ? 'var(--gold)' : ic === 'mic' ? 'var(--red-hi)' : 'var(--cream)';
      const face = f.who === s.me.name ? (s.shop.find((x) => x.id === s.me.avatar) || {}).icon : who.face;
      return h('div', { key: f.id, className: cx('item feed-item', fresh === f.id && 'new') },
        h(Face, { face, size: 40, ring: ours ? 'var(--accent)' : 'var(--red)' }),
        h('div', { style: { color: iconColor } }, h(Icon, { n: ic, s: 20 })),
        h('div', { className: 'grow' },
          h('div', { style: { fontSize: 13.5 } }, h('b', { style: { fontWeight: 600 } }, f.who === s.me.name ? 'You' : f.who), ours ? '' : ' (Dragons)', ' ' + f.what),
          h('div', { className: 'row', style: { gap: 6, marginTop: 2, flexWrap: 'wrap' } },
            h('span', { style: { color: f.pending ? 'var(--text-3)' : ours ? 'var(--green)' : 'var(--red-hi)', fontWeight: 700 } }, (ours ? '+' : '−') + f.dmg + ' damage'),
            f.crit && h(Badge, { k: 'b-gold' }, '💥 Critical'),
            f.early && h(Badge, { k: 'b-gold' }, '⚡ Early'),
            f.pending && h(Badge, { k: 'b-grey' }, '⏳ Pending'))),
        h('div', { className: 'tiny muted', style: { alignSelf: 'flex-end', whiteSpace: 'nowrap' } }, ago(f.at, now)));
    }));

  const BattleScreen = ({ s, d, now, fresh, back, openRules }) => {
    const feed = [...s.feed].sort((a, b) => b.at - a.at);
    const embers = useMemo(() => Array.from({ length: 18 }, () => ({ l: Math.random() * 100, b: Math.random() * 40, dur: 3 + Math.random() * 4, del: Math.random() * 5 })), []);
    const Side = ({ tone, g, hp }) => h('div', { className: 'side' },
      h(Banner, { tone, crest: g.crest, w: 140 }),
      h('div', { className: 'n', style: { fontSize: 16, marginTop: -30, textShadow: '0 2px 6px #000', position: 'relative' } }, g.name),
      h('div', { className: 'hp', style: { fontSize: 19 } }, fmt(hp), h('small', null, 'HP')));
    return h('div', null,
      h(Topbar, { title: 'Battle', left: h('button', { className: 'icon-btn', onClick: back, 'aria-label': 'Back' }, h(Icon, { n: 'chevL' })),
        right: h('button', { className: 'btn outline-gold', onClick: openRules }, 'Rules') }),
      h('div', { className: 'arena' },
        embers.map((e, i) => h('span', { key: i, className: 'ember', style: { left: e.l + '%', bottom: e.b + '%', animationDuration: e.dur + 's', animationDelay: e.del + 's' } })),
        h('div', { style: { textAlign: 'center', position: 'relative' } },
          h('div', { className: 'h1', style: { fontSize: 26 } }, 'Weekly Battle'),
          h('div', { style: { color: '#E6E9F2', marginTop: 2 } }, fmtLeft(d.battleLeft) + ' left')),
        h('div', { className: 'row', style: { justifyContent: 'center', gap: 0, marginTop: 6, position: 'relative' } },
          h(Side, { tone: 'green', g: s.myGuild, hp: d.usHP }),
          h('div', { className: 'battle-card', style: { background: 'none', border: 0, padding: 0, alignSelf: 'center', marginTop: -60, overflow: 'visible' } }, h('div', { className: 'vs', style: { fontSize: 44 } }, 'VS')),
          h(Side, { tone: 'red', g: d.enemy, hp: d.enemyHP })),
        h('div', { style: { padding: '14px 16px 0', position: 'relative' } },
          h(VsBar, { us: d.usHP, them: d.enemyHP, thick: true }),
          h('div', { className: 'row tiny', style: { marginTop: 8, color: '#C9D0DC' } },
            h('span', null, '🛡️ Shield ' + Math.round(d.myShield * 100) + '%'),
            h('span', { className: 'grow', style: { textAlign: 'center', color: 'var(--gold)' } }, d.pendingOnEnemy > 0 ? '⏳ ' + d.pendingOnEnemy + ' pending' : ''),
            h('span', null, 'Shield ' + Math.round(d.enemyShield * 100) + '% 🛡️')),
          h('div', { className: 'tiny', style: { marginTop: 10, color: '#C9D0DC', textAlign: 'center', lineHeight: 1.5 } },
            s.myGuild.members.length + ' students · ' + s.myGuild.level + '  vs  ' + d.enemy.members.length + ' students · ' + d.enemy.level,
            h('br'), 'Fair fight: each group is scored on how much of its own homework it completes.'))),
      h('div', { className: 'page' },
        d.notAttacked > 0 && h('div', { className: 'card tiny', style: { borderColor: 'rgba(229,56,59,0.4)', color: '#FFC2C2' } },
          h('b', null, d.notAttacked + ' teammates haven\'t attacked yet.'), ' Every attacker raises the shield, so the Dragons hit softer.'),
        h(SectionHead, { title: 'Recent Activity' }),
        h(ActivityList, { s, now, items: feed.slice(0, 12), fresh })));
  };

  // ---------------------------------------------------------------- Guild
  const GuildScreen = ({ s, d, now, openBattle, toggleDuel }) => {
    const [tab, setTab] = useState('overview');
    const ranked = s.myGuild.members.slice().sort((a, b) => b.week - a.week);
    // Students only see teammates who have attacked: there is no public bottom of the list.
    const active = ranked.filter((m) => m.week > 0);
    const myFace = (s.shop.find((x) => x.id === s.me.avatar) || {}).icon;
    const MemberRow = ({ m, i }) => h('div', { className: cx('item', m.me && 'hl') },
      h('div', { style: { width: 22, textAlign: 'center', fontWeight: 700, color: m.me ? 'var(--gold)' : 'var(--text-2)' } }, i === 0 ? '👑' : i + 1),
      h(Face, { face: m.me ? myFace : m.face, size: 34 }),
      h('div', { className: 'grow t' }, m.name + (m.me ? ' (you)' : '')),
      h('div', { className: 'num', style: { color: 'var(--gold)' } }, fmt(m.week)));
    const b = d.liveBoss;
    return h('div', null,
      h('div', { style: { padding: '14px 16px 0', background: 'radial-gradient(80% 100% at 20% 0%, rgba(47,128,255,0.35), transparent 70%)' } },
        h('div', { className: 'row', style: { gap: 14 } },
          h(Crest, { tone: 'green', crest: s.myGuild.crest, size: 64 }),
          h('div', { className: 'grow' }, h('div', { className: 'h1', style: { fontSize: 24 } }, s.myGuild.name),
            h('div', { className: 'muted' }, s.myGuild.members.length + ' members · ' + s.myGuild.level))),
        h('div', { className: 'utabs', style: { marginTop: 14 } }, [['overview', 'Overview'], ['members', 'Members'], ['battles', 'Battles']].map(([k, l]) => h('button', { key: k, className: tab === k ? 'on' : '', onClick: () => setTab(k) }, l)))),
      h('div', { className: 'page' },
        tab === 'overview' && h(React.Fragment, null,
          h(BattleCard, { s, d, compact: true, onView: openBattle }),
          h(SectionHead, { title: 'Guild Members', right: h('button', { style: { color: 'var(--blue-hi)', fontWeight: 600 }, onClick: () => setTab('members') }, 'See all') }),
          h('div', { className: 'list' }, active.slice(0, 5).map((m, i) => h(MemberRow, { key: m.id, m, i })))),
        tab === 'members' && h(React.Fragment, null,
          h('div', { className: 'list' }, active.map((m, i) => h(MemberRow, { key: m.id, m, i }))),
          d.notAttacked > 0 && h('div', { className: 'card tiny muted', style: { textAlign: 'center' } }, '+' + d.notAttacked + ' teammates yet to attack this week · names stay private')),
        tab === 'battles' && h(React.Fragment, null,
          b && h('div', { className: 'card', style: { background: 'radial-gradient(80% 80% at 50% 0%, rgba(139,92,246,0.3), transparent 70%), var(--surface)', borderColor: 'rgba(139,92,246,0.4)' } },
            h('div', { className: 'row', style: { gap: 14 } },
              h(Crest, { tone: 'purple', icon: b.icon, size: 62, rim: 'gold' }),
              h('div', { className: 'grow' },
                h('div', { className: 'eyebrow', style: { color: '#B9A2FF' } }, 'Boss Raid · Unit ' + b.unit),
                h('div', { className: 'h2' }, b.name),
                h('div', { className: 'tiny muted' }, fmtLeft(b.deadline - now) + ' left · unlocks Unit ' + (b.unit + 1)))),
            h(Bar, { value: b.hp - b.dealt, max: b.hp, color: 'linear-gradient(90deg,#8B5CF6,#EC4899)', style: { height: 12, marginTop: 14 } }),
            h('div', { className: 'row tiny muted', style: { marginTop: 6 } },
              h('span', { className: 'grow' }, fmt(b.hp - b.dealt) + ' / ' + fmt(b.hp) + ' HP'),
              h('span', null, 'Your hits: ', h('b', { style: { color: 'var(--gold)' } }, fmt((b.contrib || {})[s.me.id] || 0))))),
          h(SectionHead, { title: 'Past battles' }),
          h('div', { className: 'list' }, s.battle.history.map((x, i) => h('div', { key: i, className: 'item' },
            h(Badge, { k: x.won ? 'b-green' : 'b-red' }, x.won ? 'WON' : 'LOST'),
            h('div', { className: 'grow t' }, 'vs ' + x.vs),
            h('div', { className: 'tiny muted num' }, x.us + '% – ' + x.them + '%')))),
          h(SectionHead, { title: '1v1 Duel' }),
          h('div', { className: 'card row' },
            h('div', { style: { fontSize: 30 } }, '🤺'),
            h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, s.me.duel ? 'You vs Kamila (Dragons)' : 'Opt-in weekly duel'),
              h('div', { className: 'tiny muted' }, s.me.duel ? 'Most approved damage this week wins 40 coins' : 'Matched with a student of similar level. Losing costs nothing.')),
            h('button', { className: cx('btn sm', s.me.duel ? 'ghost' : 'gold'), onClick: toggleDuel }, s.me.duel ? 'Leave' : 'Join')))));
  };

  // ---------------------------------------------------------------- Profile
  const ACH = [
    { k: 'hero', name: 'Homework Hero', desc: 'Complete 10 full homeworks', tone: 'gold', icon: 'star', prog: (me) => [me.fullCount, 10] },
    { k: 'early', name: 'Early Bird', desc: 'Submit 5 tasks early', tone: 'blue', icon: 'dove', prog: (me) => [me.earlyCount, 5] },
    { k: 'speak', name: 'Speaking Pro', desc: 'Upload 5 speaking tasks', tone: 'red', icon: 'mic', prog: (me) => [me.speakingCount, 5] },
    { k: 'crit', name: 'Critical Striker', desc: 'Land 3 Critical Hits', tone: 'purple', icon: 'collision', prog: (me) => [me.crits || 0, 3] },
    { k: 'raid', name: 'Raid Breaker', desc: 'Help defeat a unit boss', tone: 'green', icon: 'moai', prog: (me) => [me.titles.includes('Raid Breaker') ? 1 : 0, 1] },
    { k: 'quest', name: 'Explorer', desc: 'Finish 5 extra quests', tone: 'blue', icon: 'compass', prog: (me) => [me.sideDone.length, 5] },
  ];
  const Medal = ({ a, me }) => {
    const [v, max] = a.prog(me);
    const got = v >= max;
    return h('div', { className: 'ach', style: got ? null : { opacity: 0.85 } },
      h('div', { style: got ? null : { filter: 'grayscale(1) brightness(0.7)' } }, h(Crest, { tone: a.tone, icon: a.icon, size: 52, rim: 'gold', spikes: false })),
      h('div', { className: 'n' }, a.name), h('div', { className: 'd' }, a.desc),
      !got && h('div', { className: 'tiny', style: { color: 'var(--gold)', fontWeight: 700 } }, Math.min(v, max) + '/' + max));
  };
  const ProfileScreen = ({ s, d, openSettings, openShop, openChest, openAch, setTitle }) => {
    const { me } = s;
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const done = (a) => a.prog(me)[0] >= a.prog(me)[1];
    const shown = ACH.slice().sort((a, b) => done(b) - done(a) || b.prog(me)[0] / b.prog(me)[1] - a.prog(me)[0] / a.prog(me)[1]).slice(0, 3);
    return h('div', null,
      h(Topbar, { title: 'Profile', left: h('span', { style: { fontSize: 22 }, title: d.rank.name + ' rank' }, d.rank.icon),
        right: h('button', { className: 'icon-btn', onClick: openSettings, 'aria-label': 'Settings' }, h(Icon, { n: 'gear' })) }),
      h('div', { className: 'page', style: { paddingTop: 4 } },
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
          h(MeAvatar, { s, size: 92, crown: true }),
          h('div', { className: 'h1', style: { marginTop: 8 } }, me.name),
          h('div', { style: { color: '#D2D8E6' } }, s.course.level + ' · ' + s.myGuild.name),
          h('div', { className: 'tiny', style: { color: 'var(--gold)', fontWeight: 600 } }, '“' + me.title + '”')),
        h('div', { className: 'tiles' },
          h('div', { className: 'tile' }, h('div', { className: 'k' }, 'Level'), h('div', { className: 'v' }, h(Emo, { v: 'star', size: 26 }), d.lvl.lvl)),
          h('div', { className: 'tile' }, h('div', { className: 'k' }, 'Total Damage'), h('div', { className: 'v' }, h(Emo, { v: 'swords', size: 24 }), fmt(me.totalDamage))),
          h('div', { className: 'tile' }, h('div', { className: 'k' }, 'Coins'), h('div', { className: 'v' }, h(Emo, { v: 'coin', size: 24 }), fmt(me.coins)))),
        h('div', { className: 'card' },
          h('div', { style: { fontWeight: 700, fontSize: 16 } }, 'Streak'),
          h('div', { className: 'row', style: { marginTop: 6 } },
            h('div', { className: 'grow row', style: { fontWeight: 800, fontSize: 22, whiteSpace: 'nowrap', gap: 6 } }, h(Emo, { v: 'fire', size: 28 }), me.streak + ' days'),
            h('div', { className: 'week' }, days.map((x, i) => h('div', { key: i, className: 'd' }, h('div', { className: cx('c', me.week[i] && 'on') }, me.week[i] ? h(Icon, { n: 'check', s: 12, w: 3.5 }) : null), x))))),
        me.chests > 0 && h('button', { className: 'card row', style: { borderColor: 'var(--gold)' }, onClick: openChest },
          h(Chest, { size: 48 }),
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 800, color: 'var(--gold)' } }, me.chests + ' chest' + (me.chests > 1 ? 's' : '') + ' to open'), h('div', { className: 'tiny muted' }, 'Earned for a Full homework')),
          h(Icon, { n: 'chevR' })),
        h(SectionHead, { title: 'Achievements', right: h('button', { style: { color: 'var(--blue-hi)', fontWeight: 600 }, onClick: openAch }, 'See all') }),
        h('div', { className: 'ach-grid' }, shown.map((a) => h(Medal, { key: a.k, a, me }))),
        h('div', { className: 'card' },
          h('div', { className: 'row' }, h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, 'Level ' + d.lvl.lvl + ' → ' + (d.lvl.lvl + 1)), h('div', { className: 'tiny muted' }, d.rank.icon + ' ' + d.rank.name + ' rank this season')),
            h('span', { className: 'tiny muted num' }, fmt(d.lvl.into) + ' / ' + fmt(d.lvl.need) + ' XP')),
          h(Bar, { value: d.lvl.into, max: d.lvl.need, color: 'linear-gradient(90deg, var(--gold-lo), var(--gold-hi))', style: { marginTop: 10 } })),
        h('button', { className: 'btn ghost block', onClick: openShop }, h(Icon, { n: 'shop', s: 18 }), 'Shop & inventory'),
        h(SectionHead, { title: 'Titles' }),
        h('div', { className: 'pill-tabs', style: { flexWrap: 'wrap' } },
          ['Grammar Strategist', 'Early Bird', 'Speaking Specialist', 'Raid Breaker'].map((t) => h('button', { key: t, className: me.title === t ? 'on' : '', disabled: !me.titles.includes(t), style: { opacity: me.titles.includes(t) ? 1 : 0.4 }, onClick: () => setTitle(t) }, (me.titles.includes(t) ? '' : '🔒 ') + t)))));
  };

  // ---------------------------------------------------------------- sheets
  const TaskSheet = ({ s, hwId, idx, onClose, setStatus, setAudio }) => {
    const hw = s.homeworks.find((x) => x.id === hwId);
    const t = hw.tasks[idx];
    const st = (s.me.tasks[hwId] || [])[idx] || 'Not started';
    const audio = (s.me.audio[hwId] || {})[idx];
    const ro = !!s.me.submitted[hwId];
    const [rec, setRec] = useState(false);
    useEffect(() => {
      if (!rec) return undefined;
      const tm = setTimeout(() => { setAudio(hwId, idx, '0:' + pad2(35 + Math.floor(Math.random() * 40))); setRec(false); }, 2200);
      return () => clearTimeout(tm);
    }, [rec]);
    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 16 } },
        h('div', { style: { width: 52, height: 52, borderRadius: 14, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--cream)' } }, h(Icon, { n: TYPE_ICON[t.type], s: 28, w: 1.8 })),
        h('div', { className: 'grow' }, h('div', { className: 'tiny muted' }, 'Unit ' + hw.unit + ' · ' + hw.label + ' · ' + hw.title), h('div', { className: 'h2' }, t.label),
          h('div', { className: 'dmg tiny' }, '+' + G.DAMAGE[t.type] + ' damage when Full'))),
      h('div', { className: 'eyebrow', style: { marginBottom: 8 } }, ro ? 'Submitted' : 'How much did you finish?'),
      h('div', { className: 'seg', style: ro ? { opacity: 0.55 } : null },
        G.STATUSES.map((x) => h('button', { key: x, disabled: ro, className: st === x ? SEG_CLS[x] : '', onClick: () => setStatus(hwId, idx, x) }, x))),
      t.type === 'speaking' && h('div', { className: 'card row', style: { marginTop: 12 } },
        audio
          ? h(React.Fragment, null, h('span', { style: { color: 'var(--green)', fontWeight: 700 } }, '🎧 Recording attached · ' + audio), h('span', { className: 'grow' }), !ro && h('button', { className: 'btn ghost sm', onClick: () => setRec(true) }, 'Re-record'))
          : rec
            ? h(React.Fragment, null, h('span', { className: 'rec' }), h('b', null, 'Recording…'))
            : h(React.Fragment, null, h('div', { className: 'grow tiny', style: { color: 'var(--gold)' } }, 'Speaking only counts with real audio'), !ro && h('button', { className: 'btn gold sm', onClick: () => setRec(true) }, h(Icon, { n: 'mic', s: 16 }), 'Record'))),
      h('button', { className: 'btn gold block', style: { marginTop: 16 }, onClick: onClose }, 'Done'));
  };

  const RulesSheet = ({ onClose }) => h(Sheet, { onClose },
    h('div', { className: 'h1', style: { marginBottom: 4 } }, 'Battle rules'),
    h('div', { className: 'muted', style: { marginBottom: 12 } }, 'Only real, approved homework wins battles.'),
    h('div', { className: 'list' },
      [['Grammar / vocabulary / listening / reading', '10'], ['Writing task', '25'], ['Speaking task (audio uploaded)', '30'], ['Full homework bonus', '+20'],
        ['Early Strike (24h+ before deadline)', '×1.5'], ['Teacher rates 3★ (Critical Hit)', '×2'], ['Teacher rates 1★', '×0.5'], ['Streak of 3+', '+10%'], ['Late submission', '×0.5']]
        .map(([a, b], i) => h('div', { key: i, className: 'item' }, h('div', { className: 'grow' }, a), h('b', { style: { color: 'var(--gold)' } }, b)))),
    h('div', { className: 'tiny muted', style: { marginTop: 12, lineHeight: 1.5 } },
      'Damage is pending until your teacher checks the work. Each fortress has 1,000 HP. If every student in a group finished every homework of the week fully, the group would deal exactly 1,000, so a group of 2 and a group of 20, or a Beginner group and an Upper-Intermediate group, can fight fairly. In battles, bonuses can raise one homework to at most +60% of its normal maximum. Every teammate who attacks raises the guild shield, so the other side hits softer.'),
    h('button', { className: 'btn gold block', style: { marginTop: 14 }, onClick: onClose }, 'Got it'));

  const InfoSheet = ({ title, body, onClose, icon }) => h(Sheet, { onClose },
    h('div', { style: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      icon, h('div', { className: 'h1', style: { margin: '10px 0 6px' } }, title), h('p', { className: 'muted', style: { margin: '0 0 16px', lineHeight: 1.5 } }, body),
      h('button', { className: 'btn gold block', onClick: onClose }, 'Got it')));

  const NotifSheet = ({ items, onClose }) => h(Sheet, { onClose },
    h('div', { className: 'h1', style: { marginBottom: 12 } }, 'Notifications'),
    h('div', { className: 'list' }, items.length ? items.map((n, i) => h('div', { key: i, className: 'item' }, h(Emo, { v: n.icon, size: 28 }), h('div', { className: 'grow', style: { fontSize: 13.5 } }, n.text))) : h('div', { className: 'item muted' }, 'You\'re all caught up')));

  const KIND_LABEL = { video: 'Watch a video', article: 'Read an article', shadowing: 'Shadowing', flashcards: 'Flashcards' };
  const CHECK_LABEL = { video: '3 quick questions', article: '1-minute vocabulary check', shadowing: 'Record and upload audio', flashcards: 'Short self-test' };
  const QuestLibrary = ({ s, onClose, openQuest }) => h(Sheet, { onClose },
    h('div', { className: 'row', style: { marginBottom: 4 } }, h('div', { className: 'h1 grow' }, 'Extra quests'), h(Badge, { k: 'b-gold' }, Math.min(s.me.sideToday, G.SIDE_QUEST_DAILY_CAP) + '/' + G.SIDE_QUEST_DAILY_CAP + ' today')),
    h('div', { className: 'muted', style: { marginBottom: 12 } }, 'Optional practice for coins. Homework stays your main weapon.'),
    h('div', { className: 'list' }, s.sideQuests.map((q) => {
      const done = s.me.sideDone.includes(q.id);
      return h('button', { key: q.id, className: 'item', style: { opacity: done ? 0.5 : 1 }, onClick: () => openQuest(q.id) },
        h('div', { style: { width: 42, height: 42, borderRadius: 12, background: q.color + '33', display: 'grid', placeItems: 'center', flexShrink: 0 } }, h(Emo, { v: q.icon, size: 30 })),
        h('div', { className: 'grow' }, h('div', { className: 't' }, q.title), h('div', { className: 's' }, KIND_LABEL[q.kind] + ' · ' + CHECK_LABEL[q.kind])),
        q.assigned && !done && h(Badge, { k: 'b-blue' }, 'Teacher'),
        done ? h(Badge, { k: 'b-green' }, '✓') : h('span', { style: { color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' } }, '+' + q.coins + ' 🪙'));
    })));

  const Quiz = ({ questions, onDone, timed }) => {
    const [ans, setAns] = useState({});
    const [checked, setChecked] = useState(false);
    const [left, setLeft] = useState(timed || 0);
    useEffect(() => {
      if (!timed || checked) return undefined;
      if (left <= 0) { setChecked(true); return undefined; }
      const t = setTimeout(() => setLeft((x) => x - 1), 1000);
      return () => clearTimeout(t);
    }, [left, checked, timed]);
    const score = questions.filter((q, i) => ans[i] === q.a).length;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      timed && !checked && h('div', { className: 'row' }, h('span', { className: 'eyebrow grow' }, 'Vocabulary check'), h('span', { className: 'num', style: { color: left < 15 ? 'var(--red-hi)' : 'var(--gold)' } }, '⏱ 0:' + pad2(left))),
      questions.map((q, i) => h('div', { key: i, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h('div', { style: { fontWeight: 700 } }, (i + 1) + '. ' + q.q),
        q.opts.map((o, j) => h('button', { key: j, disabled: checked, className: cx('quiz-opt', !checked && ans[i] === j && 'sel', checked && j === q.a && 'right', checked && ans[i] === j && j !== q.a && 'wrong'), onClick: () => setAns((a) => ({ ...a, [i]: j })) }, o)))),
      !checked
        ? h('button', { className: 'btn gold block', disabled: Object.keys(ans).length < questions.length, onClick: () => setChecked(true) }, 'Check answers')
        : h(React.Fragment, null,
          h('div', { className: 'card', style: { textAlign: 'center', fontWeight: 700, borderColor: score >= 2 ? 'var(--green)' : 'var(--red)' } }, score + ' / ' + questions.length + ' correct · ' + (score >= 2 ? 'quest passed!' : 'you need 2 to pass')),
          score >= 2 ? h('button', { className: 'btn gold block', onClick: onDone }, 'Claim reward')
            : h('button', { className: 'btn ghost block', onClick: () => { setAns({}); setChecked(false); setLeft(timed || 0); } }, 'Try again')));
  };

  const QuestSheet = ({ s, qId, onClose, complete }) => {
    const q = s.sideQuests.find((x) => x.id === qId);
    const done = s.me.sideDone.includes(q.id);
    const [stage, setStage] = useState('intro');
    const [watch, setWatch] = useState(0);
    const [card, setCard] = useState(0);
    const [flip, setFlip] = useState(false);
    const [known, setKnown] = useState([]);
    const [rec, setRec] = useState('idle');
    useEffect(() => {
      if (stage !== 'watch') return undefined;
      if (watch >= 100) { setStage('check'); return undefined; }
      const t = setTimeout(() => setWatch((w) => w + 4), 120);
      return () => clearTimeout(t);
    }, [stage, watch]);
    useEffect(() => {
      if (rec !== 'rec') return undefined;
      const t = setTimeout(() => setRec('done'), 2600);
      return () => clearTimeout(t);
    }, [rec]);
    const finish = () => { complete(q); onClose(); };
    let body;
    if (done) body = h('div', { className: 'card', style: { textAlign: 'center', color: 'var(--green)', fontWeight: 700 } }, '✓ You finished this quest');
    else if (q.kind === 'video') {
      body = stage === 'check' ? h(Quiz, { questions: q.check, onDone: finish })
        : h('div', null,
          h('div', { style: { aspectRatio: '16/9', borderRadius: 14, background: 'linear-gradient(135deg, #3b1d4a, #12233f)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', marginBottom: 12 } },
            stage === 'intro' ? h('button', { onClick: () => setStage('watch'), style: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', color: '#111', fontSize: 26, textAlign: 'center' }, 'aria-label': 'Play' }, '▶') : h('b', { className: 'tiny' }, 'Playing…'),
            h('div', { style: { position: 'absolute', left: 0, bottom: 0, height: 4, width: watch + '%', background: 'var(--red)' } })),
          h('p', { className: 'muted', style: { margin: 0 } }, q.body),
          h('div', { className: 'tiny muted', style: { marginTop: 8 } }, 'The questions unlock after the video ends.'));
    } else if (q.kind === 'article') {
      body = stage === 'check' ? h(Quiz, { questions: q.check, onDone: finish, timed: q.timed })
        : h('div', null, h('p', { style: { lineHeight: 1.7, fontSize: 15, margin: '0 0 14px' } }, q.body), h('button', { className: 'btn gold block', onClick: () => setStage('check') }, 'Start 1-minute check'));
    } else if (q.kind === 'shadowing') {
      body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('p', { className: 'muted', style: { margin: 0 } }, q.body),
        h('div', { className: 'list' }, q.lines.map((l, i) => h('div', { key: i, className: 'item' }, h('span', { className: 'muted num' }, i + 1), h('span', { className: 'grow' }, l), h('span', null, '🔊')))),
        rec === 'done'
          ? h(React.Fragment, null, h('div', { className: 'tiny', style: { color: 'var(--green)', fontWeight: 700 } }, '🎧 Recording uploaded'), h('button', { className: 'btn gold block', onClick: finish }, 'Claim reward'))
          : h('button', { className: 'btn gold block', disabled: rec === 'rec', onClick: () => setRec('rec') }, rec === 'rec' ? h(React.Fragment, null, h('span', { className: 'rec' }), ' Recording…') : '🎙 Record all 5 lines'));
    } else {
      const c = q.cards[card];
      body = stage === 'intro'
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          h('div', { className: cx('flash-card', flip && 'back'), onClick: () => setFlip((f) => !f) }, flip ? c[1] : c[0]),
          h('div', { className: 'row' },
            h('button', { className: 'btn ghost sm', disabled: card === 0, onClick: () => { setCard(card - 1); setFlip(false); } }, '←'),
            h('span', { className: 'grow tiny muted', style: { textAlign: 'center' } }, 'Card ' + (card + 1) + ' / ' + q.cards.length + ' · tap to flip'),
            card < q.cards.length - 1 ? h('button', { className: 'btn ghost sm', onClick: () => { setCard(card + 1); setFlip(false); } }, '→')
              : h('button', { className: 'btn gold sm', onClick: () => { setStage('test'); setCard(0); setFlip(false); } }, 'Self-test')))
        : stage === 'test'
          ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('div', { className: 'eyebrow' }, 'Self-test · ' + (card + 1) + ' / ' + q.cards.length),
            h('div', { className: cx('flash-card', flip && 'back'), onClick: () => setFlip(true) }, flip ? c[1] : c[0]),
            !flip ? h('button', { className: 'btn ghost block', onClick: () => setFlip(true) }, 'Say the meaning, then reveal')
              : h('div', { className: 'row' }, ['Missed it', 'Knew it'].map((lbl, k) => h('button', { key: lbl, className: cx('btn grow', k ? 'gold' : 'ghost'), onClick: () => {
                setKnown([...known, !!k]); setFlip(false);
                if (card < q.cards.length - 1) setCard(card + 1); else setStage('result');
              } }, lbl))))
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('div', { className: 'card', style: { textAlign: 'center', fontWeight: 700 } }, known.filter(Boolean).length + ' / ' + q.cards.length + ' known'),
            h('button', { className: 'btn gold block', onClick: finish }, 'Claim reward'));
    }
    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 14 } },
        h('div', { style: { width: 48, height: 48, borderRadius: 14, background: q.color + '33', display: 'grid', placeItems: 'center', flexShrink: 0 } }, h(Emo, { v: q.icon, size: 34 })),
        h('div', { className: 'grow' }, h('div', { className: 'tiny muted' }, KIND_LABEL[q.kind] + ' · ' + q.mins + ' min'), h('div', { className: 'h2' }, q.title)),
        h('span', { style: { color: 'var(--gold)', fontWeight: 800, whiteSpace: 'nowrap' } }, '+' + q.coins + ' 🪙')),
      s.me.sideToday >= G.SIDE_QUEST_DAILY_CAP && !done && h('div', { className: 'card tiny muted', style: { marginBottom: 10 } }, 'Daily reward cap reached — practice still counts, but no coins until tomorrow.'),
      body);
  };

  const ShopSheet = ({ s, onClose, buy, equip }) => {
    const [tab, setTab] = useState('avatar');
    const items = s.shop.filter((x) => x.kind === tab);
    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 4 } }, h('div', { className: 'h1 grow' }, 'Shop'), h('span', { className: 'badge b-gold', style: { fontSize: 14, padding: '6px 12px' } }, '🪙 ' + fmt(s.me.coins))),
      h('div', { className: 'muted', style: { marginBottom: 12 } }, 'Coins buy looks and protection — never damage.'),
      h('div', { className: 'pill-tabs', style: { marginBottom: 12 } }, [['avatar', 'Avatars'], ['frame', 'Frames'], ['consumable', 'Items']].map(([k, l]) => h('button', { key: k, className: tab === k ? 'on' : '', onClick: () => setTab(k) }, l))),
      tab === 'consumable'
        ? h('div', { className: 'list' }, items.map((it) => {
          const used = it.id === 'charm' && s.me.charmUsed;
          return h('div', { key: it.id, className: 'item' }, h(Emo, { v: it.icon, size: 38 }),
            h('div', { className: 'grow' }, h('div', { className: 't' }, it.name + (it.id === 'freeze' && s.me.freezes ? ' · ' + s.me.freezes + ' owned' : '')), h('div', { className: 's' }, it.desc)),
            h('button', { className: 'btn gold sm', disabled: used || s.me.coins < it.price, onClick: () => buy(it) }, used ? 'Active' : '🪙 ' + it.price));
        }))
        : h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } }, items.map((it) => {
          const owned = s.me.owned.includes(it.id);
          const eq = s.me.avatar === it.id || s.me.frame === it.id;
          return h('div', { key: it.id, className: 'card', style: { padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } },
            it.kind === 'avatar' ? h(Face, { face: it.icon, size: 56 })
              : h('div', { className: 'av-ring', style: { background: it.css } }, h('div', { style: { width: 50, height: 50, borderRadius: '50%', background: 'var(--surface-2)' } })),
            h('div', { style: { fontWeight: 600, fontSize: 12.5, textAlign: 'center' } }, it.name),
            owned ? h('button', { className: cx('btn sm', eq ? 'blue' : 'ghost'), disabled: eq, style: { width: '100%' }, onClick: () => equip(it) }, eq ? 'Equipped' : 'Equip')
              : h('button', { className: 'btn gold sm', style: { width: '100%' }, disabled: s.me.coins < it.price, onClick: () => buy(it) }, '🪙 ' + it.price));
        })));
  };

  const SettingsSheet = ({ onClose, teacher, setTeacher, minimal, setMinimal, reset, size, setSize }) => {
    const [sure, setSure] = useState(false);
    return h(Sheet, { onClose },
    h('div', { className: 'h1', style: { marginBottom: 12 } }, 'Settings'),
    h('div', { className: 'list' },
      !STUDENT_ONLY && h('div', { className: 'item' }, h('div', { className: 'grow' }, h('div', { className: 't' }, 'Teacher view (demo)'), h('div', { className: 's' }, 'Approve homework, run battles and bosses')),
        h('button', { className: cx('switch', teacher && 'on'), role: 'switch', 'aria-checked': teacher, 'aria-label': 'Teacher view', onClick: () => setTeacher(!teacher) }, h('span'))),
      h('div', { className: 'item' }, h('div', { className: 'grow' }, h('div', { className: 't' }, 'Minimal mode'), h('div', { className: 's' }, 'Progress and stats with less game decoration')),
        h('button', { className: cx('switch', minimal && 'on'), role: 'switch', 'aria-checked': minimal, 'aria-label': 'Minimal mode', onClick: () => setMinimal(!minimal) }, h('span')))),
    h('div', { className: 'card', style: { marginTop: 12 } },
      h('div', { className: 't', style: { fontWeight: 600 } }, 'Group size (demo)'),
      h('div', { className: 'tiny muted', style: { margin: '2px 0 10px' } }, 'Try the battle with a small or big group. This restarts the demo.'),
      h('div', { className: 'pill-tabs', style: { flexWrap: 'wrap' } }, [2, 4, 8, 12, 16, 20].map((n) =>
        h('button', { key: n, className: size === n ? 'on' : '', onClick: () => setSize(n) }, n + ' students')))),
    sure
      ? h('div', { className: 'row', style: { marginTop: 14 } },
        h('button', { className: 'btn ghost grow', onClick: () => setSure(false) }, 'Cancel'),
        h('button', { className: 'btn gold grow', onClick: reset }, 'Yes, start over'))
      : h('button', { className: 'btn ghost block', style: { marginTop: 14 }, onClick: () => setSure(true) }, 'Reset demo'));
  };

  const WelcomeSheet = ({ onClose }) => h(Sheet, { onClose },
    h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 6 } }, h(Crest, { tone: 'green', crest: 'lion', size: 64 })),
    h('div', { className: 'h1', style: { textAlign: 'center' } }, 'Welcome to UpLingo Quest'),
    h('p', { className: 'muted', style: { textAlign: 'center', margin: '6px 0 14px' } }, 'You are Islom, a student in the Novza Lions. This week your group is battling the Chilonzor Dragons.'),
    h('div', { className: 'list' },
      [['list', 'Open Homework and finish your tasks. Mark each one and record the speaking task.'],
        ['swords', 'Press Attack. Your damage waits until your teacher checks the work.'],
        ['check', 'Ms. Nargiza checks it in a few seconds. The damage hits the Dragons and the unit boss.'],
        ['gift', 'A Full homework earns a chest. Open it on your Profile and spend coins in the Shop.']]
        .map(([ic, t], i) => h('div', { key: i, className: 'item' },
          h('div', { className: 'ck', style: { background: 'var(--gold-soft)', color: 'var(--gold)', fontWeight: 800 } }, i + 1),
          h('div', { className: 'grow', style: { fontSize: 13.5 } }, t)))),
    h('div', { className: 'tiny muted', style: { textAlign: 'center', marginTop: 10 } }, 'This is a prototype with sample data. Your progress stays in this browser.'),
    h('button', { className: 'btn gold block', style: { marginTop: 14 }, onClick: onClose }, 'Start'));

  // ---------------------------------------------------------------- teacher
  const TeacherVerify = ({ s, d, now, verify, returnSub }) => {
    const [stars, setStars] = useState({});
    const [crit, setCrit] = useState({});
    if (!d.pendingQueue.length) {
      return h('div', { className: 'card', style: { textAlign: 'center', padding: 24 } }, h('div', { style: { fontSize: 36 } }, '✅'), h('div', { className: 'h2', style: { marginTop: 8 } }, 'All caught up'),
        h('div', { className: 'tiny muted', style: { marginTop: 4 } }, 'Exit teacher view, attack with a homework as Islom, then approve it here to see the damage land.'));
    }
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, d.pendingQueue.map((sub) => {
      const hw = s.homeworks.find((x) => x.id === sub.hwId);
      const st = stars[sub.id] || 2;
      const isCrit = st === 3 || !!crit[sub.id];
      const dmg = G.calcDamage({ hw, statuses: sub.statuses, audio: sub.audio, submittedAt: sub.submittedAt, streak: sub.streak, stars: isCrit ? 3 : st, classSkill: sub.classSkill, earlyHours: sub.earlyHours });
      const fort = G.fortressDamage(dmg.total, d.myMax, d.enemyShield, hw);
      const m = s.myGuild.members.find((x) => x.id === sub.who);
      return h('div', { key: sub.id, className: 'card' },
        h('div', { className: 'row', style: { marginBottom: 10 } }, h(Face, { face: m.face, size: 40 }),
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 800 } }, m.name), h('div', { className: 'tiny muted' }, hw.title + ' · ' + ago(sub.submittedAt, now))),
          dmg.timing === 'early' && h(Badge, { k: 'b-gold' }, '⚡ Early'), dmg.timing === 'late' && h(Badge, { k: 'b-red' }, 'Late')),
        hw.tasks.map((t, i) => h('div', { key: i, className: 'row tiny', style: { padding: '6px 0', borderTop: '1px solid var(--border)' } },
          h('span', { className: 'grow' }, t.label),
          t.type === 'speaking' && (sub.audio[i] ? h('span', { style: { color: 'var(--green)' } }, '🎧 ' + sub.audio[i]) : h('span', { style: { color: 'var(--gold)' } }, 'no audio')),
          h(Badge, { k: { 'Full': 'b-green', '75%': 'b-gold', '50%': 'b-gold' }[sub.statuses[i]] || 'b-grey' }, sub.statuses[i]))),
        h('div', { className: 'row', style: { marginTop: 12 } },
          h('div', { className: 'stars grow' }, [1, 2, 3].map((n) => h('button', { key: n, className: n <= st ? 'on' : '', onClick: () => setStars((x) => ({ ...x, [sub.id]: n })), 'aria-label': n + ' stars' }, '⭐'))),
          h('label', { className: 'row tiny', style: { gap: 6, fontWeight: 700, color: isCrit ? 'var(--gold)' : 'var(--text-2)' } },
            h('input', { type: 'checkbox', checked: isCrit, disabled: st === 3, onChange: (e) => setCrit((x) => ({ ...x, [sub.id]: e.target.checked })) }), '💥 Critical Hit')),
        h('div', { className: 'row', style: { marginTop: 12 } },
          h('button', { className: 'btn ghost sm', onClick: () => returnSub(sub) }, 'Send back'),
          h('button', { className: 'btn gold grow', onClick: () => verify(sub, isCrit ? 3 : st) }, 'Approve · ' + fort + ' damage')));
    }));
  };

  const TeacherBattles = ({ s, d, setMatch, flash }) => {
    const [pick, setPick] = useState(s.battle.otherGroups[0].id);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h(BattleCard, { s, d, compact: true, onView: () => flash('Students see the full battle screen', '👀') }),
      h('div', { className: 'card' },
        h('div', { style: { fontWeight: 700, marginBottom: 10 } }, 'Next week\'s matchup'),
        h('div', { className: 'pill-tabs', style: { marginBottom: 12 } },
          h('button', { className: s.battle.matchMode === 'auto' ? 'on' : '', onClick: () => setMatch('auto') }, 'Auto · same level'),
          h('button', { className: s.battle.matchMode === 'manual' ? 'on' : '', onClick: () => setMatch('manual') }, 'I choose')),
        s.battle.matchMode === 'auto'
          ? h('div', { className: 'tiny muted' }, 'Battles start every Monday 08:00 against a group of the same level. Scores are adjusted for group size.')
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('div', { className: 'list' }, s.battle.otherGroups.map((g) => h('button', { key: g.id, className: cx('item', pick === g.id && 'hl'), onClick: () => setPick(g.id) },
              h(Crest, { tone: 'red', crest: g.crest, size: 32, spikes: false }),
              h('div', { className: 'grow' }, h('div', { className: 't' }, g.name), h('div', { className: 's' }, g.teacher + ' · ' + g.members + ' students')),
              h(Badge, { k: g.level === s.myGuild.level ? 'b-green' : 'b-gold' }, g.level)))),
            h('button', { className: 'btn gold block', onClick: () => flash('📅 Next battle set vs ' + s.battle.otherGroups.find((g) => g.id === pick).name) }, 'Schedule for Monday'))));
  };

  const TeacherBosses = ({ s, now, addBoss }) => {
    const [unit, setUnit] = useState(7);
    const [name, setName] = useState('');
    const [hp, setHp] = useState(G.BOSS_HP_PER_MEMBER * s.myGuild.members.length);
    const [days, setDays] = useState(21);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { className: 'list' }, s.bosses.slice().sort((a, b) => a.unit - b.unit).map((b) => h('div', { key: b.unit + b.name, className: 'item' },
        h(Crest, { tone: b.defeated ? 'green' : 'purple', icon: b.icon, size: 36, rim: 'gold', spikes: false }),
        h('div', { className: 'grow' }, h('div', { className: 't' }, b.name), h('div', { className: 's' }, 'Unit ' + b.unit + ' · ' + fmt(b.hp) + ' HP · ' + (b.defeated ? 'defeated' : fmtLeft(b.deadline - now) + ' left'))),
        h('span', { className: 'num' }, pct(b.hp - b.dealt, b.hp) + '%')))),
      h('div', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h('div', { className: 'h2' }, 'Create a boss'),
        h('div', { className: 'row' },
          h('label', { className: 'tiny muted grow' }, 'Unit', h('input', { className: 'field', type: 'number', min: 1, value: unit, onChange: (e) => setUnit(+e.target.value) })),
          h('label', { className: 'tiny muted grow' }, 'HP', h('input', { className: 'field', type: 'number', min: 100, step: 100, value: hp, onChange: (e) => setHp(+e.target.value) }))),
        h('label', { className: 'tiny muted' }, 'Name (after the unit topic)', h('input', { className: 'field', placeholder: 'e.g. The Passive Voice Phantom', value: name, onChange: (e) => setName(e.target.value) })),
        h('label', { className: 'tiny muted' }, 'Deadline in days', h('input', { className: 'field', type: 'number', min: 1, value: days, onChange: (e) => setDays(+e.target.value) })),
        h('div', { className: 'tiny muted' }, 'Suggested HP: ' + G.BOSS_HP_PER_MEMBER + ' × ' + s.myGuild.members.length + ' students = ' + fmt(G.BOSS_HP_PER_MEMBER * s.myGuild.members.length)),
        h('button', { className: 'btn gold block', disabled: !name.trim() || hp < 100, onClick: () => { addBoss({ unit, name: name.trim(), icon: 'ogre', hp, dealt: 0, deadline: now + days * 86400000 }); setName(''); } }, 'Create boss')));
  };

  // Homework builder: one homework per class, i.e. two lessons from the group's coursebook.
  const TYPE_OPTS = ['vocab', 'grammar', 'listening', 'reading', 'speaking', 'writing'];
  const TeacherHomework = ({ s, now, addHomework }) => {
    const Cs = window.Courses;
    const course = Cs.COURSES[s.myGuild.course];
    const [unit, setUnit] = useState(Math.min(course.units.length, Math.max(1, ...s.homeworks.map((x) => x.unit))));
    const sessions = Cs.sessionsOf(course, unit);
    const taken = new Set(s.homeworks.filter((x) => x.unit === unit).map((x) => x.label));
    const firstFree = Math.max(0, sessions.findIndex((x) => !taken.has(x.label)));
    const [ses, setSes] = useState(firstFree);
    const [tasks, setTasks] = useState(() => Cs.defaultTasks(course, unit, sessions[firstFree].lessons));
    const [days, setDays] = useState(2);
    const pick = (u, i) => {
      const list = Cs.sessionsOf(course, u);
      setUnit(u); setSes(i); setTasks(Cs.defaultTasks(course, u, list[i].lessons));
    };
    const cur = sessions[ses];
    const maxPts = tasks.reduce((a, t) => a + (G.DAMAGE[t.type] || 0), 0) + G.FULL_BONUS;
    const upcoming = s.homeworks.filter((x) => x.dueAt > now).sort((a, b) => a.dueAt - b.dueAt);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { className: 'card' },
        h('div', { className: 'eyebrow' }, s.myGuild.name + ' · ' + s.myGuild.members.length + ' students'),
        h('div', { className: 'h2', style: { marginTop: 4 } }, course.book + ' ' + course.level + ' (' + course.cefr + ')')),
      h('div', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('label', { className: 'tiny muted', htmlFor: 'hw-unit' }, 'Unit',
          h('select', { id: 'hw-unit', className: 'field', value: unit, onChange: (e) => pick(+e.target.value, 0), style: { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-hi)', borderRadius: 12, padding: '11px 12px', marginTop: 4 } },
            course.units.map((t, i) => h('option', { key: i, value: i + 1 }, 'Unit ' + (i + 1) + (t ? ' · ' + t : ''))))),
        h('div', null,
          h('div', { className: 'tiny muted', style: { marginBottom: 6 } }, 'Class (two lessons)'),
          h('div', { className: 'pill-tabs', style: { flexWrap: 'wrap' } }, sessions.map((x, i) =>
            h('button', { key: x.label, className: ses === i ? 'on' : '', onClick: () => pick(unit, i) }, x.label + (taken.has(x.label) ? ' ✓' : ''))))),
        h('div', { className: 'tiny muted' }, cur.lessons.map((l, i) => cur.codes[i] + ' ' + l.skill).join(' · ')),
        h('div', { className: 'list' }, tasks.map((t, i) => h('div', { key: i, className: 'item', style: { flexWrap: 'wrap', gap: 8, alignItems: 'stretch' } },
          h('input', { id: 'hw-task-' + i, className: 'field', style: { flex: '1 1 100%', marginTop: 0 }, value: t.label, 'aria-label': 'Task ' + (i + 1),
            onChange: (e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))) }),
          h('select', { id: 'hw-type-' + i, value: t.type, 'aria-label': 'Task type', onChange: (e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, type: e.target.value } : x))),
            style: { flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-hi)', borderRadius: 10, padding: '9px 8px', color: 'var(--text)' } },
            TYPE_OPTS.map((o) => h('option', { key: o, value: o }, o + ' · ' + G.DAMAGE[o]))),
          h('button', { className: 'btn ghost sm', 'aria-label': 'Remove task', onClick: () => setTasks(tasks.filter((_, j) => j !== i)) }, '✕')))),
        h('button', { className: 'btn ghost sm', onClick: () => setTasks([...tasks, { label: 'Extra task', type: 'grammar' }]) }, '+ Add task'),
        h('label', { className: 'tiny muted', htmlFor: 'hw-days' }, 'Due in days (next class)',
          h('input', { id: 'hw-days', className: 'field', type: 'number', min: 1, max: 14, value: days, onChange: (e) => setDays(Math.max(1, +e.target.value || 1)) })),
        h('div', { className: 'tiny muted' }, 'Up to ' + maxPts + ' points per student when everything is Full · speaking needs a recording'),
        h('button', { className: 'btn gold block', disabled: !tasks.length || tasks.some((t) => !t.label.trim()), onClick: () => {
          addHomework({ id: course.id + '-u' + unit + '-' + cur.codes.join('') + '-' + Date.now().toString(36), course: course.id, unit, idx: ses + 1,
            label: cur.label, title: cur.title, codes: cur.codes, dueAt: now + days * 86400000, tasks: tasks.map((t) => ({ label: t.label.trim(), type: t.type })) });
          pick(unit, Math.min(ses + 1, sessions.length - 1));
        } }, 'Give homework ' + cur.label)),
      h(SectionHead, { title: 'Upcoming homework' }),
      h('div', { className: 'list' }, upcoming.length ? upcoming.map((x) => h('div', { key: x.id, className: 'item' },
        h('div', { className: 'grow' }, h('div', { className: 't' }, x.label + ' · ' + x.title), h('div', { className: 's' }, x.tasks.length + ' tasks · due in ' + fmtLeft(x.dueAt - now))))) : h('div', { className: 'item muted' }, 'None yet')));
  };

  const TeacherClass = ({ s, d }) => {
    const rows = s.myGuild.members.map((m) => {
      const lesson = m.me ? d.lessonIdx + 1 : m.lesson;
      const at = d.unitHws[Math.min(lesson, d.unitHws.length) - 1];
      return { m, lesson, at, behind: m.week === 0 };
    }).sort((a, b) => (b.behind ? 1 : 0) - (a.behind ? 1 : 0) || a.m.week - b.m.week);
    const pop = s.sideQuests.map((q, i) => ({ q, n: [14, 9, 6, 11][i] + (s.me.sideDone.includes(q.id) ? 1 : 0) }));
    const max = Math.max(...pop.map((p) => p.n));
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { className: 'card tiny', style: { color: 'var(--blue-hi)', borderColor: 'rgba(47,128,255,0.35)' } }, '🔒 Only you can see this. Students only ever see counts, never names.'),
      h('div', { className: 'list' }, rows.map(({ m, at, behind }) => h('div', { key: m.id, className: 'item' },
        h(Face, { face: m.face, size: 34 }),
        h('div', { className: 'grow' }, h('div', { className: 't' }, m.name), h('div', { className: 's' }, 'At ' + (at ? at.label : '—') + ' · ' + fmt(m.week) + ' points this week')),
        behind ? h(Badge, { k: 'b-red' }, 'Needs help') : h(Badge, { k: 'b-green' }, 'Active')))),
      h(SectionHead, { title: 'Popular extra quests' }),
      h('div', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: 10 } }, pop.map(({ q, n }) => h('div', { key: q.id },
        h('div', { className: 'row tiny', style: { marginBottom: 4 } }, h('span', { className: 'grow' }, q.icon + ' ' + q.title), h('span', { className: 'num' }, n)),
        h(Bar, { value: n, max, color: q.color })))));
  };

  // ---------------------------------------------------------------- app
  const App = () => {
    const [s, setS] = useState(loadState);
    const [now, setNow] = useState(Date.now());
    const [tab, setTab] = useState('home');
    const [ttab, setTtab] = useState('verify');
    const [teacher, setTeacher] = useState(() => !STUDENT_ONLY && loadPref('uq-teacher', false));
    const [minimal, setMinimal] = useState(() => loadPref('uq-minimal', false));
    const [battleOpen, setBattleOpen] = useState(false);
    const [hwSel, setHwSel] = useState(null);
    const [sheet, setSheet] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [boom, setBoom] = useState(null);
    const [fresh, setFresh] = useState(null);
    const sRef = useRef(s);
    sRef.current = s;

    useEffect(() => saveState(s), [s]);
    useEffect(() => savePref('uq-teacher', teacher), [teacher]);
    useEffect(() => savePref('uq-minimal', minimal), [minimal]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [tab, ttab, teacher, battleOpen]);
    // Student prototype: a short guide on first open, and teammates' pending work gets checked over time.
    useEffect(() => {
      if (!STUDENT_ONLY) return undefined;
      if (!loadPref('uq-welcomed', false)) setSheet({ kind: 'welcome' });
      const timers = [30000, 75000].map((ms) => setTimeout(() => {
        const sub = sRef.current.submissions.find((x) => x.state === 'pending' && x.who !== sRef.current.me.id);
        if (sub) verify(sub, sub.statuses.every((v) => v === 'Full') ? 3 : 2);
      }, ms));
      return () => timers.forEach(clearTimeout);
    }, []);

    const d = useMemo(() => derive(s, now), [s, now]);
    const flash = (text, icon = '✨') => {
      const id = uid();
      setToasts((t) => [...t, { id, text, icon }].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    };
    const pop = (n, label, crit) => { setBoom({ n, label, crit, k: uid() }); setTimeout(() => setBoom(null), 1400); };
    const up = (fn) => setS((prev) => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next; });
    const close = () => setSheet(null);

    // Push-style notifications: counts only, never names.
    const notifs = [];
    if (d.notAttacked > 0) notifs.push({ icon: 'bell', text: 'Your fortress has ' + pct(d.usHP, G.FORTRESS_HP) + '% HP and ' + fmtLeft(d.battleLeft) + ' to go. ' + d.notAttacked + ' teammates haven\'t attacked yet.' });
    if (d.nextHw && !s.me.submitted[d.nextHw.id]) notifs.push({ icon: '⚡', text: d.nextHw.label + ' (' + d.nextHw.title + ') is due in ' + fmtLeft(d.nextHw.dueAt - now) + '. Submit 24h early for an Early Strike (×1.5).' });
    if (d.liveBoss) notifs.push({ icon: d.liveBoss.icon, text: d.liveBoss.name + ' has ' + pct(d.liveBoss.hp - d.liveBoss.dealt, d.liveBoss.hp) + '% HP left.' });
    if (s.me.chests > 0) notifs.push({ icon: 'gift', text: 'You have a chest to open on your profile.' });

    // Live battle: the other guild keeps attacking while the app is open.
    useEffect(() => {
      const t = setInterval(() => {
        const cur = sRef.current;
        const dd = derive(cur, Date.now());
        if (dd.usHP < 600 || dd.battleLeft <= 0) return;
        const enemy = cur.battle.enemy;
        const m = enemy.members[Math.floor(Math.random() * enemy.members.length)];
        const pick = [['6C + 6D', 40], ['6E + 6F', 40], ['6G + 6H', 75]][Math.floor(Math.random() * 3)];
        const crit = Math.random() < 0.15;
        const raw = Math.round(pick[1] * (0.5 + Math.random() * 0.5) * (crit ? 1.6 : 1));
        const dmg = G.fortressDamage(raw, dd.enemyMax, dd.myShield);
        const id = uid();
        up((n) => {
          n.feed.push({ id, at: Date.now(), side: 'enemy', who: m.name, what: 'completed ' + pick[0], dmg, crit });
          if (!n.battle.enemy.attackers.includes(m.id)) n.battle.enemy.attackers.push(m.id);
        });
        setFresh(id);
        flash(m.name + ' (Dragons) hit your fortress for ' + dmg, crit ? '💥' : '⚔️');
      }, 45000);
      return () => clearInterval(t);
    }, []);

    // ---------- student actions
    const setStatus = (hwId, i, st) => up((n) => {
      const hw = n.homeworks.find((x) => x.id === hwId);
      n.me.tasks[hwId] = n.me.tasks[hwId] || hw.tasks.map(() => 'Not started');
      n.me.tasks[hwId][i] = st;
    });
    const setAudio = (hwId, i, a) => up((n) => { n.me.audio[hwId] = { ...(n.me.audio[hwId] || {}), [i]: a }; });
    const submit = (hw, statuses, audio, est, fortress) => {
      const id = uid(), sid = uid();
      up((n) => {
        n.me.submitted[hw.id] = 'pending';
        n.submissions.push({ id: sid, who: n.me.id, whoName: n.me.name, hwId: hw.id, statuses, audio, submittedAt: Date.now(), streak: n.me.streak, state: 'pending', feedId: id,
          classSkill: heroOf(n).skill, earlyHours: n.me.scoutReady ? 12 : undefined });
        n.me.scoutReady = false;
        n.feed.push({ id, at: Date.now(), side: 'us', who: n.me.name, what: 'completed ' + hw.label + (est.allFull ? ' · full homework' : ''), dmg: fortress, pending: true, early: est.timing === 'early' });
      });
      setFresh(id);
      pop(fortress, '⏳ Pending · lands when your teacher checks it');
      if (STUDENT_ONLY) {
        flash('Attack sent! Ms. Nargiza will check your homework in a moment.', '⚔️');
        setTimeout(() => flash('Ms. Nargiza is checking your homework…', '👀'), 3500);
        setTimeout(() => {
          const sub = sRef.current.submissions.find((x) => x.id === sid);
          if (sub && sub.state === 'pending') verify(sub, est.allFull ? 3 : 2);
        }, 8000);
      } else flash('Attack sent! To approve it: Profile → ⚙️ → Teacher view.', '⚔️');
    };
    // Hero abilities: once per battle each.
    const useAbility = () => {
      const cur = sRef.current;
      if (cur.me.abilityUsed === cur.battle.startedAt) return;
      const hero = heroOf(cur);
      const dd = derive(cur, Date.now());
      const id = uid();
      up((n) => {
        n.me.abilityUsed = n.battle.startedAt;
        const k = hero.ability.key;
        if (k === 'storm') n.feed.push({ id, at: Date.now(), side: 'us', who: n.me.name, what: 'cast Word Storm', dmg: G.fortressDamage(15, dd.myMax, dd.enemyShield), quest: true });
        if (k === 'wall' || k === 'rally') n.battle.shieldBonus = (n.battle.shieldBonus || 0) + 0.05;
        if (k === 'scout') n.me.scoutReady = true;
        if (k === 'wisdom') { const e = new Date(); e.setHours(23, 59, 59, 999); n.me.wisdomUntil = e.getTime(); }
        if (k === 'seal') n.me.freezes += 1;
      });
      const msg = {
        storm: 'Word Storm hit the Dragons!', wall: 'Shield Wall raised: +5% guild shield', scout: 'Echo Scout ready: Early Strike from 12h before the deadline',
        wisdom: 'Wisdom Aura: extra quests give double coins today', rally: 'Rally Cry sent to ' + dd.notAttacked + ' teammates · +5% guild shield', seal: 'Ink Seal: you got a free Streak Freeze',
      }[hero.ability.key];
      if (hero.ability.key === 'storm') setFresh(id);
      flash(msg, '✨');
    };

    const completeQuest = (q) => {
      const rewarded = sRef.current.me.sideToday < G.SIDE_QUEST_DAILY_CAP;
      const dmg = rewarded ? G.fortressDamage(G.SIDE_QUEST_DAMAGE, d.myMax, d.enemyShield) : 0;
      const id = uid();
      up((n) => {
        n.me.sideDone.push(q.id);
        if (rewarded) {
          n.me.sideToday += 1; n.me.coins += q.coins * (Date.now() < (n.me.wisdomUntil || 0) ? 2 : 1); n.me.xp += q.xp;
          n.feed.push({ id, at: Date.now(), side: 'us', who: n.me.name, what: 'finished an extra quest', dmg, quest: true });
          const meM = n.myGuild.members.find((m) => m.me); meM.week += G.SIDE_QUEST_DAMAGE; n.me.totalDamage += G.SIDE_QUEST_DAMAGE;
        }
      });
      if (rewarded) { setFresh(id); flash('+' + q.coins + ' coins · +' + q.xp + ' XP · ' + dmg + ' bonus damage', '🪙'); } else flash('Quest done — daily reward cap reached', '✔');
    };
    const buy = (it) => {
      if (s.me.coins < it.price) return;
      up((n) => {
        n.me.coins -= it.price;
        if (it.id === 'freeze') n.me.freezes += 1;
        else if (it.id === 'charm') n.me.charmUsed = true;
        else { n.me.owned.push(it.id); if (it.kind === 'avatar') n.me.avatar = it.id; else n.me.frame = it.id; }
      });
      flash(it.name + (it.kind === 'consumable' ? ' added' : ' unlocked & equipped'), '🛍️');
    };
    const equip = (it) => up((n) => { if (it.kind === 'avatar') n.me.avatar = it.id; else n.me.frame = it.id; });
    const openChest = () => {
      const lockedItems = s.shop.filter((x) => (x.kind === 'avatar' || x.kind === 'frame') && !s.me.owned.includes(x.id));
      const win = Math.random() < 0.6 && lockedItems.length ? lockedItems[Math.floor(Math.random() * lockedItems.length)] : null;
      const coins = 30 + Math.floor(Math.random() * 4) * 10;
      up((n) => { n.me.chests -= 1; if (win) n.me.owned.push(win.id); else n.me.coins += coins; });
      setSheet({ kind: 'chest', reward: win ? { icon: win.icon || 'gem', label: (win.kind === 'avatar' ? 'Avatar · ' : 'Frame · ') + win.name } : { icon: 'coin', label: coins + ' coins' } });
    };

    // ---------- teacher actions
    const verify = (sub, stars) => {
      const cur = sRef.current;
      const hw = cur.homeworks.find((x) => x.id === sub.hwId);
      const dmg = G.calcDamage({ hw, statuses: sub.statuses, audio: sub.audio, submittedAt: sub.submittedAt, streak: sub.streak, stars, classSkill: sub.classSkill, earlyHours: sub.earlyHours });
      const dd0 = derive(cur, Date.now());
      const fort = G.fortressDamage(dmg.total, dd0.myMax, dd0.enemyShield, hw);
      const isMe = sub.who === cur.me.id;
      const feedId = sub.feedId || uid();
      let defeated = null;
      up((n) => {
        const x = n.submissions.find((y) => y.id === sub.id);
        x.state = 'verified'; x.stars = stars; x.dmg = fort;
        const entry = { id: feedId, at: Date.now(), side: 'us', who: sub.whoName, what: 'completed ' + hw.label + (dmg.allFull ? ' · full homework' : ''), dmg: fort, crit: dmg.crit, early: dmg.timing === 'early' };
        const f = n.feed.find((y) => y.id === feedId);
        if (f) Object.assign(f, entry, { pending: false }); else n.feed.push(entry);
        const member = n.myGuild.members.find((m) => m.id === sub.who);
        if (member) { member.week += dmg.total; if (!member.me && member.lesson === hw.idx) member.lesson += 1; }
        const boss = n.bosses.find((b) => b.unit === hw.unit && !b.defeated);
        if (boss) {
          boss.dealt = Math.min(boss.hp, boss.dealt + dmg.total);
          boss.contrib = boss.contrib || {};
          boss.contrib[sub.who] = (boss.contrib[sub.who] || 0) + dmg.total;
          if (boss.dealt >= boss.hp) { boss.defeated = true; defeated = boss.name; if (isMe && !n.me.titles.includes('Raid Breaker')) n.me.titles.push('Raid Breaker'); }
        }
        if (isMe) {
          n.me.submitted[hw.id] = 'verified';
          n.me.totalDamage += dmg.total;
          n.me.skills = n.me.skills || {};
          hw.tasks.forEach((t, i) => { n.me.skills[t.type] = (n.me.skills[t.type] || 0) + (G.SKILL_GAIN[sub.statuses[i]] || 0); });
          n.me.xp += Math.round(dmg.total / 2);
          n.me.coins += 10 + (dmg.crit ? 15 : 0);
          n.me.seasonPts += dmg.total;
          if (dmg.crit) n.me.crits = (n.me.crits || 0) + 1;
          if (dmg.allFull) {
            n.me.chests += 1; n.me.fullCount += 1; n.me.streak += 1;
            const gap = n.me.week.indexOf(0);
            if (gap >= 0) n.me.week[gap] = 1;
          }
          if (dmg.timing === 'early') n.me.earlyCount += sub.statuses.filter(isMarked).length;
          if (hw.tasks.some((t, i) => t.type === 'speaking' && sub.audio[i])) {
            n.me.speakingCount += 1;
            if (n.me.speakingCount >= 5 && !n.me.titles.includes('Speaking Specialist')) n.me.titles.push('Speaking Specialist');
          }
        }
      });
      setFresh(feedId);
      pop(fort, dmg.crit ? '💥 Critical Hit!' : 'Damage landed on the Dragons', dmg.crit);
      flash(sub.whoName + '\'s homework approved — ' + fort + ' damage landed' + (dmg.allFull && isMe ? ' · 🎁 chest earned' : ''), '✅');
      if (defeated) setTimeout(() => flash(defeated + ' is defeated! The next unit is unlocked 🗺️', '🏆'), 1500);
    };
    const returnSub = (sub) => {
      up((n) => {
        n.submissions = n.submissions.filter((x) => x.id !== sub.id);
        if (sub.feedId) n.feed = n.feed.filter((f) => f.id !== sub.feedId);
        if (sub.who === n.me.id) delete n.me.submitted[sub.hwId];
      });
      flash('Sent back to ' + sub.whoName + ' to improve — no damage this time', '↩️');
    };
    const reset = () => {
      setS(G.seed(Date.now(), { size: s.groupSize })); setTab('home'); setTeacher(false); setSheet(null); setBattleOpen(false);
      flash('Demo reset', '↺');
    };

    const go = (k) => { setBattleOpen(false); setTab(k); };
    const openTask = (hwId, idx) => setSheet({ kind: 'task', hwId, idx });
    const studentTabs = [['home', 'home', 'Home'], ['map', 'map', 'Map'], ['homework', 'list', 'Homework'], ['guild', 'guild', 'Guild'], ['profile', 'user', 'Profile']];
    const teacherTabs = [['verify', 'check', 'Approve'], ['homework', 'list', 'Homework'], ['battles', 'swords', 'Battles'], ['bosses', 'guild', 'Bosses'], ['class', 'user', 'Class']];

    let main;
    if (teacher) {
      main = h('div', null,
        h('header', { className: 'topbar' },
          h(Crest, { tone: 'green', crest: 'lion', size: 30, spikes: false }),
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 800 } }, { verify: 'Approve homework', homework: 'Give homework', battles: 'Battles', bosses: 'Bosses', class: 'Class' }[ttab]), h('div', { className: 'tiny muted' }, 'Teacher · ' + s.myGuild.teacher + ' · ' + s.myGuild.name)),
          h('button', { className: 'btn outline-gold', onClick: () => setTeacher(false) }, 'Exit')),
        h('div', { className: 'page' },
          ttab === 'verify' && h(TeacherVerify, { s, d, now, verify, returnSub }),
          ttab === 'homework' && h(TeacherHomework, { s, now, addHomework: (hw) => {
            up((n) => { n.homeworks.push(hw); n.homeworks.sort((a, b) => a.unit - b.unit || a.idx - b.idx || a.dueAt - b.dueAt); });
            flash('Homework ' + hw.label + ' sent to ' + s.myGuild.members.length + ' students', '📚'); } }),
          ttab === 'battles' && h(TeacherBattles, { s, d, setMatch: (m) => up((n) => { n.battle.matchMode = m; }), flash }),
          ttab === 'bosses' && h(TeacherBosses, { s, now, addBoss: (b) => { up((n) => { n.bosses.push(b); }); flash('Boss created: ' + b.name, '👹'); } }),
          ttab === 'class' && h(TeacherClass, { s, d })));
    } else if (battleOpen) {
      main = h(BattleScreen, { s, d, now, fresh, back: () => setBattleOpen(false), openRules: () => setSheet({ kind: 'rules' }) });
    } else {
      main = h('main', null,
        tab === 'home' && h(HomeScreen, { s, d, openTask, openBattle: () => setBattleOpen(true), openNotifs: () => setSheet({ kind: 'notifs' }), notifCount: notifs.length, openHero: () => setSheet({ kind: 'hero' }), go, useAbility }),
        tab === 'map' && h(MapScreen, { s, d, openHw: (id) => { setHwSel(id); go('homework'); }, goHomework: () => { setHwSel(null); go('homework'); },
          openLocked: () => setSheet({ kind: 'locked' }), openRaid: () => go('guild'), openInfo: () => setSheet({ kind: 'mapinfo' }) }),
        tab === 'homework' && h(HomeworkScreen, { s, d, now, hwSel, setHwSel, openTask, openQuests: () => setSheet({ kind: 'quests' }), submit }),
        tab === 'guild' && h(GuildScreen, { s, d, now, openBattle: () => setBattleOpen(true), toggleDuel: () => up((n) => { n.me.duel = !n.me.duel; }) }),
        tab === 'profile' && h(ProfileScreen, { s, d, openSettings: () => setSheet({ kind: 'settings' }), openShop: () => setSheet({ kind: 'shop' }), openChest,
          openAch: () => setSheet({ kind: 'ach' }), setTitle: (t) => up((n) => { n.me.title = t; }) }));
    }

    const tabs = teacher ? teacherTabs : studentTabs;
    const S = sheet || {};
    return h('div', { className: cx('shell', minimal && 'minimal') },
      main,
      h('nav', { className: 'tabbar' },
        tabs.map(([k, icon, label]) => {
          const on = teacher ? ttab === k : tab === k;
          const dot = (teacher && k === 'verify' && d.pendingQueue.length > 0) || (!teacher && k === 'profile' && s.me.chests > 0);
          const solid = on && ['home', 'map', 'list', 'guild', 'user'].includes(icon);
          return h('button', { key: k, className: cx('tab', on && 'on'), onClick: () => (teacher ? setTtab(k) : go(k)), 'aria-current': on ? 'page' : undefined },
            h(Icon, { n: icon, s: 24, fill: solid ? 'currentColor' : 'none', w: 2 }), label, dot && h('span', { className: 'dot' }));
        })),
      S.kind === 'task' && h(TaskSheet, { s, hwId: S.hwId, idx: S.idx, onClose: close, setStatus, setAudio }),
      S.kind === 'rules' && h(RulesSheet, { onClose: close }),
      S.kind === 'hero' && h(HeroSheet, { s, onClose: close, setHero: (hero) => { up((n) => { n.me.hero = hero; }); flash('You are now playing as the ' + G.HEROES.find((x) => x.key === hero.cls).name, '🛡️'); } }),
      S.kind === 'notifs' && h(NotifSheet, { items: notifs, onClose: close }),
      S.kind === 'quests' && h(QuestLibrary, { s, onClose: close, openQuest: (id) => setSheet({ kind: 'quest', id }) }),
      S.kind === 'quest' && h(QuestSheet, { key: S.id, s, qId: S.id, onClose: () => setSheet({ kind: 'quests' }), complete: completeQuest }),
      S.kind === 'shop' && h(ShopSheet, { s, onClose: close, buy, equip }),
      S.kind === 'welcome' && h(WelcomeSheet, { onClose: () => { savePref('uq-welcomed', true); close(); } }),
      S.kind === 'settings' && h(SettingsSheet, { onClose: close, teacher, setTeacher: (v) => { setTeacher(v); close(); }, minimal, setMinimal, reset,
        size: s.groupSize, setSize: (n) => { setS(G.seed(Date.now(), { size: n })); close(); setTab('home'); setBattleOpen(false); flash('Demo restarted with ' + n + ' students in your group', '👥'); } }),
      S.kind === 'ach' && h(Sheet, { onClose: close }, h('div', { className: 'h1', style: { marginBottom: 12 } }, 'Achievements'), h('div', { className: 'ach-grid' }, ACH.map((a) => h(Medal, { key: a.k, a, me: s.me })))),
      S.kind === 'chest' && h(InfoSheet, { onClose: close, icon: h(Emo, { v: S.reward.icon, size: 96 }), title: S.reward.label, body: 'From your Full homework chest.' }),
      S.kind === 'locked' && h(InfoSheet, { onClose: close, icon: h(Crest, { tone: 'grey', icon: 'lock', size: 70, spikes: false }),
        title: 'Unit ' + (d.currentUnit + 1) + ' is locked', body: 'It opens when your guild defeats ' + (d.liveBoss ? d.liveBoss.name : 'the boss') + '. Every homework in Unit ' + d.currentUnit + ' brings it closer.' }),
      S.kind === 'mapinfo' && h(InfoSheet, { onClose: close, icon: h(Emo, { v: 'map', size: 80 }), title: 'Your journey',
        body: 'Each unit is a region and each lesson\'s homework is a stop on the road. Your classmates move forward as they finish homework. Beat the unit boss together to unlock the next region.' }),
      h('div', { className: 'toasts', 'aria-live': 'polite' }, toasts.map((t) => h('div', { key: t.id, className: 'toast' }, h('span', { style: { fontSize: 18 } }, t.icon), h('span', null, t.text)))),
      boom && h('div', { className: 'boom', key: boom.k }, h('div', { className: cx('n', boom.crit && 'crit') }, '−' + boom.n), h('div', { className: 't', style: { color: boom.crit ? 'var(--gold)' : 'var(--text)' } }, boom.label)));
  };

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
