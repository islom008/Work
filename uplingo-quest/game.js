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

  // Fairness: groups range from 2 to 20 students, study different levels and get different
  // amounts of homework. So a battle is scored as a share of each group's own potential:
  // if every student did every homework of the week fully (★★, on time), the group would
  // deal exactly FORTRESS_HP. Bonuses (early, 3★, streaks) can push a group above that.
  const maxRaw = (hw) => hw.tasks.reduce((a, t) => a + (DAMAGE[t.type] || 0), 0) + FULL_BONUS;
  const weeklyMax = (members, perStudent) => Math.max(1, members * perStudent);
  // Shield = share of the guild that has attacked this week (plus charms).
  const shieldPct = (attackers, members, bonus = 0) => Math.min(1, attackers / Math.max(1, members) + bonus);
  // Full shield takes 25% less damage; an empty one takes 25% more.
  const incomingMult = (shield) => 1.25 - 0.5 * shield;
  // In battles, bonuses can lift one homework to at most +60% of its normal maximum, so a
  // single student in a group of 2 can't flatten the other fortress alone.
  const BATTLE_CAP = 1.6;
  const fortressDamage = (raw, attackerWeeklyMax, defenderShield, hw) => {
    const capped = hw ? Math.min(raw, maxRaw(hw) * BATTLE_CAP) : raw;
    return Math.round((capped / Math.max(1, attackerWeeklyMax)) * FORTRESS_HP * incomingMult(defenderShield));
  };

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
  // Result English School. Islom's group (Novza Lions) studies Solutions 3rd ed. Upper-Intermediate;
  // this week they battle the Chilonzor Dragons, a bigger Intermediate group, which the
  // share-of-potential scoring makes a fair fight. `size` sets the demo group size (2–20).
  const NAMES = ['Sardor', 'Malika', 'Islom', 'Kamron', 'Aziz', 'Robiya', 'Dilnoza', 'Javohir', 'Madina', 'Bekzod',
    'Sevara', 'Otabek', 'Nodira', 'Jamshid', 'Gulnoza', 'Firdavs', 'Shahlo', 'Asadbek', 'Mohira', 'Doniyor'];
  const ENEMY_NAMES = ['Timur', 'Kamila', 'Rustam', 'Nilufar', 'Shahzod', 'Zarina', 'Jasur', 'Laylo', 'Bobur', 'Feruza',
    'Gulnora', 'Ulugbek', 'Diyora', 'Sanjar', 'Muslima', 'Akmal', 'Yulduz'];
  // 3D portraits from Microsoft's Fluent Emoji (assets/3d, MIT licence).
  const FACES = ['face_man_beard_medium-light', 'face_woman_with_headscarf_light', 'face_man_curly_hair_light', 'face_boy_medium-light', 'face_man_medium', 'face_woman_curly_hair_light', 'face_woman_medium-light', 'face_man_red_hair_light', 'face_girl_medium-light', 'face_person_beard_medium', 'face_woman_light', 'face_man_light', 'face_woman_red_hair_light', 'face_person_curly_hair_medium', 'face_girl_light', 'face_man_medium-light', 'face_woman_with_headscarf_medium-light', 'face_boy_light', 'face_woman_curly_hair_medium', 'face_man_beard_light'];
  const C = root.Courses || (typeof require !== 'undefined' ? require('./courses.js') : null);

  // Turn a coursebook unit into homeworks, one per class (two lessons each).
  const unitHomeworks = (course, unit, dues) => C.sessionsOf(course, unit).map((ses, i) => ({
    id: course.id + '-u' + unit + '-s' + (i + 1), course: course.id, unit, idx: i + 1,
    label: ses.label, title: ses.title, codes: ses.codes,
    dueAt: dues[i], tasks: C.defaultTasks(course, unit, ses.lessons),
  }));

  const seed = (now = Date.now(), opts = {}) => {
    const size = Math.max(2, Math.min(20, opts.size || 12));
    const H = (h) => now + h * HOUR;
    const P = (name, i, extra = {}) => ({ id: name.toLowerCase().replace(/[^a-z]/g, ''), name, face: FACES[i % FACES.length], ...extra });
    const upper = C.COURSES['solutions-upper'], inter = C.COURSES['solutions-int'];

    // Unit 5 "Relationships": 5A+5B, 5C+5D, 5E+5F done or due this week; 5G+5H is today's homework.
    const u5 = unitHomeworks(upper, 5, [H(-24 * 7), H(-60), H(-12), H(50)]);
    const u6 = unitHomeworks(upper, 6, [H(24 * 5), H(24 * 7), H(24 * 9), H(24 * 11)]);
    // Only the first class of Unit 6 is planned so far; the teacher gives the rest from the builder.
    const homeworks = [...u5, u6[0]];
    // A battle covers the three classes of the week.
    const weekHws = u5.slice(1, 4);
    const perStudentUs = weekHws.reduce((a, hw) => a + maxRaw(hw), 0);
    const perStudentEnemy = unitHomeworks(inter, 6, [0, 0, 0, 0]).slice(1, 4).reduce((a, hw) => a + maxRaw(hw), 0);

    // Members: Islom is always in; the rest fill up to the chosen size.
    const names = ['Islom', ...NAMES.filter((n) => n !== 'Islom')].slice(0, size)
      .sort((a, b) => NAMES.indexOf(a) - NAMES.indexOf(b));
    const WEEK = [118, 96, 74, 70, 62, 55, 46, 40, 32, 22, 0, 0, 51, 38, 27, 66, 44, 12, 0, 30];
    const members = names.map((n) => {
      const i = NAMES.indexOf(n);
      const me = n === 'Islom';
      return P(n, i, { me, week: WEEK[i], lesson: me ? undefined : (WEEK[i] === 0 ? 3 : WEEK[i] > 60 ? 4 : 3) });
    });
    // In tiny groups make sure at least one teammate has already attacked.
    if (members.filter((m) => !m.me && m.week > 0).length === 0) members.find((m) => !m.me).week = 58;
    const myGuild = { id: 'novza', name: 'Novza Lions', crest: 'lion', side: 'blue', teacher: 'Ms. Nargiza', course: upper.id, level: upper.level, members };

    const enemy = {
      id: 'chilonzor', name: 'Chilonzor Dragons', crest: 'dragon', side: 'red', teacher: 'Mr. Timur', course: inter.id, level: inter.level,
      members: ENEMY_NAMES.map((n, i) => P(n, i + 5)),
      attackers: ENEMY_NAMES.slice(0, 11).map((n) => n.toLowerCase()),
      perStudent: perStudentEnemy,
    };
    const otherGroups = [
      { id: 'yunusobod', name: 'Yunusobod Wolves', crest: 'wolf', level: 'Upper-Intermediate', members: 6, teacher: 'Ms. Dilnoza' },
      { id: 'sergeli', name: 'Sergeli Eagles', crest: 'eagle', level: 'Pre-Intermediate', members: 19, teacher: 'Mr. Timur' },
      { id: 'mirobod', name: 'Mirobod Bears', crest: 'bear', level: 'Beginner', members: 3, teacher: 'Ms. Nargiza' },
    ];

    const units = upper.units.map((t, i) => ({ unit: i + 1, name: C.unitTitle(upper, i + 1) }));
    const myMax = members.length * perStudentUs, enemyMax = enemy.members.length * perStudentEnemy;
    const bossHp = BOSS_HP_PER_MEMBER * members.length;
    const contrib = {};
    members.forEach((m) => { if (!m.me && m.week > 0) contrib[m.id] = Math.round(m.week * 2.2); });
    contrib.islom = 150;
    const dealt = Math.min(Math.round(bossHp * 0.58), Object.values(contrib).reduce((a, v) => a + v, 0));
    const bosses = [
      { unit: 4, name: 'The Wanderlust Wraith', icon: 'eye', hp: bossHp, dealt: bossHp, deadline: H(-24 * 8), defeated: true },
      { unit: 5, name: 'The Relationship Riddler', icon: 'moai', hp: bossHp, dealt, deadline: H(24 * 4), contrib },
      { unit: 6, name: 'The Health Hydra', icon: 'ox', hp: bossHp, dealt: 0, deadline: H(24 * 12) },
    ];

    // Seeded activity: whole-homework attacks, sized for this group.
    const atk = (raw, mine) => fortressDamage(raw, mine ? myMax : enemyMax, 0.8);
    const mates = members.filter((m) => !m.me && m.week > 0);
    const F = (id, h, side, who, what, raw, extra = {}) => ({ id, at: H(h), side, who, what, dmg: atk(raw, side === 'us'), ...extra });
    const feed = [
      mates[1] && F('f1', -2, 'us', mates[1].name, 'completed 5E + 5F', 40),
      F('f2', -3, 'enemy', 'Kamila', 'completed 6E + 6F', 60, { early: true }),
      mates[0] && F('f3', -5, 'us', mates[0].name, 'completed 5E + 5F', 64, { crit: true, early: true }),
      F('f4', -7, 'enemy', 'Rustam', 'completed 6C + 6D', 64, { crit: true }),
      mates[2] && F('f5', -10, 'us', mates[2].name, 'completed 5E + 5F', 30),
      F('f6', -14, 'enemy', 'Zarina', 'completed 6C + 6D', 40),
      mates[3] && F('f7', -20, 'us', mates[3].name, 'completed 5C + 5D', 40),
    ].filter(Boolean);
    // Earlier in the week: the bars open at about 86% vs 64%.
    const sum = (side) => feed.filter((f) => f.side === side).reduce((a, f) => a + f.dmg, 0);
    const base = { us: Math.max(0, 362 - sum('us')), enemy: Math.max(0, 136 - sum('enemy')) };

    const pendingMates = members.filter((m) => !m.me).slice(-2);
    const submissions = pendingMates.map((m, i) => ({
      id: 's' + (i + 1), who: m.id, whoName: m.name, hwId: u5[3].id,
      statuses: i === 0 ? ['Full', '50%'] : ['Full', 'Full'], audio: i === 0 ? {} : { 0: '1:04' },
      submittedAt: H(-5 + i * 4), streak: i * 4, state: 'pending',
    }));

    const sideQuests = [
      { id: 'q1', kind: 'video', icon: 'clapper', color: '#E5383B', level: 'Upper-Intermediate', title: 'How friendships change as we grow up', mins: 4, coins: 5, xp: 15, assigned: true,
        body: 'Three people talk about a friend they lost touch with and one they still see every week.',
        check: [
          { q: '"To lose touch with someone" means…', opts: ['to stop being in contact', 'to argue', 'to meet again'], a: 0 },
          { q: '"We get on really well" means…', opts: ['we often travel', 'we have a good relationship', 'we work together'], a: 1 },
          { q: '"I look up to my older sister" means…', opts: ['I admire her', 'I visit her', 'I am taller than her'], a: 0 },
        ] },
      { id: 'q2', kind: 'article', icon: 'newspaper', color: '#2F80FF', level: 'Upper-Intermediate', title: 'Why we text instead of calling', mins: 3, coins: 5, xp: 10, timed: 60,
        body: 'A survey of 2,000 young adults found that most of them would rather send a message than make a phone call. Texting gives people time to think about what they want to say, and it doesn\'t interrupt the other person. However, many also said that a voice call feels warmer, and that they save calls for the people they are closest to.',
        check: [
          { q: 'Why do people prefer texting?', opts: ['It is cheaper', 'They have time to think', 'It is faster to type'], a: 1 },
          { q: 'Calls are kept for…', opts: ['work', 'the closest people', 'emergencies only'], a: 1 },
          { q: '"Warmer" here means…', opts: ['more friendly', 'hotter', 'longer'], a: 0 },
        ] },
      { id: 'q3', kind: 'shadowing', icon: 'mic', color: '#22C55E', level: 'Upper-Intermediate', title: 'Shadow: talking about a close friend', mins: 5, coins: 5, xp: 20,
        body: 'Listen to each line, then say it at the same speed and rhythm. Record yourself reading all five lines.',
        lines: ['I\'ve known Aziz since we were seven.', 'We\'ve been through a lot together.', 'He always tells me the truth, even when I don\'t want to hear it.', 'We don\'t see each other as often as we used to.', 'But when we meet, it\'s as if nothing has changed.'] },
      { id: 'q4', kind: 'flashcards', icon: 'cards', color: '#8B5CF6', level: 'Upper-Intermediate', title: 'Unit 5 words', mins: 3, coins: 5, xp: 10, assigned: true,
        cards: [['get on with', 'have a good relationship with'], ['fall out', 'stop being friends after an argument'], ['make up', 'become friends again'], ['look up to', 'admire and respect'], ['rely on', 'trust and depend on'], ['bring up', 'raise a child']] },
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

    const done = (hw) => hw.tasks.map(() => 'Full');
    return {
      version: 4,
      seededAt: now,
      groupSize: size,
      school: 'Result English School',
      course: { id: upper.id, name: upper.book + ' ' + upper.level, level: upper.level, units: upper.units.length },
      battle: { startedAt: H(-96), endsAt: H(72), enemy, otherGroups, matchMode: 'auto', base, perStudent: perStudentUs,
        history: [{ vs: 'Yunusobod Wolves', won: true, us: 71, them: 58 }, { vs: 'Sergeli Eagles', won: false, us: 64, them: 69 }, { vs: 'Mirobod Bears', won: true, us: 82, them: 77 }] },
      myGuild, units, homeworks, bosses, feed, submissions, sideQuests, shop,
      me: {
        id: 'islom', name: 'Islom', short: 'S-4821',
        xp: 6820, coins: 350, seasonPts: 1450, streak: 5, week: [1, 1, 1, 1, 0, 0, 0], freezes: 0, totalDamage: 2480,
        avatar: 'av-me', frame: 'fr-blue', owned: ['av-me', 'fr-blue'], charmUsed: false,
        title: 'Grammar Strategist', titles: ['Grammar Strategist', 'Early Bird'],
        tasks: { [u5[0].id]: done(u5[0]), [u5[1].id]: done(u5[1]), [u5[2].id]: done(u5[2]) },
        submitted: { [u5[0].id]: 'verified', [u5[1].id]: 'verified', [u5[2].id]: 'verified' },
        audio: {}, sideToday: 0, sideDone: [], chests: 0,
        fullCount: 9, earlyCount: 6, speakingCount: 4,
      },
    };
  };

  const Game = {
    DAMAGE, STATUS_FACTOR, STATUSES, FULL_BONUS, EARLY_HOURS, EARLY_MULT, LATE_MULT, STAR_MULT, ESTIMATE_STARS,
    STREAK_MIN, STREAK_BONUS, FORTRESS_HP, BATTLE_CAP, BOSS_HP_PER_MEMBER, SIDE_QUEST_DAILY_CAP, SIDE_QUEST_DAMAGE, HOUR, RANKS,
    taskDamage, timingOf, calcDamage, maxRaw, weeklyMax, shieldPct, incomingMult, fortressDamage,
    xpForLevel, levelFromXp, levelProgress, rankFor, seed,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
