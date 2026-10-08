// UpLingo Quest · game rules and demo seed.
// Pure functions only (no DOM), so the rules can be unit-tested with Node and
// later moved into a Supabase RPC / edge function unchanged.
// Every number here is a starting default from the design plan, meant to be
// tuned after testing with real groups.
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- rules
  const DAMAGE = { grammar: 10, vocab: 10, listening: 10, reading: 10, writing: 25, speaking: 30 };
  // UpLingo's self-marking statuses map onto a share of the task's damage.
  const STATUS_FACTOR = { 'Full': 1, '75%': 0.75, '50%': 0.5, 'Not full': 0, 'Not started': 0 };
  const STATUSES = ['Not full', '50%', '75%', 'Full'];
  const FULL_BONUS = 20;
  const EARLY_HOURS = 24;
  const EARLY_MULT = 1.5;          // Early Strike
  const LATE_MULT = 0.5;
  const STAR_MULT = { 1: 0.5, 2: 1, 3: 2 }; // 3★ "excellent" = Critical Hit
  const ESTIMATE_STARS = 2;        // what pending damage assumes before the teacher rates it
  const STREAK_MIN = 3;
  const STREAK_BONUS = 0.10;
  const REF_GUILD_SIZE = 10;       // damage is normalised to a 10-student guild
  const FORTRESS_HP = 1000;
  const BOSS_HP_PER_MEMBER = 200;
  const SIDE_QUEST_DAILY_CAP = 3;
  const SIDE_QUEST_DAMAGE = 5;
  const HOUR = 3600 * 1000;

  const taskDamage = (task, status, hasAudio) => {
    if (task.type === 'speaking' && !hasAudio) return 0; // speaking needs real audio
    return (DAMAGE[task.type] || 0) * (STATUS_FACTOR[status] || 0);
  };

  const timingOf = (submittedAt, dueAt) => {
    if (submittedAt > dueAt) return 'late';
    if (dueAt - submittedAt >= EARLY_HOURS * HOUR) return 'early';
    return 'ontime';
  };

  // Raw damage of one homework submission (before guild-size normalisation).
  const calcDamage = ({ hw, statuses, audio = {}, submittedAt, streak = 0, stars = ESTIMATE_STARS }) => {
    const lines = hw.tasks.map((t, i) => ({ label: t.label, type: t.type, status: statuses[i] || 'Not started',
      dmg: taskDamage(t, statuses[i], !!audio[i]), needsAudio: t.type === 'speaking' && !audio[i] }));
    const base = lines.reduce((a, l) => a + l.dmg, 0);
    const allFull = statuses.length === hw.tasks.length && statuses.every((s) => s === 'Full')
      && lines.every((l) => !l.needsAudio);
    const fullBonus = allFull ? FULL_BONUS : 0;
    const timing = timingOf(submittedAt, hw.dueAt);
    const timingMult = timing === 'early' ? EARLY_MULT : timing === 'late' ? LATE_MULT : 1;
    const starMult = STAR_MULT[stars] || 1;
    const streakMult = streak >= STREAK_MIN ? 1 + STREAK_BONUS : 1;
    const total = Math.round((base + fullBonus) * timingMult * starMult * streakMult);
    return { lines, base, fullBonus, allFull, timing, timingMult, stars, starMult, streakMult, total, crit: stars === 3 };
  };

  // Fairness: a 15-student guild must not beat an 8-student guild by headcount.
  const sizeFactor = (members) => REF_GUILD_SIZE / Math.max(1, members);
  // Shield = share of the guild that has attacked this week (plus charms).
  const shieldPct = (attackers, members, bonus = 0) => Math.min(1, attackers / Math.max(1, members) + bonus);
  // Full shield takes 25% less damage; an empty one takes 25% more.
  const incomingMult = (shield) => 1.25 - 0.5 * shield;
  const fortressDamage = (raw, attackerMembers, defenderShield) =>
    Math.round(raw * sizeFactor(attackerMembers) * incomingMult(defenderShield));

  // Levels: level n starts at 50·n·(n-1) XP (0, 100, 300, 600, 1000 …).
  const xpForLevel = (n) => 50 * n * (n - 1);
  const levelFromXp = (xp) => Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2));
  const levelProgress = (xp) => {
    const lvl = levelFromXp(xp);
    const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
    return { lvl, into: xp - lo, need: hi - lo, pct: (xp - lo) / (hi - lo) };
  };
  const RANKS = [
    { name: 'Bronze', min: 0, color: '#C98A5A', icon: '🥉' },
    { name: 'Silver', min: 300, color: '#C9D1DE', icon: '🥈' },
    { name: 'Gold', min: 700, color: '#EAB308', icon: '🥇' },
    { name: 'Platinum', min: 1200, color: '#5EEAD4', icon: '💠' },
    { name: 'Diamond', min: 2000, color: '#93C5FD', icon: '💎' },
  ];
  const rankFor = (pts) => {
    let r = RANKS[0];
    for (const x of RANKS) if (pts >= x.min) r = x;
    const next = RANKS[RANKS.indexOf(r) + 1] || null;
    return { ...r, next, pct: next ? (pts - r.min) / (next.min - r.min) : 1 };
  };

  // ---------------------------------------------------------------- demo seed
  // Mirrors UpLingo's demo data (B1-Evening, Ms. Nargiza, Unit 2–5 homework) so
  // both apps tell the same story.
  const seed = (now = Date.now()) => {
    const H = (h) => now + h * HOUR;
    const P = (name, bg, extra = {}) => ({ id: name.toLowerCase().replace(/[^a-z]/g, ''), name, bg, ...extra });

    const myGuild = {
      id: 'b1-eve', name: 'B1-Evening', teacher: 'Ms. Nargiza', emblem: '🌙', color: '#A8E63D', level: 'B1',
      members: [
        P('Marta Kowalska', '#0FA88A', { me: true, stop: 2 }),
        P('Ana Silva', '#A8E63D', { stop: 3 }),
        P('Elif Demir', '#F97316', { stop: 3 }),
        P('Piotr Nowak', '#8B5CF6', { stop: 2 }),
        P('Yusuf Aydin', '#3B82F6', { stop: 2 }),
        P('Lena Volkova', '#F5E642', { stop: 1 }),
        P('Dilnoza Karimova', '#EC4899', { stop: 3 }),
        P('Javohir Tursunov', '#5EEAD4', { stop: 2 }),
      ],
      attackers: ['anasilva', 'elifdemir', 'dilnozakarimova', 'piotrnowak'],
    };
    const enemy = {
      id: 'b1-mor', name: 'B1-Morning', teacher: 'Mr. Timur', emblem: '☀️', color: '#F97316', level: 'B1',
      members: ['Aziz R.', 'Bekzod M.', 'Sevara U.', 'Kamila N.', 'Timur A.', 'Madina S.', 'Rustam Q.', 'Nilufar O.', 'Sardor B.', 'Zarina H.', 'Otabek F.']
        .map((n, i) => P(n, ['#F97316', '#EAB308', '#EF4444', '#F5E642'][i % 4])),
      attackers: ['azizr', 'bekzodm', 'sevarau', 'kamilan', 'madinas', 'sardorb'],
    };
    const otherGroups = [
      { id: 'b1-wkd', name: 'B1-Weekend', teacher: 'Ms. Dilnoza', emblem: '🎯', level: 'B1', members: 9 },
      { id: 'a2-mor', name: 'A2-Morning', teacher: 'Ms. Nargiza', emblem: '🌤️', level: 'A2', members: 12 },
      { id: 'b2-eve', name: 'B2-Evening', teacher: 'Mr. Timur', emblem: '🚀', level: 'B2', members: 7 },
    ];

    const homeworks = [
      { id: 'u2', unit: 2, title: 'Unit 2 · Writing & Speaking', dueAt: H(-24 * 14),
        tasks: [{ label: 'Workbook p.21, exercises A–C', type: 'grammar' }, { label: 'Write 100 words about your city', type: 'writing' }, { label: 'Record: introduce your family', type: 'speaking' }] },
      { id: 'u3', unit: 3, title: 'Unit 3 · Reading', dueAt: H(-24 * 7),
        tasks: [{ label: 'Read text 3B, answer 1–8', type: 'reading' }, { label: '15 words from the reading', type: 'vocab' }, { label: 'Summary, 80 words', type: 'writing' }] },
      { id: 'u4a', unit: 4, title: 'Unit 4 · Present Perfect', dueAt: H(50),
        tasks: [{ label: 'Unit 4, exercises 1–6', type: 'grammar' }, { label: '20 words — Quizlet set', type: 'vocab' }, { label: '120-word email to a friend', type: 'writing' }, { label: 'Record 60s about your weekend', type: 'speaking' }] },
      { id: 'u4b', unit: 4, title: 'Unit 4 · Since & For', dueAt: H(122),
        tasks: [{ label: 'Workbook p.38, gap fill', type: 'grammar' }, { label: 'Listening 4.3, questions 1–5', type: 'listening' }] },
      { id: 'u5a', unit: 5, title: 'Unit 5 · Past Simple', dueAt: H(24 * 9), tasks: [{ label: 'Unit 5, exercises 1–4', type: 'grammar' }, { label: 'Talk about last weekend', type: 'speaking' }] },
      { id: 'u5b', unit: 5, title: 'Unit 5 · Irregular verbs', dueAt: H(24 * 12), tasks: [{ label: '30 irregular verbs', type: 'vocab' }] },
      { id: 'u6a', unit: 6, title: 'Unit 6 · First Conditional', dueAt: H(24 * 16), tasks: [{ label: 'Exercises 1–5', type: 'grammar' }, { label: 'Essay: if I could…', type: 'writing' }] },
    ];

    const regions = [
      { unit: 2, name: 'Weather Coast', icon: '🌤️', color: '#0FA88A' },
      { unit: 3, name: 'Storyteller Woods', icon: '🌲', color: '#22C55E' },
      { unit: 4, name: 'Present Perfect Peaks', icon: '🏔️', color: '#3B82F6' },
      { unit: 5, name: 'Past Simple Ruins', icon: '🏛️', color: '#EAB308' },
      { unit: 6, name: 'Conditional Crater', icon: '🌋', color: '#EF4444' },
    ];
    const stopIcons = { u2: '🔑', u3: '📜', u4a: '💎', u4b: '🧭', u5a: '🏺', u5b: '⚱️', u6a: '🔮' };

    const bosses = [
      { unit: 3, name: 'The Narrative Wraith', icon: '👻', hp: 1600, dealt: 1600, deadline: H(-24 * 7), defeated: true },
      { unit: 4, name: 'The Perfect Tense Titan', icon: '🗿', hp: BOSS_HP_PER_MEMBER * myGuild.members.length, dealt: 935, deadline: H(130),
        contrib: { anasilva: 230, elifdemir: 195, dilnozakarimova: 260, piotrnowak: 120, javohirtursunov: 85, yusufaydin: 45 } },
      { unit: 5, name: 'The Irregular Hydra', icon: '🐍', hp: 1600, dealt: 0, deadline: H(24 * 13) },
      { unit: 6, name: 'The Conditional Colossus', icon: '🌋', hp: 1600, dealt: 0, deadline: H(24 * 18) },
    ];

    // Feed items carry the final fortress damage already normalised for guild size and shield.
    const feed = [
      { id: 'f1', at: H(-70), side: 'enemy', who: 'Aziz R.', hw: 'Unit 4 · Present Perfect', dmg: 64 },
      { id: 'f2', at: H(-66), side: 'us', who: 'Dilnoza Karimova', hw: 'Unit 4 · Present Perfect', dmg: 118, crit: true },
      { id: 'f3', at: H(-50), side: 'enemy', who: 'Sevara U.', hw: 'Unit 4 · Present Perfect', dmg: 71, crit: true },
      { id: 'f4', at: H(-44), side: 'us', who: 'Ana Silva', hw: 'Unit 4 · Present Perfect', dmg: 96, early: true },
      { id: 'f5', at: H(-30), side: 'enemy', who: 'Bekzod M.', hw: 'Unit 4 · Present Perfect', dmg: 58 },
      { id: 'f6', at: H(-26), side: 'enemy', who: 'Kamila N.', hw: 'Unit 4 · Present Perfect', dmg: 49 },
      { id: 'f7', at: H(-20), side: 'us', who: 'Elif Demir', hw: 'Unit 4 · Present Perfect', dmg: 88, early: true },
      { id: 'f8', at: H(-12), side: 'enemy', who: 'Madina S.', hw: 'Unit 4 · Present Perfect', dmg: 66 },
      { id: 'f9', at: H(-7), side: 'us', who: 'Piotr Nowak', hw: 'Unit 4 · Present Perfect', dmg: 42 },
      { id: 'f10', at: H(-3), side: 'enemy', who: 'Sardor B.', hw: 'Unit 4 · Present Perfect', dmg: 77 },
    ];

    // Teammates' self-marked work waiting for the teacher (shows as pending damage).
    const submissions = [
      { id: 's1', who: 'yusufaydin', whoName: 'Yusuf Aydin', hwId: 'u4a', statuses: ['Full', '50%', 'Not full', 'Not started'], audio: {}, submittedAt: H(-5), streak: 0, state: 'pending' },
      { id: 's2', who: 'javohirtursunov', whoName: 'Javohir Tursunov', hwId: 'u4a', statuses: ['Full', 'Full', 'Full', 'Full'], audio: { 3: '0:58' }, submittedAt: H(-2), streak: 4, state: 'pending' },
    ];

    const sideQuests = [
      { id: 'q1', kind: 'video', icon: '🎬', color: '#EF4444', level: 'B1', title: '"Just", "already" and "yet" in real speech', mins: 4, coins: 20, xp: 15, assigned: true,
        body: 'Three short clips of native speakers using the present perfect with just, already and yet. Watch for where each word sits in the sentence.',
        check: [
          { q: 'Where does "already" usually go?', opts: ['After the main verb', 'Between have and the past participle', 'At the very start'], a: 1 },
          { q: '"Have you finished ___?" — which word fits at the end?', opts: ['yet', 'already', 'just'], a: 0 },
          { q: '"I\'ve just seen her" means…', opts: ['a long time ago', 'a very short time ago', 'never'], a: 1 },
        ] },
      { id: 'q2', kind: 'article', icon: '📰', color: '#3B82F6', level: 'B1', title: 'The lighthouse keeper', mins: 3, coins: 15, xp: 10, timed: 60,
        body: 'Every evening at ten past seven, Anders climbed the ninety-two steps to the lantern room. He had been doing it for forty-one years, and had never once been late. The light had kept ships off the rocks through storms that tore roofs from the village below. When the coastguard wrote to say the lighthouse would become automatic, Anders read the letter twice, folded it carefully, and climbed the steps anyway.',
        check: [
          { q: 'How long had Anders been doing the job?', opts: ['Ninety-two years', 'Forty-one years', 'Ten years'], a: 1 },
          { q: '"Tore roofs from" suggests the storms were…', opts: ['gentle', 'very strong', 'short'], a: 1 },
          { q: 'What did the coastguard\'s letter say?', opts: ['The light would be automatic', 'Anders was late', 'The village was moving'], a: 0 },
        ] },
      { id: 'q3', kind: 'shadowing', icon: '🎙️', color: '#A8E63D', level: 'B1', title: 'Shadow the airport dialogue', mins: 5, coins: 25, xp: 20,
        body: 'Listen to each line, then say it at the same speed and rhythm. Record yourself reading all five lines.',
        lines: ['Could I see your passport, please?', 'Have you packed these bags yourself?', 'Your flight has been delayed by forty minutes.', 'I\'ve never flown with this airline before.', 'Boarding starts at gate twelve.'] },
      { id: 'q4', kind: 'flashcards', icon: '🃏', color: '#8B5CF6', level: 'B1', title: 'Unit 4 words', mins: 3, coins: 15, xp: 10, assigned: true,
        cards: [['achievement', 'something you did well with effort'], ['recently', 'not long ago'], ['experience', 'something that happened to you'], ['ever', 'at any time (in questions)'], ['manage to', 'succeed in doing something difficult'], ['so far', 'until now']] },
      { id: 'q5', kind: 'video', icon: '🎬', color: '#EF4444', level: 'A2', title: 'Comparatives at the market', mins: 3, coins: 15, xp: 10,
        body: 'A shopper compares prices and quality at a market stall.',
        check: [
          { q: 'The comparative of "cheap" is…', opts: ['more cheap', 'cheaper', 'cheapest'], a: 1 },
          { q: 'The comparative of "good" is…', opts: ['gooder', 'better', 'more good'], a: 1 },
          { q: '"This one is ___ expensive than that one."', opts: ['more', 'most', 'much'], a: 0 },
        ] },
      { id: 'q6', kind: 'article', icon: '📰', color: '#3B82F6', level: 'C1', title: 'On silence', mins: 4, coins: 20, xp: 15, timed: 60,
        body: 'Silence in conversation is a form of speech; it says something the words could not carry. A pause before an answer can signal care, doubt or refusal, and listeners read it with surprising accuracy.',
        check: [
          { q: 'According to the text, silence is…', opts: ['the absence of meaning', 'a form of speech', 'always rude'], a: 1 },
          { q: 'A pause before an answer can signal…', opts: ['only agreement', 'care, doubt or refusal', 'nothing'], a: 1 },
          { q: 'Listeners read pauses…', opts: ['with surprising accuracy', 'badly', 'only in writing'], a: 0 },
        ] },
    ];

    const shop = [
      { id: 'av-fox', kind: 'avatar', icon: '🦊', name: 'Fox Scout', price: 0 },
      { id: 'av-owl', kind: 'avatar', icon: '🦉', name: 'Owl Scholar', price: 150 },
      { id: 'av-wolf', kind: 'avatar', icon: '🐺', name: 'Night Wolf', price: 180 },
      { id: 'av-sage', kind: 'avatar', icon: '🧙', name: 'Sage', price: 220 },
      { id: 'av-mech', kind: 'avatar', icon: '🤖', name: 'Mech Pilot', price: 250 },
      { id: 'av-dragon', kind: 'avatar', icon: '🐉', name: 'Dragon', price: 300 },
      { id: 'fr-none', kind: 'frame', name: 'Plain', price: 0, css: 'var(--border-hi)' },
      { id: 'fr-lime', kind: 'frame', name: 'Neon Lime', price: 120, css: 'conic-gradient(#A8E63D, #0FA88A, #A8E63D)' },
      { id: 'fr-aurora', kind: 'frame', name: 'Aurora', price: 200, css: 'conic-gradient(#8B5CF6, #3B82F6, #0FA88A, #8B5CF6)' },
      { id: 'fr-ember', kind: 'frame', name: 'Ember', price: 220, css: 'conic-gradient(#EF4444, #F97316, #EAB308, #EF4444)' },
      { id: 'fr-obsidian', kind: 'frame', name: 'Obsidian', price: 260, css: 'conic-gradient(#1f2937, #64748b, #e2e8f0, #64748b, #1f2937)' },
      { id: 'freeze', kind: 'consumable', icon: '🧊', name: 'Streak Freeze', price: 80, desc: 'Miss one lesson without losing your streak.' },
      { id: 'charm', kind: 'consumable', icon: '🛡️', name: 'Guild Shield Charm', price: 100, desc: '+5% guild shield until the end of this battle. One per week.' },
    ];

    return {
      version: 1,
      seededAt: now,
      battle: { startedAt: H(-96), endsAt: H(56), enemy, otherGroups, matchMode: 'auto' },
      myGuild, homeworks, regions, stopIcons, bosses, feed, submissions, sideQuests, shop,
      me: {
        id: 'martakowalska', name: 'Marta Kowalska', short: 'S-4821', bg: '#0FA88A',
        xp: 540, coins: 160, seasonPts: 620, streak: 2, freezes: 0,
        avatar: 'av-fox', frame: 'fr-none', owned: ['av-fox', 'fr-none'], charmUsed: false,
        title: 'Grammar Strategist', titles: ['Grammar Strategist'],
        tasks: { u2: ['Full', 'Full', 'Full'], u3: ['Full', 'Full', 'Full'] },
        submitted: { u2: 'verified', u3: 'verified' },
        audio: {}, sideToday: 0, sideDone: [], chests: 0,
      },
      notifs: [],
    };
  };

  const Game = {
    DAMAGE, STATUS_FACTOR, STATUSES, FULL_BONUS, EARLY_HOURS, EARLY_MULT, LATE_MULT, STAR_MULT, ESTIMATE_STARS,
    STREAK_MIN, STREAK_BONUS, REF_GUILD_SIZE, FORTRESS_HP, BOSS_HP_PER_MEMBER, SIDE_QUEST_DAILY_CAP, SIDE_QUEST_DAMAGE, HOUR, RANKS,
    taskDamage, timingOf, calcDamage, sizeFactor, shieldPct, incomingMult, fortressDamage,
    xpForLevel, levelFromXp, levelProgress, rankFor, seed,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
