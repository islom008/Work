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
  const FORTRESS_HP = 5000;
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
  // Result English School · Upper Intermediate · Novza Lions vs Chilonzor Dragons.
  const seed = (now = Date.now()) => {
    const H = (h) => now + h * HOUR;
    // 3D portraits from Microsoft's Fluent Emoji (assets/3d, MIT licence).
    const FACES = ['face_man_beard_medium-light', 'face_woman_with_headscarf_light', 'face_person_beard_medium', 'face_boy_medium-light', 'face_woman_curly_hair_light', 'face_man_medium', 'face_woman_medium-light', 'face_man_curly_hair_light', 'face_girl_medium-light', 'face_man_red_hair_light', 'face_woman_light', 'face_man_light', 'face_woman_red_hair_light', 'face_person_curly_hair_medium', 'face_girl_light', 'face_man_medium-light'];
    const P = (name, i, extra = {}) => ({ id: name.toLowerCase().replace(/[^a-z]/g, ''), name, face: FACES[i % FACES.length], ...extra });

    // week = damage landed in this battle so far (before this session).
    const myGuild = {
      id: 'novza', name: 'Novza Lions', crest: 'lion', side: 'blue', teacher: 'Ms. Nargiza', level: 'Upper Intermediate',
      members: [
        P('Sardor', 0, { week: 680, lesson: 3 }), P('Malika', 1, { week: 540, lesson: 3 }),
        P('Islom', 7, { me: true, week: 420 }), P('Kamron', 3, { week: 390, lesson: 2 }),
        P('Aziz', 5, { week: 350, lesson: 3 }), P('Robiya', 4, { week: 310, lesson: 3 }),
        P('Dilnoza', 6, { week: 260, lesson: 2 }), P('Javohir', 9, { week: 220, lesson: 2 }),
        P('Madina', 8, { week: 180, lesson: 2 }), P('Bekzod', 2, { week: 120, lesson: 1 }),
        P('Sevara', 10, { week: 0, lesson: 1 }), P('Otabek', 11, { week: 0, lesson: 1 }),
      ],
    };
    const enemy = {
      id: 'chilonzor', name: 'Chilonzor Dragons', crest: 'dragon', side: 'red', teacher: 'Mr. Timur', level: 'Upper Intermediate',
      members: ['Timur', 'Kamila', 'Rustam', 'Nilufar', 'Shahzod', 'Zarina', 'Jasur', 'Laylo', 'Bobur', 'Feruza', 'Gulnora', 'Ulugbek'].map((n, i) => P(n, i + 4)),
      attackers: ['timur', 'kamila', 'rustam', 'nilufar', 'shahzod', 'zarina', 'jasur', 'laylo'],
    };
    const otherGroups = [
      { id: 'yunusobod', name: 'Yunusobod Wolves', crest: 'wolf', level: 'Upper Intermediate', members: 10, teacher: 'Ms. Dilnoza' },
      { id: 'sergeli', name: 'Sergeli Eagles', crest: 'eagle', level: 'Upper Intermediate', members: 14, teacher: 'Mr. Timur' },
      { id: 'mirobod', name: 'Mirobod Bears', crest: 'bear', level: 'Intermediate', members: 11, teacher: 'Ms. Nargiza' },
    ];

    const units = [
      { unit: 1, name: 'First Impressions' }, { unit: 2, name: 'City Life' }, { unit: 3, name: 'Stories We Tell' },
      { unit: 4, name: 'Mind & Body' }, { unit: 5, name: 'The Working World' }, { unit: 6, name: 'Money Matters' },
      { unit: 7, name: 'Science & Nature' }, { unit: 8, name: 'Global Issues' },
    ];
    const T = (label, type) => ({ label, type });
    const homeworks = [
      { id: 'u5l1', unit: 5, lesson: 1, title: 'Jobs and Careers', dueAt: H(-24 * 6),
        tasks: [T('Vocabulary: job words', 'vocab'), T('Grammar: Present Perfect review', 'grammar'), T('Writing: My dream job', 'writing')] },
      { id: 'u5l2', unit: 5, lesson: 2, title: 'If I Were the Boss', dueAt: H(-24 * 2),
        tasks: [T('Grammar: Second conditional', 'grammar'), T('Listening: Office talk', 'listening'), T('Speaking: My ideal workplace', 'speaking')] },
      { id: 'u5l3', unit: 5, lesson: 3, title: 'A Good Job for Me?', dueAt: H(72),
        tasks: [T('Vocabulary practice', 'vocab'), T('Grammar: Conditionals', 'grammar'), T('Writing: An opinion essay', 'writing'), T('Speaking: Life choices', 'speaking')] },
      { id: 'u5l4', unit: 5, lesson: 4, title: 'The Job Interview', dueAt: H(24 * 5),
        tasks: [T('Reading: Interview tips', 'reading'), T('Speaking: Answer 3 questions', 'speaking')] },
      { id: 'u5l5', unit: 5, lesson: 5, title: 'Career Plans', dueAt: H(24 * 7),
        tasks: [T('Grammar: Future forms', 'grammar'), T('Writing: A cover letter', 'writing')] },
      { id: 'u6l1', unit: 6, lesson: 1, title: 'Money Talks', dueAt: H(24 * 10),
        tasks: [T('Vocabulary: money idioms', 'vocab'), T('Grammar: Wishes', 'grammar')] },
    ];

    const bosses = [
      { unit: 4, name: 'The Mind Mirage', icon: 'eye', hp: 2400, dealt: 2400, deadline: H(-24 * 8), defeated: true },
      { unit: 5, name: 'The Conditional Colossus', icon: 'moai', hp: BOSS_HP_PER_MEMBER * myGuild.members.length, dealt: 1380, deadline: H(24 * 8),
        contrib: { sardor: 310, malika: 260, islom: 190, aziz: 170, robiya: 150, kamron: 130, dilnoza: 90, javohir: 80 } },
      { unit: 6, name: 'The Money Minotaur', icon: 'ox', hp: 2400, dealt: 0, deadline: H(24 * 16) },
    ];

    // Feed items carry the fortress damage that actually landed.
    const F = (id, h, side, who, what, dmg, extra = {}) => ({ id, at: H(h), side, who, what, dmg, ...extra });
    const feed = [
      F('f1', -2, 'us', 'Malika', 'completed a writing task', 25),
      F('f2', -3, 'enemy', 'Kamila', 'completed a speaking task', 30),
      F('f3', -4, 'us', 'Sardor', 'completed a speaking task', 30),
      F('f4', -6, 'us', 'Aziz', 'completed a grammar task', 10),
      F('f5', -7, 'enemy', 'Rustam', 'completed a full homework', 64, { crit: true }),
      F('f6', -8, 'us', 'Robiya', 'completed a full homework bonus', 20),
      F('f7', -11, 'enemy', 'Zarina', 'completed a writing task', 25),
      F('f8', -14, 'us', 'Kamron', 'completed a vocabulary task', 10),
      F('f9', -20, 'us', 'Sardor', 'completed a full homework', 96, { crit: true, early: true }),
    ];
    // Damage from earlier in the week, so the bars open at 4,320 vs 3,190.
    const sum = (side) => feed.filter((f) => f.side === side).reduce((a, f) => a + f.dmg, 0);
    const base = { us: 1810 - sum('us'), enemy: 680 - sum('enemy') };

    const submissions = [
      { id: 's1', who: 'otabek', whoName: 'Otabek', hwId: 'u5l2', statuses: ['Full', '50%', 'Not full'], audio: {}, submittedAt: H(-5), streak: 0, state: 'pending' },
      { id: 's2', who: 'javohir', whoName: 'Javohir', hwId: 'u5l3', statuses: ['Full', 'Full', 'Full', 'Full'], audio: { 3: '1:04' }, submittedAt: H(-1), streak: 4, state: 'pending' },
    ];

    const sideQuests = [
      { id: 'q1', kind: 'video', icon: 'clapper', color: '#E5383B', level: 'Upper Intermediate', title: 'Job interview: do\'s and don\'ts', mins: 4, coins: 5, xp: 15, assigned: true,
        body: 'A recruiter explains what makes a strong answer in a job interview — and the three mistakes she hears most often.',
        check: [
          { q: 'What should a strong answer include?', opts: ['A real example', 'Only adjectives', 'A joke'], a: 0 },
          { q: '"I\'d be a good fit because…" uses which form?', opts: ['Past simple', 'Would + verb', 'Present perfect'], a: 1 },
          { q: 'One common mistake is…', opts: ['Asking questions', 'Speaking badly of an old boss', 'Arriving early'], a: 1 },
        ] },
      { id: 'q2', kind: 'article', icon: 'newspaper', color: '#2F80FF', level: 'Upper Intermediate', title: 'The four-day work week', mins: 3, coins: 5, xp: 10, timed: 60,
        body: 'When a software company in Tashkent cut its week to four days, managers expected output to fall. Instead, it rose by eight percent. Staff took fewer sick days, and the company found it easier to hire. Critics say the model only works where tasks can be measured clearly, and that customer-facing teams still need cover on the fifth day.',
        check: [
          { q: 'What happened to output?', opts: ['It fell', 'It rose by 8%', 'It stayed the same'], a: 1 },
          { q: 'Hiring became…', opts: ['easier', 'harder', 'impossible'], a: 0 },
          { q: 'Critics say the model needs…', opts: ['more managers', 'clearly measurable tasks', 'longer days'], a: 1 },
        ] },
      { id: 'q3', kind: 'shadowing', icon: 'mic', color: '#22C55E', level: 'Upper Intermediate', title: 'Shadow: introducing yourself at work', mins: 5, coins: 5, xp: 20,
        body: 'Listen to each line, then say it at the same speed and rhythm. Record yourself reading all five lines.',
        lines: ['Hi, I\'m Islom — I\'ve just joined the marketing team.', 'I\'ve been working in sales for about two years.', 'If you need anything, just let me know.', 'I\'d love to hear how your team works.', 'Shall we grab a coffee later?'] },
      { id: 'q4', kind: 'flashcards', icon: 'cards', color: '#8B5CF6', level: 'Upper Intermediate', title: 'Unit 5 words', mins: 3, coins: 5, xp: 10, assigned: true,
        cards: [['promotion', 'a move to a higher job'], ['deadline', 'the latest time to finish'], ['colleague', 'a person you work with'], ['salary', 'money paid for work, usually monthly'], ['resign', 'to leave your job by choice'], ['workload', 'the amount of work you have']] },
    ];

    const shop = [
      { id: 'av-me', kind: 'avatar', icon: 'face_man_curly_hair_light', name: 'Classic', price: 0 },
      { id: 'av-owl', kind: 'avatar', icon: 'owl', name: 'Owl Scholar', price: 150 },
      { id: 'av-lion', kind: 'avatar', icon: 'lion', name: 'Lion Guard', price: 180 },
      { id: 'av-sage', kind: 'avatar', icon: 'face_man_mage_light', name: 'Sage', price: 220 },
      { id: 'av-mech', kind: 'avatar', icon: 'robot', name: 'Mech Pilot', price: 250 },
      { id: 'av-dragon', kind: 'avatar', icon: 'dragon', name: 'Dragon', price: 300 },
      { id: 'fr-blue', kind: 'frame', name: 'Royal Blue', price: 0, css: 'linear-gradient(135deg, #5AA2FF, #1E4FD8)' },
      { id: 'fr-gold', kind: 'frame', name: 'Gold', price: 120, css: 'linear-gradient(135deg, #FFE08A, #E09B1B)' },
      { id: 'fr-aurora', kind: 'frame', name: 'Aurora', price: 200, css: 'conic-gradient(#8B5CF6, #2F80FF, #22C55E, #8B5CF6)' },
      { id: 'fr-ember', kind: 'frame', name: 'Ember', price: 220, css: 'conic-gradient(#E5383B, #F97316, #F5B83D, #E5383B)' },
      { id: 'freeze', kind: 'consumable', icon: 'ice', name: 'Streak Freeze', price: 80, desc: 'Miss one day without losing your streak.' },
      { id: 'charm', kind: 'consumable', icon: 'shield', name: 'Guild Shield Charm', price: 100, desc: '+5% guild shield until the end of this battle. One per week.' },
    ];

    return {
      version: 3,
      seededAt: now,
      school: 'Result English School',
      course: { name: 'Upper Intermediate', units: 12 },
      battle: { startedAt: H(-96), endsAt: H(72), enemy, otherGroups, matchMode: 'auto', base,
        history: [{ vs: 'Yunusobod Wolves', won: true, us: 3870, them: 2140 }, { vs: 'Sergeli Eagles', won: false, us: 2950, them: 3310 }, { vs: 'Mirobod Bears', won: true, us: 4120, them: 3600 }] },
      myGuild, units, homeworks, bosses, feed, submissions, sideQuests, shop,
      me: {
        id: 'islom', name: 'Islom', short: 'S-4821',
        xp: 6820, coins: 350, seasonPts: 1450, streak: 5, week: [1, 1, 1, 1, 0, 0, 0], freezes: 0, totalDamage: 2480,
        avatar: 'av-me', frame: 'fr-blue', owned: ['av-me', 'fr-blue'], charmUsed: false,
        title: 'Grammar Strategist', titles: ['Grammar Strategist', 'Early Bird'],
        tasks: { u5l1: ['Full', 'Full', 'Full'], u5l2: ['Full', 'Full', 'Full'], u5l3: ['Full', 'Full', 'Not started', 'Not started'] },
        submitted: { u5l1: 'verified', u5l2: 'verified' },
        audio: { u5l2: { 2: '0:52' } }, sideToday: 0, sideDone: [], chests: 0,
        fullCount: 9, earlyCount: 6, speakingCount: 4,
      },
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
