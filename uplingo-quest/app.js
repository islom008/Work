// UpLingo Quest · UI. Plain React (no JSX / no build step), like UpLingo.
(function () {
  'use strict';
  const { useState, useEffect, useMemo, useRef } = React;
  const h = React.createElement;
  const G = window.Game;

  // ---------------------------------------------------------------- storage
  const STORE = 'uplingo-quest-v1';
  const loadState = () => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      // A battle that ended while the demo was closed starts a fresh demo week.
      if (s && s.version === 1 && Date.now() < s.battle.endsAt) return s;
    } catch (e) { /* storage blocked: fall through to a fresh seed */ }
    return G.seed();
  };
  const saveState = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  const loadPref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const savePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  // ---------------------------------------------------------------- helpers
  const cx = (...a) => a.filter(Boolean).join(' ');
  const initials = (n) => n.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const firstName = (n) => n.split(' ')[0];
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtCountdown = (ms) => {
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 86400000), hh = Math.floor((abs % 86400000) / 3600000), m = Math.floor((abs % 3600000) / 60000);
    if (d >= 1) return `${d}d ${hh}h`;
    if (hh >= 1) return `${hh}h ${m}m`;
    return `${m}m`;
  };
  const fmtClock = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (d ? d + 'd ' : '') + pad2(hh) + ':' + pad2(m) + ':' + pad2(sec);
  };
  const ago = (t, now) => {
    const ms = now - t;
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
    return Math.floor(ms / 86400000) + 'd ago';
  };
  const TYPE_BADGE = { grammar: 'b-blue', vocab: 'b-yellow', writing: 'b-orange', speaking: 'b-lime', listening: 'b-purple', reading: 'b-teal' };
  const SEG_CLS = { 'Full': 'on-full', '75%': 'on-most', '50%': 'on-half', 'Not full': 'on-notfull' };
  const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / b) * 100)));

  // Everything the screens derive from state, computed once per render.
  const derive = (s, now) => {
    const { myGuild, battle, feed, homeworks, bosses, me } = s;
    const enemy = battle.enemy;
    const myShield = G.shieldPct(myGuild.attackers.length, myGuild.members.length, me.charmUsed ? 0.05 : 0);
    const enemyShield = G.shieldPct(enemy.attackers.length, enemy.members.length);
    const landed = (side) => feed.filter((f) => f.side === side && !f.pending).reduce((a, f) => a + f.dmg, 0);
    const usHP = Math.max(0, G.FORTRESS_HP - landed('enemy'));
    const enemyHP = Math.max(0, G.FORTRESS_HP - landed('us'));
    const pendingOnEnemy = feed.filter((f) => f.side === 'us' && f.pending).reduce((a, f) => a + f.dmg, 0);
    const notAttacked = myGuild.members.filter((m) => !myGuild.attackers.includes(m.id)).length;
    const liveBoss = bosses.filter((b) => !b.defeated).sort((a, b) => a.unit - b.unit)[0] || null;
    const currentUnit = liveBoss ? liveBoss.unit : Infinity;
    const locked = (hw) => hw.unit > currentUnit;
    let myStop = homeworks.findIndex((hw) => !me.submitted[hw.id]);
    if (myStop < 0) myStop = homeworks.length - 1;
    const nextHw = homeworks.find((hw) => !me.submitted[hw.id] && !locked(hw)) || null;
    const lvl = G.levelProgress(me.xp);
    const rank = G.rankFor(me.seasonPts);
    const pendingQueue = s.submissions.filter((x) => x.state === 'pending');
    return { enemy, myShield, enemyShield, usHP, enemyHP, pendingOnEnemy, notAttacked, liveBoss, currentUnit, locked, myStop, nextHw, lvl, rank, pendingQueue, battleLeft: battle.endsAt - now };
  };

  // ---------------------------------------------------------------- small UI
  const Clay = ({ icon, color, size, round, style }) => h('div', { className: cx('clay', size, round && 'round'), style: { '--c': color, ...style } }, icon);
  const Badge = ({ k, children }) => h('span', { className: cx('badge', k) }, children);
  const HP = ({ value, max, color, pending = 0, size }) => h('div', { className: cx('hp', size) },
    h('i', { style: { width: pct(value, max) + '%', background: color } }),
    pending > 0 && h('i', { className: 'pending', style: { left: pct(Math.max(0, value - pending), max) + '%', width: pct(Math.min(pending, value), max) + '%' } }));
  const PersonAv = ({ p, size = 34 }) => h('div', { className: 'av', style: { background: p.bg, width: size, height: size, fontSize: size * 0.36 } }, initials(p.name));

  const MyAvatar = ({ s, size = 72 }) => {
    const av = s.shop.find((x) => x.id === s.me.avatar);
    const fr = s.shop.find((x) => x.id === s.me.frame);
    return h('div', { className: 'frame-ring', style: { background: fr ? fr.css : 'var(--border-hi)', width: size + 8, height: size + 8 } },
      h('div', { style: { width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, #2d3446, #151821)', display: 'grid', placeItems: 'center', fontSize: size * 0.52 } }, av ? av.icon : '🦊'));
  };

  const Sheet = ({ onClose, children }) => {
    useEffect(() => {
      const k = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return h('div', { className: 'scrim', onClick: onClose },
      h('div', { className: 'sheet', role: 'dialog', 'aria-modal': true, onClick: (e) => e.stopPropagation() }, h('div', { className: 'grab' }), children));
  };

  const Section = ({ title, right, children }) => h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
    h('div', { className: 'row' }, h('div', { className: 'eyebrow grow' }, title), right), children);

  // ---------------------------------------------------------------- map
  const STOP_GAP = 168, BANNER_H = 76, TOP_PAD = 24;
  const xFor = (i) => 50 + 26 * Math.sin(i * 1.15 + 0.4);

  const MapScreen = ({ s, d, now, openHw, go }) => {
    const { homeworks, regions, myGuild, me, stopIcons, bosses } = s;
    // Lay out banners and stops top-to-bottom.
    const layout = [];
    let y = TOP_PAD;
    let lastUnit = null;
    homeworks.forEach((hw, i) => {
      if (hw.unit !== lastUnit) {
        layout.push({ kind: 'banner', unit: hw.unit, y });
        y += BANNER_H + 40;
        lastUnit = hw.unit;
      }
      layout.push({ kind: 'stop', hw, i, x: xFor(i), y: y + 42 });
      y += STOP_GAP;
    });
    const height = y + 20;
    const stops = layout.filter((l) => l.kind === 'stop');
    const seg = (a, b) => { const my = (a.y + b.y) / 2; return `C ${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`; };
    let donePath = '', restPath = '';
    stops.forEach((st, k) => {
      if (k === 0) return;
      const prev = stops[k - 1];
      const part = seg(prev, st);
      if (k <= d.myStop) donePath += (donePath ? ' ' : `M ${prev.x} ${prev.y} `) + part;
      else restPath += (restPath ? ' ' : `M ${prev.x} ${prev.y} `) + part;
    });
    const pinsAt = (i) => {
      const list = myGuild.members.filter((m) => (m.me ? d.myStop : Math.min(m.stop, homeworks.length - 1)) === i);
      list.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0));
      return list;
    };
    const next = d.nextHw;
    const earlyLeft = next ? next.dueAt - G.EARLY_HOURS * G.HOUR - now : 0;

    return h('div', null,
      h('div', { className: 'page', style: { paddingBottom: 6 } },
        h('div', null,
          h('div', { className: 'eyebrow' }, s.myGuild.emblem + ' Guild ' + myGuild.name + ' · Navigate B1'),
          h('h1', { className: 'h1', style: { marginTop: 4 } }, firstName(me.name) + ', your guild needs you')),
        // Mini battle strip.
        h('button', { className: 'card', onClick: () => go('battle'), style: { textAlign: 'left', padding: 12 } },
          h('div', { className: 'row', style: { marginBottom: 8 } },
            h('span', { className: 'tiny', style: { fontWeight: 700 } }, myGuild.emblem + ' ' + myGuild.name),
            h('span', { className: 'vs grow', style: { textAlign: 'center' } }, 'VS'),
            h('span', { className: 'tiny', style: { fontWeight: 700 } }, d.enemy.name + ' ' + d.enemy.emblem)),
          h('div', { className: 'row' },
            h('div', { className: 'grow' }, h(HP, { value: d.usHP, max: G.FORTRESS_HP, color: 'var(--lime)', size: 'thin' })),
            h('div', { className: 'grow' }, h(HP, { value: d.enemyHP, max: G.FORTRESS_HP, color: 'var(--orange)', pending: d.pendingOnEnemy, size: 'thin' }))),
          h('div', { className: 'row tiny muted', style: { marginTop: 8 } },
            h('span', { className: 'num', style: { color: 'var(--lime)' } }, pct(d.usHP, G.FORTRESS_HP) + '%'),
            h('span', { className: 'grow', style: { textAlign: 'center' } }, '⏱ ' + fmtCountdown(d.battleLeft) + ' left'),
            h('span', { className: 'num', style: { color: 'var(--orange)' } }, pct(d.enemyHP, G.FORTRESS_HP) + '%'))),
        next && h('div', { className: 'card glow-lime' },
          h('div', { className: 'row' },
            h(Clay, { icon: stopIcons[next.id], color: (regions.find((r) => r.unit === next.unit) || {}).color }),
            h('div', { className: 'grow' },
              h('div', { className: 'eyebrow', style: { color: 'var(--lime)' } }, 'Next stop'),
              h('div', { className: 'h2', style: { marginTop: 2 } }, next.title),
              h('div', { className: 'tiny muted' }, 'Due in ' + fmtCountdown(next.dueAt - now) + ' · ' + next.tasks.length + ' tasks'))),
          earlyLeft > 0 && h('div', { className: 'row tiny', style: { marginTop: 12, padding: '8px 10px', borderRadius: 10, background: 'var(--gold-soft)', color: 'var(--gold)', fontWeight: 700 } },
            '⚡ Early Strike ×1.5 for ' + fmtCountdown(earlyLeft)),
          h('button', { className: 'btn primary block', style: { marginTop: 12 }, onClick: () => openHw(next.id) }, '⚔️  Start this homework'))),

      h('div', { className: 'map', style: { height } },
        h('svg', { className: 'path', viewBox: `0 0 100 ${height}`, preserveAspectRatio: 'none', 'aria-hidden': true },
          restPath && h('path', { d: restPath, fill: 'none', stroke: '#3A4156', strokeWidth: 3, strokeDasharray: '2 10', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }),
          donePath && h('path', { d: donePath, fill: 'none', stroke: 'var(--lime)', strokeWidth: 4, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke', style: { filter: 'drop-shadow(0 0 6px rgba(168,230,61,0.6))' } })),
        layout.map((l) => {
          if (l.kind === 'banner') {
            const r = regions.find((x) => x.unit === l.unit);
            const boss = bosses.find((b) => b.unit === l.unit);
            const isLocked = l.unit > d.currentUnit;
            const sub = isLocked
              ? '🔒 Unlocks when the guild defeats ' + (d.liveBoss ? d.liveBoss.name : 'the current boss')
              : boss ? (boss.defeated ? '✓ Boss defeated · ' + boss.name : '⚔️ Boss: ' + boss.name + ' · ' + pct(boss.hp - boss.dealt, boss.hp) + '% HP') : 'Cleared';
            return h('div', { key: 'b' + l.unit, className: cx('region-banner', isLocked && 'locked'), style: { top: l.y } },
              h(Clay, { icon: r.icon, color: r.color, size: 'sm' }),
              h('div', { className: 'grow' },
                h('div', { className: 'eyebrow' }, 'Unit ' + l.unit),
                h('div', { style: { fontWeight: 800, fontFamily: 'var(--font-display)' } }, r.name),
                h('div', { className: 'tiny muted', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, sub)),
              boss && !boss.defeated && !isLocked && h('button', { className: 'btn ghost sm', onClick: () => go('raid') }, 'Raid'));
          }
          const { hw, i } = l;
          const st = s.me.submitted[hw.id];
          const isLocked = d.locked(hw);
          const isCurrent = !isLocked && d.nextHw && d.nextHw.id === hw.id;
          const r = regions.find((x) => x.unit === hw.unit);
          const pins = pinsAt(i);
          return h(React.Fragment, { key: hw.id },
            pins.length > 0 && h('div', { className: 'pins', style: { left: l.x + '%', top: l.y - 82 } },
              pins.slice(0, 4).map((m) => h('div', { key: m.id, className: cx('pin', m.me && 'me'), title: m.name, style: { background: m.bg } }, m.me ? (s.shop.find((x) => x.id === me.avatar) || {}).icon : initials(m.name))),
              pins.length > 4 && h('div', { className: 'pin more' }, '+' + (pins.length - 4))),
            h('button', { className: cx('stop', isLocked && 'locked', isCurrent && 'current'), style: { left: l.x + '%', top: l.y + 14 }, onClick: () => openHw(hw.id), 'aria-label': hw.title },
              h('div', { className: 'island', style: { '--c': isLocked ? '#2A2F3D' : r.color, animationDelay: (i * 0.7) + 's' } },
                isLocked ? '🔒' : stopIcons[hw.id],
                st && h('div', { className: 'state', style: { background: st === 'verified' ? 'var(--lime)' : 'var(--gold)', color: '#0b0d12' } }, st === 'verified' ? '✓' : '⏳')),
              h('div', { className: 'lbl' }, hw.title.replace('Unit ' + hw.unit + ' · ', '')),
              !isLocked && !st && h('div', { className: 'tiny', style: { color: hw.dueAt < now ? 'var(--red)' : 'var(--text-2)', fontWeight: 600 } }, hw.dueAt < now ? 'Overdue' : 'Due ' + fmtCountdown(hw.dueAt - now))));
        })));
  };

  // ---------------------------------------------------------------- homework sheet
  const HomeworkSheet = ({ s, d, now, hwId, onClose, submit }) => {
    const hw = s.homeworks.find((x) => x.id === hwId);
    const sub = s.submissions.find((x) => x.who === s.me.id && x.hwId === hwId);
    const prior = s.me.tasks[hwId];
    const [statuses, setStatuses] = useState(() => prior || hw.tasks.map(() => 'Not started'));
    const [audio, setAudio] = useState(() => (sub && sub.audio) || (s.me.audio[hwId] || {}));
    const [recording, setRecording] = useState(null);
    const isLocked = d.locked(hw);
    const readOnly = !!s.me.submitted[hwId];
    const r = s.regions.find((x) => x.unit === hw.unit);

    useEffect(() => {
      if (recording === null) return undefined;
      const t = setTimeout(() => {
        const secs = 35 + Math.floor(Math.random() * 40);
        setAudio((a) => ({ ...a, [recording]: '0:' + pad2(secs) }));
        setRecording(null);
      }, 2200);
      return () => clearTimeout(t);
    }, [recording]);

    const est = G.calcDamage({ hw, statuses, audio, submittedAt: sub ? sub.submittedAt : now, streak: s.me.streak, stars: sub && sub.stars ? sub.stars : G.ESTIMATE_STARS });
    const fortress = G.fortressDamage(est.total, s.myGuild.members.length, d.enemyShield);
    const anyDone = statuses.some((x) => x !== 'Not started' && x !== 'Not full');

    if (isLocked) {
      return h(Sheet, { onClose },
        h('div', { style: { textAlign: 'center', padding: '10px 0 6px' } },
          h(Clay, { icon: '🔒', color: '#2A2F3D', size: 'lg', style: { margin: '0 auto 14px' } }),
          h('div', { className: 'h1' }, hw.title),
          h('p', { className: 'muted' }, 'This region unlocks when your guild defeats ' + (d.liveBoss ? d.liveBoss.name : 'the current boss') + '. Every homework in Unit ' + d.currentUnit + ' brings it closer.'),
          h('button', { className: 'btn ghost block', onClick: onClose }, 'Got it')));
    }

    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 14 } },
        h(Clay, { icon: s.stopIcons[hw.id], color: r.color }),
        h('div', { className: 'grow' },
          h('div', { className: 'eyebrow' }, 'Unit ' + hw.unit + ' · ' + r.name),
          h('div', { className: 'h1', style: { fontSize: 20 } }, hw.title),
          h('div', { className: 'tiny muted' }, (hw.dueAt < now ? 'Overdue by ' : 'Due in ') + fmtCountdown(hw.dueAt - now)))),
      readOnly && h('div', { className: 'card', style: { marginBottom: 12, padding: 12, background: s.me.submitted[hwId] === 'verified' ? 'var(--lime-soft)' : 'var(--gold-soft)', borderColor: 'transparent' } },
        s.me.submitted[hwId] === 'verified'
          ? h('div', { style: { fontWeight: 700, color: 'var(--lime)' } }, '✓ Verified by your teacher' + (sub && sub.dmg ? ' · ' + sub.dmg + ' damage landed' : ''))
          : h('div', { style: { fontWeight: 700, color: 'var(--gold)' } }, '⏳ ~' + fortress + ' damage pending · lands when your teacher verifies')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        hw.tasks.map((t, i) => h('div', { key: i, className: 'task' },
          h('div', { className: 'row' },
            h('div', { className: 'grow', style: { fontWeight: 600 } }, t.label),
            h(Badge, { k: TYPE_BADGE[t.type] }, t.type),
            h('span', { className: 'num tiny', style: { color: 'var(--text-2)', minWidth: 34, textAlign: 'right' } }, '⚔ ' + G.DAMAGE[t.type])),
          h('div', { className: 'seg' },
            G.STATUSES.map((x) => h('button', { key: x, disabled: readOnly, className: statuses[i] === x ? SEG_CLS[x] : '', onClick: () => setStatuses((a) => a.map((v, j) => (j === i ? x : v))) }, x))),
          t.type === 'speaking' && h('div', { className: 'row tiny' },
            audio[i]
              ? h(React.Fragment, null, h('span', { style: { color: 'var(--lime)', fontWeight: 700 } }, '🎧 Recording attached · ' + audio[i]), !readOnly && h('button', { className: 'muted', style: { marginLeft: 'auto', textDecoration: 'underline' }, onClick: () => setAudio((a) => { const n = { ...a }; delete n[i]; return n; }) }, 'Re-record'))
              : recording === i
                ? h(React.Fragment, null, h('span', { className: 'rec' }), h('span', { style: { fontWeight: 700 } }, 'Recording…'))
                : h(React.Fragment, null,
                  h('span', { style: { color: 'var(--orange)', fontWeight: 600 } }, 'Speaking only counts with real audio'),
                  !readOnly && h('button', { className: 'btn ghost sm', style: { marginLeft: 'auto' }, onClick: () => setRecording(i) }, '🎙 Record')))))),

      // Damage preview.
      h('div', { className: 'card', style: { marginTop: 12, padding: 14, background: 'var(--bg-2)' } },
        h('div', { className: 'eyebrow', style: { marginBottom: 8 } }, readOnly ? 'Damage' : 'Damage preview'),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 13 } },
          h('span', { className: 'muted' }, 'Tasks'), h('span', { className: 'num' }, est.base),
          h('span', { className: 'muted' }, 'Full homework bonus'), h('span', { className: 'num', style: { color: est.fullBonus ? 'var(--lime)' : 'var(--text-3)' } }, '+' + est.fullBonus),
          h('span', { className: 'muted' }, est.timing === 'early' ? '⚡ Early Strike' : est.timing === 'late' ? '🐢 Late submission' : 'On time'), h('span', { className: 'num', style: { color: est.timing === 'early' ? 'var(--gold)' : est.timing === 'late' ? 'var(--red)' : 'var(--text-3)' } }, '×' + est.timingMult),
          h('span', { className: 'muted' }, s.me.streak >= G.STREAK_MIN ? '🔥 Streak ' + s.me.streak : '🔥 Streak ' + s.me.streak + ' (bonus from ' + G.STREAK_MIN + ')'), h('span', { className: 'num', style: { color: est.streakMult > 1 ? 'var(--orange)' : 'var(--text-3)' } }, '×' + est.streakMult),
          h('span', { className: 'muted' }, sub && sub.stars ? 'Teacher rating ' + '★'.repeat(sub.stars) : 'Teacher rating (assumes ★★)'), h('span', { className: 'num' }, '×' + est.starMult),
          h('span', { className: 'muted' }, 'Guild size & enemy shield'), h('span', { className: 'num' }, '×' + (fortress / Math.max(1, est.total)).toFixed(2))),
        h('div', { className: 'row', style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' } },
          h('span', { className: 'grow', style: { fontWeight: 700 } }, 'Fortress damage'),
          h('span', { className: 'num', style: { fontSize: 26, color: 'var(--lime)' } }, fortress)),
        h('div', { className: 'tiny muted', style: { marginTop: 4 } }, 'A 3★ rating from your teacher makes it a Critical Hit (×2).')),

      !readOnly && h('button', { className: 'btn primary block', style: { marginTop: 14, padding: 15, fontSize: 15 }, disabled: !anyDone,
        onClick: () => { submit(hw, statuses, audio, est, fortress); onClose(); } }, anyDone ? '⚔️  Attack ' + d.enemy.name + ' · ' + fortress : 'Mark at least one task to attack'));
  };

  // ---------------------------------------------------------------- battle + feed
  const FeedList = ({ s, now, items, fresh }) => h('div', null,
    items.map((f) => {
      const ours = f.side === 'us';
      const who = ours ? (s.myGuild.members.find((m) => m.name === f.who) || { name: f.who, bg: '#A8E63D' }) : (s.battle.enemy.members.find((m) => m.name === f.who) || { name: f.who, bg: '#F97316' });
      return h('div', { key: f.id, className: cx('feed-item', fresh === f.id && 'new') },
        h(PersonAv, { p: who }),
        h('div', { className: 'grow' },
          h('div', { style: { fontSize: 13.5 } },
            h('b', null, f.who === s.me.name ? 'You' : f.who), ours ? ' hit ' + s.battle.enemy.name + '\'s fortress' : ' hit your fortress',
            f.pending ? ' (pending)' : ''),
          h('div', { className: 'row tiny muted', style: { gap: 6, marginTop: 3, flexWrap: 'wrap' } },
            h('span', null, ago(f.at, now)),
            f.crit && h(Badge, { k: 'b-gold' }, '💥 Critical Hit'),
            f.early && h(Badge, { k: 'b-yellow' }, '⚡ Early Strike'),
            f.quest && h(Badge, { k: 'b-purple' }, 'Side quest'),
            f.pending && h(Badge, { k: 'b-grey' }, '⏳ Awaiting teacher'))),
        h('div', { className: 'num', style: { fontSize: 20, color: f.pending ? 'var(--text-3)' : ours ? 'var(--lime)' : 'var(--orange)' } }, (ours ? '−' : '−') + f.dmg));
    }));

  const BattleScreen = ({ s, d, now, fresh, toggleDuel }) => {
    const [tab, setTab] = useState('battle');
    const { myGuild } = s;
    const enemy = d.enemy;
    const feed = [...s.feed].sort((a, b) => b.at - a.at);
    const myWeek = s.feed.filter((f) => f.side === 'us' && f.who === s.me.name && !f.pending).reduce((a, f) => a + f.dmg, 0);
    const Fort = ({ g, hp, color, shield, pending, mine }) => h('div', { className: 'card', style: { padding: 14 } },
      h('div', { className: 'row' },
        h(Clay, { icon: g.emblem, color, size: 'sm' }),
        h('div', { className: 'grow' },
          h('div', { style: { fontWeight: 800, fontFamily: 'var(--font-display)' } }, g.name + (mine ? ' · you' : '')),
          h('div', { className: 'tiny muted' }, g.teacher + ' · ' + g.members.length + ' members')),
        h('div', { style: { textAlign: 'right' } },
          h('div', { className: 'num', style: { fontSize: 24, color } }, hp),
          h('div', { className: 'tiny muted' }, '/ ' + G.FORTRESS_HP + ' HP'))),
      h('div', { style: { marginTop: 10 } }, h(HP, { value: hp, max: G.FORTRESS_HP, color, pending, size: 'big' })),
      h('div', { className: 'row tiny', style: { marginTop: 8, color: 'var(--text-2)' } },
        h('span', null, '🛡️ Shield ' + Math.round(shield * 100) + '%'),
        h('span', { className: 'grow' }),
        h('span', null, 'Takes ×' + G.incomingMult(shield).toFixed(2) + ' damage')),
      pending > 0 && h('div', { className: 'tiny', style: { marginTop: 6, color: 'var(--gold)', fontWeight: 600 } }, '⏳ ' + pending + ' damage pending teacher verification'));

    return h('div', { className: 'page' },
      h('div', { className: 'row' },
        h('div', { className: 'grow' },
          h('div', { className: 'eyebrow' }, 'Weekly Guild Battle · B1'),
          h('h1', { className: 'h1' }, 'Battle')),
        h('div', { style: { textAlign: 'right' } },
          h('div', { className: 'eyebrow' }, 'Ends in'),
          h('div', { className: 'num', style: { fontSize: 22, color: d.battleLeft < 86400000 ? 'var(--red)' : 'var(--text)' } }, fmtClock(d.battleLeft)))),
      h('div', { className: 'pill-tabs' },
        h('button', { className: tab === 'battle' ? 'on' : '', onClick: () => setTab('battle') }, '⚔️ Battle'),
        h('button', { className: tab === 'feed' ? 'on' : '', onClick: () => setTab('feed') }, '📡 Live feed'),
        h('button', { className: tab === 'duel' ? 'on' : '', onClick: () => setTab('duel') }, '🤺 Duel')),
      tab === 'battle' && h(React.Fragment, null,
        h(Fort, { g: myGuild, hp: d.usHP, color: 'var(--lime)', shield: d.myShield, mine: true }),
        h('div', { className: 'vs', style: { textAlign: 'center', margin: '-4px 0' } }, 'VS'),
        h(Fort, { g: enemy, hp: d.enemyHP, color: 'var(--orange)', shield: d.enemyShield, pending: d.pendingOnEnemy }),
        h('div', { className: cx('card', d.notAttacked > 0 ? 'glow-red' : 'glow-lime'), style: { padding: 14 } },
          d.notAttacked > 0
            ? h('div', null,
              h('div', { style: { fontWeight: 800 } }, d.notAttacked + ' of ' + myGuild.members.length + ' teammates haven\'t attacked yet'),
              h('div', { className: 'tiny muted', style: { marginTop: 3 } }, 'Every attacker raises the guild shield, so the enemy hits softer. Names stay private.'))
            : h('div', { style: { fontWeight: 800, color: 'var(--lime)' } }, 'Full guild has attacked — shield at maximum! 🛡️')),
        h('div', { className: 'grid2' },
          h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Your damage'), h('div', { className: 'v', style: { color: 'var(--lime)' } }, myWeek), h('div', { className: 'tiny muted' }, 'this battle')),
          h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Scoring'), h('div', { className: 'v' }, '×' + G.sizeFactor(myGuild.members.length).toFixed(2)), h('div', { className: 'tiny muted' }, 'size-fair vs ×' + G.sizeFactor(enemy.members.length).toFixed(2)))),
        h(Section, { title: 'Recent attacks' }, h('div', { className: 'card', style: { padding: '4px 14px' } }, h(FeedList, { s, now, items: feed.slice(0, 5), fresh })))),
      tab === 'feed' && h('div', { className: 'card', style: { padding: '4px 14px' } }, h(FeedList, { s, now, items: feed, fresh })),
      tab === 'duel' && h(DuelCard, { s, now, toggleDuel }));
  };

  const DuelCard = ({ s, toggleDuel }) => {
    const rival = { name: 'Kamila N.', bg: '#F5E642', lvl: 7, dmg: 49 };
    const mine = s.feed.filter((f) => f.side === 'us' && f.who === s.me.name && !f.pending).reduce((a, f) => a + f.dmg, 0);
    if (!s.me.duel) {
      return h('div', { className: 'card', style: { textAlign: 'center' } },
        h(Clay, { icon: '🤺', color: '#8B5CF6', size: 'lg', style: { margin: '6px auto 12px' } }),
        h('div', { className: 'h2' }, '1v1 Duel · opt-in'),
        h('p', { className: 'muted', style: { margin: '6px 0 14px' } }, 'Get matched with a student of similar level from another guild. Whoever lands more homework damage this week wins 40 coins. Losing costs nothing.'),
        h('button', { className: 'btn primary block', onClick: toggleDuel }, 'Join this week\'s duel'));
    }
    return h('div', { className: 'card glow-purple' },
      h('div', { className: 'eyebrow', style: { textAlign: 'center' } }, 'Duel · ends with the battle'),
      h('div', { className: 'row', style: { justifyContent: 'space-around', margin: '14px 0' } },
        h('div', { style: { textAlign: 'center' } }, h(MyAvatar, { s, size: 56 }), h('div', { style: { fontWeight: 700, marginTop: 6 } }, 'You'), h('div', { className: 'num', style: { fontSize: 26, color: 'var(--lime)' } }, mine)),
        h('div', { className: 'vs' }, 'VS'),
        h('div', { style: { textAlign: 'center' } }, h(PersonAv, { p: rival, size: 64 }), h('div', { style: { fontWeight: 700, marginTop: 6 } }, rival.name), h('div', { className: 'num', style: { fontSize: 26, color: 'var(--orange)' } }, rival.dmg))),
      h('div', { className: 'tiny muted', style: { textAlign: 'center' } }, 'Level ' + G.levelFromXp(s.me.xp) + ' vs level ' + rival.lvl + ' · only verified damage counts'),
      h('button', { className: 'btn ghost block sm', style: { marginTop: 12 }, onClick: toggleDuel }, 'Leave duel'));
  };

  // ---------------------------------------------------------------- raid
  const RaidScreen = ({ s, d, now, go }) => {
    const b = d.liveBoss;
    const members = s.myGuild.members;
    if (!b) return h('div', { className: 'page' }, h('h1', { className: 'h1' }, 'All bosses defeated 🏆'));
    const left = Math.max(0, b.hp - b.dealt);
    const contrib = b.contrib || {};
    const struck = Object.keys(contrib).filter((k) => contrib[k] > 0).length;
    const top = Object.entries(contrib).sort((a, c) => c[1] - a[1]).slice(0, 3);
    const mine = contrib[s.me.id] || 0;
    const r = s.regions.find((x) => x.unit === b.unit);
    return h('div', { className: 'page' },
      h('div', null, h('div', { className: 'eyebrow' }, 'Boss Raid · Unit ' + b.unit + ' · ' + r.name), h('h1', { className: 'h1' }, 'Raid')),
      h('div', { className: 'card glow-purple', style: { textAlign: 'center', padding: 20, background: 'radial-gradient(80% 60% at 50% 0%, rgba(139,92,246,0.25), transparent 70%), var(--surface)' } },
        h(Clay, { icon: b.icon, color: '#8B5CF6', size: 'lg', round: true, style: { margin: '6px auto 12px', width: 104, height: 104, fontSize: 56 } }),
        h('div', { className: 'h1', style: { fontSize: 22 } }, b.name),
        h('div', { className: 'tiny muted', style: { marginTop: 4 } }, 'Defeat it before ' + new Date(b.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + fmtCountdown(b.deadline - now) + ' left'),
        h('div', { style: { marginTop: 16 } }, h(HP, { value: left, max: b.hp, color: 'linear-gradient(90deg, #8B5CF6, #EC4899)', size: 'big' })),
        h('div', { className: 'row', style: { marginTop: 8 } },
          h('span', { className: 'num', style: { fontSize: 20 } }, left),
          h('span', { className: 'tiny muted grow', style: { textAlign: 'left' } }, ' / ' + b.hp + ' HP'),
          h('span', { className: 'tiny muted' }, struck + ' of ' + members.length + ' have struck'))),
      h('div', { className: 'grid2' },
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Your hits'), h('div', { className: 'v', style: { color: 'var(--lime)' } }, mine), h('div', { className: 'tiny muted' }, pct(mine, b.hp) + '% of its HP')),
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Unlocks'), h('div', { className: 'v', style: { fontSize: 18, marginTop: 6 } }, '🏛️ Unit ' + (b.unit + 1)), h('div', { className: 'tiny muted' }, 'when it falls'))),
      h(Section, { title: 'Raid MVPs' },
        h('div', { className: 'card', style: { padding: '6px 14px' } },
          top.map(([id, dmg], i) => {
            const m = members.find((x) => x.id === id);
            return h('div', { key: id, className: 'feed-item', style: { alignItems: 'center' } },
              h('div', { className: 'num', style: { width: 18, color: ['var(--gold)', '#C9D1DE', '#C98A5A'][i] } }, i + 1),
              h(PersonAv, { p: m }), h('div', { className: 'grow', style: { fontWeight: 600 } }, m.me ? 'You' : m.name),
              h('div', { className: 'num', style: { color: 'var(--lime)' } }, dmg));
          }))),
      h('div', { className: 'tiny muted' }, 'Every homework in Unit ' + b.unit + ' hits the boss with its full damage. The whole guild wins together — there is no bottom of this list.'),
      d.nextHw && d.nextHw.unit === b.unit && h('button', { className: 'btn primary block', onClick: () => go('map') }, '⚔️  Strike with ' + d.nextHw.title),
      h(Section, { title: 'Bosses this term' },
        s.bosses.slice().sort((a, c) => a.unit - c.unit).map((x) => h('div', { key: x.unit + x.name, className: 'card row', style: { padding: 12, opacity: x.unit > b.unit ? 0.55 : 1 } },
          h(Clay, { icon: x.unit > b.unit ? '🔒' : x.icon, color: x.defeated ? '#0FA88A' : '#8B5CF6', size: 'sm' }),
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, x.name), h('div', { className: 'tiny muted' }, 'Unit ' + x.unit)),
          x.defeated ? h(Badge, { k: 'b-lime' }, 'Defeated') : x === b ? h(Badge, { k: 'b-purple' }, 'Active') : h(Badge, { k: 'b-grey' }, 'Locked')))));
  };

  // ---------------------------------------------------------------- side quests
  const KIND_LABEL = { video: 'Watch a video', article: 'Read an article', shadowing: 'Shadowing', flashcards: 'Flashcards' };
  const CHECK_LABEL = { video: '3 comprehension questions', article: '1-minute vocabulary check', shadowing: 'Record and upload audio', flashcards: 'Short self-test' };

  const QuestsScreen = ({ s, openQuest }) => {
    const [lvl, setLvl] = useState('B1');
    const list = s.sideQuests.filter((q) => lvl === 'All' || q.level === lvl).sort((a, b) => (b.assigned ? 1 : 0) - (a.assigned ? 1 : 0));
    const cap = G.SIDE_QUEST_DAILY_CAP;
    return h('div', { className: 'page' },
      h('div', null, h('div', { className: 'eyebrow' }, 'Side quests'), h('h1', { className: 'h1' }, 'Quests')),
      h('div', { className: 'card', style: { padding: 14 } },
        h('div', { className: 'row' },
          h('div', { className: 'grow' },
            h('div', { style: { fontWeight: 800 } }, 'Daily rewards · ' + Math.min(s.me.sideToday, cap) + ' / ' + cap),
            h('div', { className: 'tiny muted' }, 'Earn coins and a little XP. Homework stays your main weapon.')),
          h('div', { className: 'row', style: { gap: 4 } }, Array.from({ length: cap }, (_, i) => h('div', { key: i, style: { width: 14, height: 14, borderRadius: 5, background: i < s.me.sideToday ? 'var(--gold)' : 'var(--surface-hi)' } }))))),
      h('div', { className: 'pill-tabs' }, ['B1', 'All', 'A2', 'C1'].map((x) => h('button', { key: x, className: lvl === x ? 'on' : '', onClick: () => setLvl(x) }, x === 'B1' ? 'My level · B1' : x))),
      list.map((q) => {
        const done = s.me.sideDone.includes(q.id);
        return h('button', { key: q.id, className: 'card row', style: { textAlign: 'left', padding: 14, opacity: done ? 0.6 : 1 }, onClick: () => openQuest(q.id) },
          h(Clay, { icon: q.icon, color: q.color }),
          h('div', { className: 'grow' },
            h('div', { className: 'row', style: { gap: 6, marginBottom: 3, flexWrap: 'wrap' } },
              h('span', { className: 'eyebrow' }, KIND_LABEL[q.kind] + ' · ' + q.mins + ' min'),
              q.assigned && h(Badge, { k: 'b-lime' }, 'From teacher'),
              done && h(Badge, { k: 'b-grey' }, '✓ Done')),
            h('div', { style: { fontWeight: 700, fontSize: 14.5 } }, q.title),
            h('div', { className: 'tiny muted', style: { marginTop: 2 } }, '✔ ' + CHECK_LABEL[q.kind])),
          h('div', { style: { textAlign: 'right', flexShrink: 0 } },
            h('div', { className: 'num', style: { color: 'var(--gold)' } }, '🪙 ' + q.coins),
            h('div', { className: 'tiny muted' }, '+' + q.xp + ' XP')));
      }));
  };

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
      timed && !checked && h('div', { className: 'row' }, h('span', { className: 'eyebrow grow' }, 'Vocabulary check'), h('span', { className: 'num', style: { color: left < 15 ? 'var(--red)' : 'var(--gold)' } }, '⏱ 0:' + pad2(left))),
      questions.map((q, i) => h('div', { key: i, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h('div', { style: { fontWeight: 700 } }, (i + 1) + '. ' + q.q),
        q.opts.map((o, j) => h('button', { key: j, disabled: checked, className: cx('quiz-opt', !checked && ans[i] === j && 'sel', checked && j === q.a && 'right', checked && ans[i] === j && j !== q.a && 'wrong'), onClick: () => setAns((a) => ({ ...a, [i]: j })) }, o)))),
      !checked
        ? h('button', { className: 'btn primary block', disabled: Object.keys(ans).length < questions.length && !(timed && left <= 0), onClick: () => setChecked(true) }, 'Check answers')
        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          h('div', { className: 'card', style: { padding: 12, textAlign: 'center', background: score >= 2 ? 'var(--lime-soft)' : 'var(--red-soft)', borderColor: 'transparent', fontWeight: 700 } },
            score + ' / ' + questions.length + ' correct · ' + (score >= 2 ? 'quest passed!' : 'you need 2 to pass')),
          score >= 2
            ? h('button', { className: 'btn gold block', onClick: () => onDone(true) }, 'Claim reward')
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
    if (done) body = h('div', { className: 'card', style: { textAlign: 'center', background: 'var(--lime-soft)', borderColor: 'transparent', fontWeight: 700, color: 'var(--lime)' } }, '✓ You finished this quest');
    else if (q.kind === 'video') {
      body = stage === 'check'
        ? h(Quiz, { questions: q.check, onDone: finish })
        : h('div', null,
          h('div', { style: { aspectRatio: '16/9', borderRadius: 16, background: 'linear-gradient(135deg, #3b1d4a, #12233f)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', marginBottom: 12 } },
            stage === 'intro'
              ? h('button', { onClick: () => setStage('watch'), style: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', color: '#111', fontSize: 26 }, 'aria-label': 'Play' }, '▶')
              : h('div', { className: 'tiny', style: { fontWeight: 700 } }, 'Playing…'),
            h('div', { style: { position: 'absolute', left: 0, bottom: 0, height: 4, width: watch + '%', background: 'var(--red)' } })),
          h('p', { className: 'muted', style: { margin: 0 } }, q.body),
          h('div', { className: 'tiny muted', style: { marginTop: 8 } }, 'The questions unlock after the video ends.'));
    } else if (q.kind === 'article') {
      body = stage === 'check'
        ? h(Quiz, { questions: q.check, onDone: finish, timed: q.timed })
        : h('div', null,
          h('p', { style: { lineHeight: 1.7, fontSize: 15, margin: '0 0 14px' } }, q.body),
          h('button', { className: 'btn primary block', onClick: () => setStage('check') }, 'Start 1-minute check'));
    } else if (q.kind === 'shadowing') {
      body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('p', { className: 'muted', style: { margin: 0 } }, q.body),
        q.lines.map((l, i) => h('div', { key: i, className: 'task row', style: { flexDirection: 'row' } }, h('span', { className: 'num muted' }, i + 1), h('span', { className: 'grow' }, l), h('span', null, '🔊'))),
        rec === 'done'
          ? h(React.Fragment, null,
            h('div', { className: 'tiny', style: { color: 'var(--lime)', fontWeight: 700 } }, '🎧 Recording uploaded · 0:' + pad2(30 + q.lines.length * 3)),
            h('button', { className: 'btn gold block', onClick: finish }, 'Claim reward'))
          : h('button', { className: 'btn primary block', disabled: rec === 'rec', onClick: () => setRec('rec') }, rec === 'rec' ? h(React.Fragment, null, h('span', { className: 'rec' }), ' Recording…') : '🎙 Record all 5 lines'));
    } else {
      const c = q.cards[card];
      body = stage === 'intro'
        ? h('div', { className: 'flash', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          h('div', { className: cx('flash-card', flip && 'back'), onClick: () => setFlip((f) => !f) }, flip ? c[1] : c[0]),
          h('div', { className: 'row' },
            h('button', { className: 'btn ghost sm', disabled: card === 0, onClick: () => { setCard(card - 1); setFlip(false); } }, '←'),
            h('span', { className: 'grow tiny muted', style: { textAlign: 'center' } }, 'Card ' + (card + 1) + ' / ' + q.cards.length + ' · tap to flip'),
            card < q.cards.length - 1
              ? h('button', { className: 'btn ghost sm', onClick: () => { setCard(card + 1); setFlip(false); } }, '→')
              : h('button', { className: 'btn primary sm', onClick: () => { setStage('test'); setCard(0); setFlip(false); } }, 'Self-test')))
        : stage === 'test'
          ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('div', { className: 'eyebrow' }, 'Self-test · ' + (card + 1) + ' / ' + q.cards.length),
            h('div', { className: cx('flash-card', flip && 'back'), onClick: () => setFlip(true) }, flip ? c[1] : c[0]),
            !flip
              ? h('button', { className: 'btn ghost block', onClick: () => setFlip(true) }, 'Say the meaning, then reveal')
              : h('div', { className: 'grid2' },
                ['Missed it', 'Knew it'].map((lbl, k) => h('button', { key: lbl, className: cx('btn', k ? 'primary' : 'ghost'), onClick: () => {
                  const nk = [...known, !!k];
                  setKnown(nk); setFlip(false);
                  if (card < q.cards.length - 1) setCard(card + 1); else setStage('result');
                } }, lbl))))
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h('div', { className: 'card', style: { textAlign: 'center', fontWeight: 700 } }, known.filter(Boolean).length + ' / ' + q.cards.length + ' known'),
            h('button', { className: 'btn gold block', onClick: finish }, 'Claim reward'));
    }

    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 14 } },
        h(Clay, { icon: q.icon, color: q.color }),
        h('div', { className: 'grow' },
          h('div', { className: 'eyebrow' }, KIND_LABEL[q.kind] + ' · ' + q.level),
          h('div', { className: 'h1', style: { fontSize: 20 } }, q.title)),
        h('div', { className: 'num', style: { color: 'var(--gold)' } }, '🪙 ' + q.coins)),
      s.me.sideToday >= G.SIDE_QUEST_DAILY_CAP && !done && h('div', { className: 'tiny', style: { marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-2)' } }, 'Daily reward cap reached — practice still counts, but no coins until tomorrow.'),
      body);
  };

  // ---------------------------------------------------------------- profile + shop
  const ShopSheet = ({ s, onClose, buy, equip }) => {
    const [tab, setTab] = useState('avatar');
    const items = s.shop.filter((x) => x.kind === tab);
    return h(Sheet, { onClose },
      h('div', { className: 'row', style: { marginBottom: 12 } },
        h('div', { className: 'grow' }, h('div', { className: 'eyebrow' }, 'Coins buy looks and protection — never damage'), h('div', { className: 'h1' }, 'Shop')),
        h('span', { className: 'chip coins' }, '🪙 ' + s.me.coins)),
      h('div', { className: 'pill-tabs', style: { marginBottom: 12 } },
        [['avatar', 'Avatars'], ['frame', 'Frames'], ['consumable', 'Items']].map(([k, l]) => h('button', { key: k, className: tab === k ? 'on' : '', onClick: () => setTab(k) }, l))),
      h('div', { className: tab === 'consumable' ? '' : 'grid2', style: tab === 'consumable' ? { display: 'flex', flexDirection: 'column', gap: 10 } : {} },
        items.map((it) => {
          const owned = s.me.owned.includes(it.id);
          const equipped = s.me.avatar === it.id || s.me.frame === it.id;
          const used = it.id === 'charm' && s.me.charmUsed;
          const canBuy = s.me.coins >= it.price && !used;
          const action = it.kind === 'consumable'
            ? h('button', { className: 'btn gold sm', disabled: !canBuy, onClick: () => buy(it) }, used ? 'Active' : '🪙 ' + it.price)
            : owned
              ? h('button', { className: cx('btn sm', equipped ? 'primary' : 'ghost'), disabled: equipped, onClick: () => equip(it) }, equipped ? 'Equipped' : 'Equip')
              : h('button', { className: 'btn gold sm', disabled: !canBuy, onClick: () => buy(it) }, '🪙 ' + it.price);
          if (it.kind === 'consumable') {
            return h('div', { key: it.id, className: 'card row', style: { padding: 12 } },
              h(Clay, { icon: it.icon, color: it.id === 'freeze' ? '#3B82F6' : '#0FA88A', size: 'sm' }),
              h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, it.name + (it.id === 'freeze' && s.me.freezes ? ' · ' + s.me.freezes + ' owned' : '')), h('div', { className: 'tiny muted' }, it.desc)),
              action);
          }
          return h('div', { key: it.id, className: 'card', style: { padding: 12, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 } },
            it.kind === 'avatar'
              ? h('div', { style: { width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, #2d3446, #151821)', display: 'grid', placeItems: 'center', fontSize: 34 } }, it.icon)
              : h('div', { className: 'frame-ring', style: { background: it.css, width: 64, height: 64 } }, h('div', { style: { width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)' } })),
            h('div', { style: { fontWeight: 700, fontSize: 13 } }, it.name),
            action);
        })));
  };

  const ProfileScreen = ({ s, d, minimal, setMinimal, openShop, openChest, setTitle, reset }) => {
    const { me } = s;
    const dealt = s.feed.filter((f) => f.side === 'us' && f.who === me.name && !f.pending);
    const crits = dealt.filter((f) => f.crit).length;
    const ALL_TITLES = [
      { t: 'Grammar Strategist', how: 'Grammar tasks at Full five times' },
      { t: 'Speaking Specialist', how: '3 speaking tasks verified with audio' },
      { t: 'Early Bird', how: '3 Early Strikes' },
      { t: 'Raid Breaker', how: 'Land the final blow on a boss' },
    ];
    return h('div', { className: 'page' },
      h('div', { className: 'card', style: { textAlign: 'center', padding: 20, background: 'radial-gradient(80% 60% at 50% 0%, rgba(168,230,61,0.14), transparent 70%), var(--surface)' } },
        h('div', { style: { display: 'flex', justifyContent: 'center' } }, h(MyAvatar, { s, size: 88 })),
        h('div', { className: 'h1', style: { marginTop: 10 } }, me.name),
        h('div', { style: { color: 'var(--lime)', fontWeight: 700, marginTop: 2 } }, '“' + me.title + '”'),
        h('div', { className: 'row', style: { justifyContent: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' } },
          h(Badge, { k: 'b-lime' }, 'Level ' + d.lvl.lvl),
          h('span', { className: 'badge', style: { background: 'rgba(255,255,255,0.06)', color: d.rank.color } }, d.rank.icon + ' ' + d.rank.name),
          h(Badge, { k: 'b-grey' }, s.myGuild.emblem + ' ' + s.myGuild.name)),
        h('div', { style: { marginTop: 14, textAlign: 'left' } },
          h('div', { className: 'row tiny muted', style: { marginBottom: 6 } }, h('span', { className: 'grow' }, 'XP to level ' + (d.lvl.lvl + 1)), h('span', { className: 'num' }, d.lvl.into + ' / ' + d.lvl.need)),
          h(HP, { value: d.lvl.into, max: d.lvl.need, color: 'var(--lime)', size: 'thin' }))),
      h('div', { className: 'grid2' },
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Season rank'), h('div', { className: 'v', style: { color: d.rank.color } }, d.rank.icon + ' ' + d.rank.name),
          h('div', { className: 'tiny muted' }, d.rank.next ? (d.rank.next.min - me.seasonPts) + ' pts to ' + d.rank.next.name : 'Top rank')),
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Streak'), h('div', { className: 'v', style: { color: 'var(--orange)' } }, '🔥 ' + me.streak), h('div', { className: 'tiny muted' }, me.streak >= G.STREAK_MIN ? '+10% damage active' : (G.STREAK_MIN - me.streak) + ' more for +10% damage')),
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Damage dealt'), h('div', { className: 'v' }, dealt.reduce((a, f) => a + f.dmg, 0)), h('div', { className: 'tiny muted' }, crits + ' critical hits')),
        h('div', { className: 'stat' }, h('div', { className: 'eyebrow' }, 'Coins'), h('div', { className: 'v', style: { color: 'var(--gold)' } }, '🪙 ' + me.coins), h('div', { className: 'tiny muted' }, me.freezes + ' streak freezes'))),
      me.chests > 0 && h('button', { className: 'card row glow-lime', style: { textAlign: 'left', padding: 14 }, onClick: openChest },
        h(Clay, { icon: '🎁', color: '#EAB308' }),
        h('div', { className: 'grow' }, h('div', { style: { fontWeight: 800 } }, me.chests + ' chest' + (me.chests > 1 ? 's' : '') + ' to open'), h('div', { className: 'tiny muted' }, 'Earned for a Full homework'))),
      h('button', { className: 'btn ghost block', onClick: openShop }, '🛍️  Shop & inventory'),
      h(Section, { title: 'This week in ' + s.myGuild.name },
        h('div', { className: 'grid2' },
          h('div', { className: 'stat' }, h('div', { className: 'eyebrow', style: { color: 'var(--gold)' } }, '👑 MVP of the week'), h('div', { style: { fontWeight: 800, marginTop: 6 } }, 'Dilnoza K.'), h('div', { className: 'tiny muted' }, 'Most damage landed')),
          h('div', { className: 'stat' }, h('div', { className: 'eyebrow', style: { color: 'var(--teal)' } }, '📈 Most improved'), h('div', { style: { fontWeight: 800, marginTop: 6 } }, 'Javohir T.'), h('div', { className: 'tiny muted' }, '+60% vs last week')))),
      h(Section, { title: 'Titles' },
        ALL_TITLES.map((x) => {
          const have = me.titles.includes(x.t);
          return h('button', { key: x.t, className: 'card row', disabled: !have, style: { padding: 12, textAlign: 'left', opacity: have ? 1 : 0.5 }, onClick: () => setTitle(x.t) },
            h('span', { style: { fontSize: 20 } }, have ? '🏷️' : '🔒'),
            h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, x.t), h('div', { className: 'tiny muted' }, x.how)),
            me.title === x.t && h(Badge, { k: 'b-lime' }, 'Shown'));
        })),
      h(Section, { title: 'Settings' },
        h('div', { className: 'card row', style: { padding: 14 } },
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, 'Minimal mode'), h('div', { className: 'tiny muted' }, 'Progress and stats with less game decoration')),
          h('button', { role: 'switch', 'aria-checked': minimal, onClick: () => setMinimal(!minimal), style: { width: 48, height: 28, borderRadius: 999, background: minimal ? 'var(--lime)' : 'var(--surface-hi)', position: 'relative', transition: 'background .15s' } },
            h('span', { style: { position: 'absolute', top: 3, left: minimal ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' } }))),
        h('button', { className: 'btn ghost block sm', onClick: reset }, 'Reset demo')));
  };

  const ChestSheet = ({ reward, onClose }) => h(Sheet, { onClose },
    h('div', { style: { textAlign: 'center', padding: '10px 0' } },
      h(Clay, { icon: reward.icon, color: '#EAB308', size: 'lg', style: { margin: '0 auto 14px', width: 110, height: 110, fontSize: 58 } }),
      h('div', { className: 'eyebrow' }, 'Chest opened'),
      h('div', { className: 'h1', style: { margin: '6px 0 16px' } }, reward.label),
      h('button', { className: 'btn primary block', onClick: onClose }, 'Nice!')));

  // ---------------------------------------------------------------- teacher
  const TeacherVerify = ({ s, d, now, verify, returnSub }) => {
    const [stars, setStars] = useState({});
    const [crit, setCrit] = useState({});
    if (!d.pendingQueue.length) {
      return h('div', { className: 'card', style: { textAlign: 'center', padding: 24 } },
        h('div', { style: { fontSize: 36 } }, '✅'), h('div', { className: 'h2', style: { marginTop: 8 } }, 'All caught up'),
        h('div', { className: 'tiny muted', style: { marginTop: 4 } }, 'Switch to Student, do a homework, then verify it here to see the damage land.'));
    }
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      d.pendingQueue.map((sub) => {
        const hw = s.homeworks.find((x) => x.id === sub.hwId);
        const st = stars[sub.id] || 2;
        const isCrit = st === 3 || !!crit[sub.id];
        const dmg = G.calcDamage({ hw, statuses: sub.statuses, audio: sub.audio, submittedAt: sub.submittedAt, streak: sub.streak, stars: isCrit ? 3 : st });
        const fort = G.fortressDamage(dmg.total, s.myGuild.members.length, d.enemyShield);
        const m = s.myGuild.members.find((x) => x.id === sub.who);
        return h('div', { key: sub.id, className: 'card', style: { padding: 14 } },
          h('div', { className: 'row', style: { marginBottom: 10 } },
            h(PersonAv, { p: m }),
            h('div', { className: 'grow' }, h('div', { style: { fontWeight: 800 } }, m.name), h('div', { className: 'tiny muted' }, hw.title + ' · ' + ago(sub.submittedAt, now))),
            dmg.timing === 'early' && h(Badge, { k: 'b-yellow' }, '⚡ Early'),
            dmg.timing === 'late' && h(Badge, { k: 'b-red' }, 'Late')),
          hw.tasks.map((t, i) => h('div', { key: i, className: 'row tiny', style: { padding: '5px 0', borderTop: i ? '1px solid var(--border)' : 0 } },
            h('span', { className: 'grow' }, t.label),
            t.type === 'speaking' && (sub.audio[i] ? h('span', { style: { color: 'var(--lime)' } }, '🎧 ' + sub.audio[i]) : h('span', { style: { color: 'var(--orange)' } }, 'no audio')),
            h('span', { className: cx('badge', { 'Full': 'b-lime', '75%': 'b-gold', '50%': 'b-orange' }[sub.statuses[i]] || 'b-grey') }, sub.statuses[i]))),
          h('div', { className: 'row', style: { marginTop: 12 } },
            h('div', { className: 'stars grow' }, [1, 2, 3].map((n) => h('button', { key: n, className: n <= st ? 'on' : '', onClick: () => setStars((x) => ({ ...x, [sub.id]: n })), 'aria-label': n + ' stars' }, '⭐'))),
            h('label', { className: 'row tiny', style: { gap: 6, fontWeight: 700, color: isCrit ? 'var(--gold)' : 'var(--text-2)' } },
              h('input', { type: 'checkbox', checked: isCrit, disabled: st === 3, onChange: (e) => setCrit((x) => ({ ...x, [sub.id]: e.target.checked })) }), '💥 Critical Hit')),
          h('div', { className: 'row', style: { marginTop: 12 } },
            h('button', { className: 'btn ghost sm', onClick: () => returnSub(sub) }, 'Send back'),
            h('button', { className: 'btn primary grow', onClick: () => verify(sub, isCrit ? 3 : st) }, 'Verify · ' + fort + ' damage')));
      }));
  };

  const TeacherBattles = ({ s, d, setMatch, flash }) => {
    const [pick, setPick] = useState(s.battle.otherGroups[0].id);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { className: 'card' },
        h('div', { className: 'eyebrow' }, 'This week'),
        h('div', { className: 'row', style: { marginTop: 8 } },
          h('div', { className: 'grow', style: { fontWeight: 800 } }, s.myGuild.emblem + ' ' + s.myGuild.name), h('span', { className: 'vs' }, 'VS'),
          h('div', { className: 'grow', style: { fontWeight: 800, textAlign: 'right' } }, d.enemy.name + ' ' + d.enemy.emblem)),
        h('div', { className: 'row tiny muted', style: { marginTop: 6 } }, h('span', { className: 'grow' }, d.usHP + ' HP'), h('span', null, fmtCountdown(d.battleLeft) + ' left'), h('span', { className: 'grow', style: { textAlign: 'right' } }, d.enemyHP + ' HP'))),
      h('div', { className: 'card' },
        h('div', { className: 'eyebrow', style: { marginBottom: 10 } }, 'Next week\'s matchup'),
        h('div', { className: 'pill-tabs', style: { marginBottom: 12 } },
          h('button', { className: s.battle.matchMode === 'auto' ? 'on' : '', onClick: () => setMatch('auto') }, 'Auto · similar level'),
          h('button', { className: s.battle.matchMode === 'manual' ? 'on' : '', onClick: () => setMatch('manual') }, 'I choose')),
        s.battle.matchMode === 'auto'
          ? h('div', { className: 'tiny muted' }, 'Battles start every Monday 08:00 against a group of the same level. Scores are normalised for group size.')
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            s.battle.otherGroups.map((g) => h('button', { key: g.id, className: 'card row', style: { padding: 10, textAlign: 'left', borderColor: pick === g.id ? 'var(--lime)' : 'var(--border)' }, onClick: () => setPick(g.id) },
              h('span', { style: { fontSize: 20 } }, g.emblem),
              h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, g.name), h('div', { className: 'tiny muted' }, g.teacher + ' · ' + g.members + ' students')),
              h(Badge, { k: g.level === s.myGuild.level ? 'b-lime' : 'b-orange' }, g.level))),
            h('button', { className: 'btn primary block', onClick: () => flash('📅 Next battle set vs ' + s.battle.otherGroups.find((g) => g.id === pick).name) }, 'Schedule for Monday'))));
  };

  const TeacherBosses = ({ s, now, addBoss }) => {
    const [unit, setUnit] = useState(7);
    const [name, setName] = useState('');
    const [hp, setHp] = useState(G.BOSS_HP_PER_MEMBER * s.myGuild.members.length);
    const [days, setDays] = useState(21);
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      s.bosses.slice().sort((a, b) => a.unit - b.unit).map((b) => h('div', { key: b.unit + b.name, className: 'card row', style: { padding: 12 } },
        h(Clay, { icon: b.icon, color: b.defeated ? '#0FA88A' : '#8B5CF6', size: 'sm' }),
        h('div', { className: 'grow' }, h('div', { style: { fontWeight: 700 } }, b.name), h('div', { className: 'tiny muted' }, 'Unit ' + b.unit + ' · ' + b.hp + ' HP · ' + (b.defeated ? 'defeated' : 'due in ' + fmtCountdown(b.deadline - now)))),
        h('span', { className: 'num' }, pct(b.hp - b.dealt, b.hp) + '%'))),
      h('div', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h('div', { className: 'h2' }, 'Create a boss'),
        h('div', { className: 'grid2' },
          h('label', { className: 'tiny muted' }, 'Unit', h('input', { className: 'field', type: 'number', min: 1, value: unit, onChange: (e) => setUnit(+e.target.value) })),
          h('label', { className: 'tiny muted' }, 'HP', h('input', { className: 'field', type: 'number', min: 100, step: 100, value: hp, onChange: (e) => setHp(+e.target.value) }))),
        h('label', { className: 'tiny muted' }, 'Name (after the unit topic)', h('input', { className: 'field', placeholder: 'e.g. The Passive Voice Phantom', value: name, onChange: (e) => setName(e.target.value) })),
        h('label', { className: 'tiny muted' }, 'Deadline in days', h('input', { className: 'field', type: 'number', min: 1, value: days, onChange: (e) => setDays(+e.target.value) })),
        h('div', { className: 'tiny muted' }, 'Suggested HP: ' + G.BOSS_HP_PER_MEMBER + ' × ' + s.myGuild.members.length + ' students = ' + G.BOSS_HP_PER_MEMBER * s.myGuild.members.length),
        h('button', { className: 'btn primary block', disabled: !name.trim() || hp < 100, onClick: () => { addBoss({ unit, name: name.trim(), icon: '👹', hp, dealt: 0, deadline: now + days * 86400000 }); setName(''); } }, 'Create boss')));
  };

  const TeacherClass = ({ s, d }) => {
    const rows = s.myGuild.members.map((m) => {
      const stop = m.me ? d.myStop : m.stop;
      const attacked = s.myGuild.attackers.includes(m.id);
      const behind = !attacked && stop < 2;
      return { m, stop, attacked, behind };
    }).sort((a, b) => (b.behind ? 1 : 0) - (a.behind ? 1 : 0));
    const popularity = s.sideQuests.filter((q) => q.level === 'B1').map((q, i) => ({ q, n: [14, 9, 6, 11][i] || 3 + (s.me.sideDone.includes(q.id) ? 1 : 0) }));
    const max = Math.max(...popularity.map((p) => p.n));
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { className: 'tiny', style: { padding: '8px 12px', borderRadius: 10, background: 'var(--blue-soft)', color: '#93C5FD', fontWeight: 600 } }, '🔒 Only you can see this. Students only ever see counts, never names.'),
      h('div', { className: 'card', style: { padding: '4px 14px' } },
        rows.map(({ m, stop, attacked, behind }) => h('div', { key: m.id, className: 'feed-item', style: { alignItems: 'center' } },
          h(PersonAv, { p: m }),
          h('div', { className: 'grow' }, h('div', { style: { fontWeight: 600 } }, m.name), h('div', { className: 'tiny muted' }, 'At ' + s.homeworks[Math.min(stop, s.homeworks.length - 1)].title)),
          behind ? h(Badge, { k: 'b-red' }, 'Needs help') : attacked ? h(Badge, { k: 'b-lime' }, 'Active') : h(Badge, { k: 'b-gold' }, 'Not yet')))),
      h(Section, { title: 'Popular side quests' },
        h('div', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          popularity.map(({ q, n }) => h('div', { key: q.id },
            h('div', { className: 'row tiny', style: { marginBottom: 4 } }, h('span', { className: 'grow' }, q.icon + ' ' + q.title), h('span', { className: 'num' }, n)),
            h(HP, { value: n, max, color: q.color, size: 'thin' }))))));
  };

  const TeacherScreen = ({ s, d, now, tab, verify, returnSub, setMatch, addBoss, flash }) =>
    h('div', { className: 'page' },
      h('div', null, h('div', { className: 'eyebrow' }, 'Teacher · ' + s.myGuild.teacher + ' · ' + s.myGuild.name),
        h('h1', { className: 'h1' }, { verify: 'Verify homework', battles: 'Battles', bosses: 'Bosses', class: 'Class' }[tab])),
      tab === 'verify' && h(TeacherVerify, { s, d, now, verify, returnSub }),
      tab === 'battles' && h(TeacherBattles, { s, d, setMatch, flash }),
      tab === 'bosses' && h(TeacherBosses, { s, now, addBoss }),
      tab === 'class' && h(TeacherClass, { s, d }));

  // ---------------------------------------------------------------- app
  const App = () => {
    const [s, setS] = useState(loadState);
    const [now, setNow] = useState(Date.now());
    const [role, setRole] = useState(() => loadPref('uq-role', 'student'));
    const [tab, setTab] = useState('map');
    const [ttab, setTtab] = useState('verify');
    const [minimal, setMinimal] = useState(() => loadPref('uq-minimal', false));
    const [hwOpen, setHwOpen] = useState(null);
    const [questOpen, setQuestOpen] = useState(null);
    const [shopOpen, setShopOpen] = useState(false);
    const [chest, setChest] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [boom, setBoom] = useState(null);
    const [fresh, setFresh] = useState(null);
    const sRef = useRef(s);
    sRef.current = s;

    useEffect(() => saveState(s), [s]);
    useEffect(() => savePref('uq-role', role), [role]);
    useEffect(() => savePref('uq-minimal', minimal), [minimal]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    useEffect(() => { window.scrollTo(0, 0); }, [tab, ttab, role]);

    const d = useMemo(() => derive(s, now), [s, now]);

    const flash = (text, icon = '✨') => {
      const id = uid();
      setToasts((t) => [...t, { id, text, icon }].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    };
    const pop = (n, label, crit) => { setBoom({ n, label, crit, k: uid() }); setTimeout(() => setBoom(null), 1400); };
    const up = (fn) => setS((prev) => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next; });

    // Push-style notice on open: counts only, never names.
    useEffect(() => {
      const dd = derive(sRef.current, Date.now());
      if (dd.notAttacked > 0) setTimeout(() => flash('Your fortress has ' + pct(dd.usHP, G.FORTRESS_HP) + '% HP and ' + fmtCountdown(dd.battleLeft) + ' to go. ' + dd.notAttacked + ' teammates haven\'t attacked yet.', '🔔'), 700);
    }, []);

    // Live battle: the other guild keeps attacking while the app is open.
    useEffect(() => {
      const t = setInterval(() => {
        const cur = sRef.current;
        const dd = derive(cur, Date.now());
        if (dd.usHP < 200 || dd.battleLeft <= 0) return;
        const enemy = cur.battle.enemy;
        const m = enemy.members[Math.floor(Math.random() * enemy.members.length)];
        const crit = Math.random() < 0.18;
        const raw = Math.round((30 + Math.random() * 45) * (crit ? 2 : 1));
        const dmg = G.fortressDamage(raw, enemy.members.length, dd.myShield);
        const id = uid();
        up((n) => {
          n.feed.push({ id, at: Date.now(), side: 'enemy', who: m.name, hw: 'Unit 4 · Present Perfect', dmg, crit });
          if (!n.battle.enemy.attackers.includes(m.id)) n.battle.enemy.attackers.push(m.id);
        });
        setFresh(id);
        flash(m.name + (crit ? ' landed a Critical Hit on' : ' hit') + ' your fortress for ' + dmg, crit ? '💥' : '⚔️');
      }, 40000);
      return () => clearInterval(t);
    }, []);

    // ---------- student actions
    const submit = (hw, statuses, audio, est, fortress) => {
      const id = uid();
      const sid = uid();
      up((n) => {
        n.me.tasks[hw.id] = statuses;
        n.me.audio[hw.id] = audio;
        n.me.submitted[hw.id] = 'pending';
        n.submissions.push({ id: sid, who: n.me.id, whoName: n.me.name, hwId: hw.id, statuses, audio, submittedAt: Date.now(), streak: n.me.streak, state: 'pending', feedId: id });
        n.feed.push({ id, at: Date.now(), side: 'us', who: n.me.name, hw: hw.title, dmg: fortress, pending: true, early: est.timing === 'early' });
        if (!n.myGuild.attackers.includes(n.me.id)) n.myGuild.attackers.push(n.me.id);
      });
      setFresh(id);
      pop(fortress, '⏳ Pending · lands when your teacher verifies', false);
      flash('Attack sent! Your guild shield went up 🛡️', '⚔️');
    };

    const completeQuest = (q) => {
      const rewarded = sRef.current.me.sideToday < G.SIDE_QUEST_DAILY_CAP;
      const dmg = rewarded ? G.fortressDamage(G.SIDE_QUEST_DAMAGE, sRef.current.myGuild.members.length, d.enemyShield) : 0;
      const id = uid();
      up((n) => {
        n.me.sideDone.push(q.id);
        if (rewarded) {
          n.me.sideToday += 1; n.me.coins += q.coins; n.me.xp += q.xp;
          n.feed.push({ id, at: Date.now(), side: 'us', who: n.me.name, hw: q.title, dmg, quest: true });
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
      const locked = s.shop.filter((x) => (x.kind === 'avatar' || x.kind === 'frame') && !s.me.owned.includes(x.id));
      const win = Math.random() < 0.6 && locked.length ? locked[Math.floor(Math.random() * locked.length)] : null;
      const coins = 30 + Math.floor(Math.random() * 4) * 10;
      up((n) => {
        n.me.chests -= 1;
        if (win) n.me.owned.push(win.id); else n.me.coins += coins;
      });
      setChest(win ? { icon: win.icon || '🖼️', label: (win.kind === 'avatar' ? 'Avatar · ' : 'Frame · ') + win.name } : { icon: '🪙', label: coins + ' coins' });
    };

    // ---------- teacher actions
    const verify = (sub, stars) => {
      const cur = sRef.current;
      const hw = cur.homeworks.find((x) => x.id === sub.hwId);
      const dmg = G.calcDamage({ hw, statuses: sub.statuses, audio: sub.audio, submittedAt: sub.submittedAt, streak: sub.streak, stars });
      const dd = derive(cur, Date.now());
      const fort = G.fortressDamage(dmg.total, cur.myGuild.members.length, dd.enemyShield);
      const isMe = sub.who === cur.me.id;
      const feedId = sub.feedId || uid();
      let defeated = null;
      up((n) => {
        const x = n.submissions.find((y) => y.id === sub.id);
        x.state = 'verified'; x.stars = stars; x.dmg = fort;
        const f = n.feed.find((y) => y.id === feedId);
        const entry = { id: feedId, at: Date.now(), side: 'us', who: sub.whoName, hw: hw.title, dmg: fort, crit: dmg.crit, early: dmg.timing === 'early' };
        if (f) Object.assign(f, entry, { pending: false }); else n.feed.push(entry);
        const member = n.myGuild.members.find((m) => m.id === sub.who);
        if (!n.myGuild.attackers.includes(sub.who)) n.myGuild.attackers.push(sub.who);
        if (member && !member.me && member.stop === n.homeworks.findIndex((y) => y.id === hw.id)) member.stop += 1;
        const boss = n.bosses.find((b) => b.unit === hw.unit && !b.defeated);
        if (boss) {
          boss.dealt = Math.min(boss.hp, boss.dealt + dmg.total);
          boss.contrib = boss.contrib || {};
          boss.contrib[sub.who] = (boss.contrib[sub.who] || 0) + dmg.total;
          if (boss.dealt >= boss.hp) { boss.defeated = true; defeated = boss.name; if (isMe && !n.me.titles.includes('Raid Breaker')) n.me.titles.push('Raid Breaker'); }
        }
        if (isMe) {
          n.me.submitted[hw.id] = 'verified';
          n.me.xp += Math.round(dmg.total / 2);
          n.me.coins += 10 + (dmg.crit ? 15 : 0);
          n.me.seasonPts += dmg.total;
          n.me.streak += dmg.allFull ? 1 : 0;
          if (dmg.allFull) n.me.chests += 1;
          const speakingOk = hw.tasks.some((t, i) => t.type === 'speaking' && sub.audio[i] && sub.statuses[i] === 'Full');
          if (speakingOk) n.me.speakingDone = (n.me.speakingDone || 0) + 1;
          if (n.me.speakingDone >= 1 && !n.me.titles.includes('Speaking Specialist')) n.me.titles.push('Speaking Specialist');
          if (dmg.timing === 'early' && !n.me.titles.includes('Early Bird')) n.me.titles.push('Early Bird');
        }
      });
      setFresh(feedId);
      pop(fort, dmg.crit ? '💥 Critical Hit!' : 'Damage landed on ' + cur.battle.enemy.name, dmg.crit);
      flash(sub.whoName + '\'s homework verified — ' + fort + ' damage landed' + (dmg.allFull && isMe ? ' · 🎁 chest earned' : ''), '✅');
      if (defeated) setTimeout(() => flash(defeated + ' is defeated! The next region is unlocked 🗺️', '🏆'), 1500);
    };
    const returnSub = (sub) => {
      up((n) => {
        n.submissions = n.submissions.filter((x) => x.id !== sub.id);
        if (sub.feedId) n.feed = n.feed.filter((f) => f.id !== sub.feedId);
        if (sub.who === n.me.id) delete n.me.submitted[sub.hwId];
      });
      flash('Sent back to ' + firstName(sub.whoName) + ' to improve — no damage this time', '↩️');
    };

    const reset = () => {
      if (!window.confirm('Reset the demo to its starting state?')) return;
      const fresh0 = G.seed();
      setS(fresh0); setTab('map');
      flash('Demo reset', '↺');
    };

    const studentTabs = [
      ['map', '🗺️', 'Map'], ['battle', '⚔️', 'Battle'], ['raid', '🗿', 'Raid'], ['quests', '📜', 'Quests'], ['me', '🦊', 'Me'],
    ];
    const teacherTabs = [
      ['verify', '✅', 'Verify'], ['battles', '⚔️', 'Battles'], ['bosses', '👹', 'Bosses'], ['class', '👥', 'Class'],
    ];
    const myAvIcon = (s.shop.find((x) => x.id === s.me.avatar) || {}).icon;

    return h('div', { className: cx('shell', minimal && 'minimal') },
      h('header', { className: 'topbar' },
        h('div', { className: 'brand' }, h('div', { className: 'mark' }, 'Q'), h('div', { className: 'wm' }, 'Up', h('span', null, 'Lingo'), ' Quest')),
        role === 'student' && h(React.Fragment, null,
          h('span', { className: 'chip coins', title: 'Coins' }, '🪙 ' + s.me.coins),
          h('span', { className: 'chip lvl', title: 'Level' }, 'Lv ' + d.lvl.lvl)),
        h('div', { className: 'role-toggle', role: 'group', 'aria-label': 'Demo role' },
          h('button', { className: role === 'student' ? 'on' : '', onClick: () => setRole('student') }, 'Student'),
          h('button', { className: role === 'teacher' ? 'on' : '', onClick: () => setRole('teacher') }, 'Teacher'))),

      role === 'student'
        ? h('main', null,
          tab === 'map' && h(MapScreen, { s, d, now, openHw: setHwOpen, go: setTab }),
          tab === 'battle' && h(BattleScreen, { s, d, now, fresh, toggleDuel: () => up((n) => { n.me.duel = !n.me.duel; }) }),
          tab === 'raid' && h(RaidScreen, { s, d, now, go: setTab }),
          tab === 'quests' && h(QuestsScreen, { s, openQuest: setQuestOpen }),
          tab === 'me' && h(ProfileScreen, { s, d, minimal, setMinimal, openShop: () => setShopOpen(true), openChest, setTitle: (t) => up((n) => { n.me.title = t; }), reset }))
        : h('main', null, h(TeacherScreen, { s, d, now, tab: ttab, verify, returnSub, setMatch: (m) => up((n) => { n.battle.matchMode = m; }), addBoss: (b) => { up((n) => { n.bosses.push(b); }); flash('Boss created: ' + b.name, '👹'); }, flash })),

      h('nav', { className: 'tabbar', style: role === 'teacher' ? { gridTemplateColumns: 'repeat(4, 1fr)' } : null },
        (role === 'student' ? studentTabs : teacherTabs).map(([k, icon, label]) => {
          const on = role === 'student' ? tab === k : ttab === k;
          const dot = (role === 'teacher' && k === 'verify' && d.pendingQueue.length > 0) || (role === 'student' && k === 'me' && s.me.chests > 0);
          return h('button', { key: k, className: cx('tab', on && 'on'), onClick: () => (role === 'student' ? setTab(k) : setTtab(k)), 'aria-current': on ? 'page' : undefined },
            h('span', { className: 'ti' }, k === 'me' ? myAvIcon : icon), label, dot && h('span', { className: 'dot' }));
        })),

      hwOpen && h(HomeworkSheet, { key: hwOpen, s, d, now, hwId: hwOpen, onClose: () => setHwOpen(null), submit }),
      questOpen && h(QuestSheet, { key: questOpen, s, qId: questOpen, onClose: () => setQuestOpen(null), complete: completeQuest }),
      shopOpen && h(ShopSheet, { s, onClose: () => setShopOpen(false), buy, equip }),
      chest && h(ChestSheet, { reward: chest, onClose: () => setChest(null) }),
      h('div', { className: 'toasts', 'aria-live': 'polite' }, toasts.map((t) => h('div', { key: t.id, className: 'toast' }, h('span', { style: { fontSize: 18 } }, t.icon), h('span', null, t.text)))),
      boom && h('div', { className: 'boom', key: boom.k }, h('div', { className: cx('n', boom.crit && 'crit') }, '−' + boom.n), h('div', { className: 't', style: { color: boom.crit ? 'var(--gold)' : 'var(--text)' } }, boom.label)));
  };

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
