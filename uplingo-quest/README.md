# UpLingo Quest

The game version of [UpLingo](https://github.com/islom008/UpLingo), built from the *Homework Tracker — Game Design Plan*.

**Same purpose:** teachers assign homework, students self-mark each task (Not full / 50% / 75% / Full), and teachers check the work.
**Different view:** the course is an illustrated world map, each group is a guild (Novza Lions vs Chilonzor Dragons), and approved homework is the only weapon that wins.

The look follows the navy-and-gold mockup: five tabs (Home, Map, Homework, Guild, Profile), Lion and Dragon crests, war banners on the battle screen, a fantasy map with a castle, a river, forest and a locked dark region. Characters, emblems, the castle and trees are 3D images; the rest is drawn in code.

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765   # then open http://localhost:8765/
```

`prototype.html` is the student-only version: the teacher switch is hidden, Ms. Nargiza checks each attack automatically a few seconds later, and a short guide opens on first visit. It is written for hosting as a page, without its own `<html>`/`<head>` wrapper.

To switch to the teacher side, open **Profile → ⚙️ → Teacher view**. Progress is saved in your browser. Use **⚙️ → Reset demo** to start over.

### Try this flow
1. **Homework** → tap *Writing* and *Speaking*, mark them Full, and record the speaking task → **Attack the Dragons**. The damage shows as *pending*.
2. **Profile → ⚙️ → Teacher view** → **Approve** with 3★ → the damage lands as a **Critical Hit**. The boss loses HP, and you earn a chest for a Full homework.
3. **Exit** → **Profile** → open the chest → **Shop & inventory**.
4. **Home → View Battle** for the banners and live activity. **Guild** has the member ranking, the Boss Raid, past battles and duels.
5. **Homework → Extra quest** → pass a check to earn coins (capped at 3 a day).

## UpLingo vs UpLingo Quest

| | UpLingo (today) | UpLingo Quest (this project) |
|---|---|---|
| Home screen | Greeting + stat cards (Full tasks, Half tasks, Overdue) | **World map**: each unit is a region and each homework is an island. Classmates appear as pins. Future units stay locked until the guild beats the boss. |
| Homework | Checklist of tasks with a status per task | Same checklist and statuses, plus a **live damage preview** (task damage, Full bonus, Early Strike, streak, teacher stars) |
| Group | A class list with a ranking inside the group | A **guild** that fights another group of the same level each week, plus a Boss Raid for each unit |
| Ranking | Position within the group (#1, podium…) | Guild members ranked by damage this week. Teammates who haven't attacked aren't listed; students see only a count ("2 teammates haven't attacked"), never names. |
| Points | Full = 20, 75% = 15, 50% = 10 | Damage: grammar/vocab/listening/reading 10, writing 25, speaking 30 (needs audio). Bonuses: +20 for a Full homework, ×1.5 early, ×0.5 late, ×0.5 / ×1 / ×2 for 1–3★, +10% for a 3+ streak |
| Teacher check | Teacher can override a student's status | **Verify** with 1–3 stars. This is what makes the damage land, and the teacher can award a Critical Hit or send the work back. |
| Watch & Read | Library with quizzes | **Side quests** (video, article, shadowing, flashcards). Each one ends with a check and pays mostly coins, capped at 3 a day. |
| Badges | Achievement badges | XP levels, season ranks (Bronze → Diamond), titles ("Grammar Strategist"), and chests |
| Extras | Materials, calendar, AI writing feedback, Telegram reminders | Coin shop (avatars, frames, streak freeze, shield charm; **coins never buy damage**), 1v1 duels, and a **minimal mode** for adult learners |
| Teacher dashboard | Stats, feed, roster, homework builder | Verify queue, battle matchups (automatic or the teacher's choice), boss creator, and a private "who needs help" class view |

Both apps use the same stack: React from a CDN with no build step. Quest uses its own navy-and-gold game look, and the demo is set at Result English School (Upper Intermediate, Unit 5 · The Working World).

## Files

- `game.js` holds the game rules as pure functions (damage, shield, guild-size fairness, levels, ranks) and the demo data. It has no UI code, so the rules can move into a Supabase RPC or edge function unchanged.
- `art.js` draws the crests, banners, map terrain, hero art and chest, and places the 3D images.
- `assets/3d/` holds the 3D artwork (faces, animals, castle, trees, items) from [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT licence (`assets/3d/LICENSE-fluentui-emoji.txt`). They are WebP files, about 650 KB in total.
- `app.js` is the UI: Home, Map, Homework, Guild and Profile tabs, the battle screen, sheets (tasks, rules, quests, shop, settings), and the teacher screens.
- `index.html` contains the styles and script tags.

All numbers are the starting defaults from the design plan, collected at the top of `game.js` so they can be tuned.

## Connecting it to UpLingo's Supabase (next steps)

This is a front-end prototype with demo data. Recording is simulated, and the other guild's attacks are simulated every 40 seconds. To make it real, it can reuse UpLingo's existing tables (`groups`, `students`, `homeworks`, `hw_tasks`, task statuses, speaking audio in Storage, teacher override) and add:

- `battles` (group_a, group_b, starts_at, ends_at) and `attacks` (student, homework, raw_damage, fortress_damage, stars, state `pending|verified|returned`)
- `bosses` (group, unit, name, hp, deadline)
- `side_quests` / `side_quest_completions`, plus `wallets` (xp, coins, season_pts) and `inventory`
- Supabase Realtime on `attacks` for the live feed and HP bars

## Using a painted map

The map is built from layers: textured grass, a river, 3D trees and castles, cloud shadows and fog. To use a painted or AI-generated background instead:

1. Save it as `assets/map/unit5.webp`, portrait, about 780 × 1800 px.
2. In `art.js`, set `const MAP_BG = 'assets/map/unit5.webp';`.

The drawn terrain and trees switch off, and the road, lesson stops, pins, boss and locks still sit on top. If the painting has its own road, move the points in `ROAD`, `LESSON_PTS`, `BOSS_PT` and `LOCK_PTS` (same file) to match. They use a 390 × 900 grid.

## Coursebooks and classes

`courses.js` holds the books taught at RESULT English School:

| Course | Level | Lessons per unit | One class (= one homework) |
|---|---|---|---|
| Navigate | Beginner (A1) | x.1–x.3, x.4 Speaking and writing, x.5 Video | 1.1–1.2, 1.3–1.4, 1.5 |
| Solutions 3rd ed. | Elementary, Pre-Intermediate, Intermediate, Upper-Intermediate | A Vocabulary, B Grammar, C Listening, D Grammar, E Word Skills, F Reading, G Speaking, H Writing | 1A + 1B, 1C + 1D, 1E + 1F, 1G + 1H |

The teacher's **Homework** tab picks a unit and a class; the tasks fill in from the two lessons (e.g. 5G Speaking → "record your answers", 5H Writing → "writing task") and can be edited before sending.
Unit titles were taken from the books' contents pages. Some are not confirmed yet (Navigate units 3–10, Solutions Elementary units 5–9) and show as "Unit n"; fill them in `courses.js` from your copy.

## Fair battles for any group size

Groups range from 2 to 20 students and study different levels, so a battle is scored as a **share of each group's own potential**: if every student finished every homework of the week fully (★★, on time), the group would deal exactly 1,000 HP. A group of 2 and a group of 17, or an Upper-Intermediate and an Intermediate group, can then fight fairly. In battles, bonuses can raise one homework to at most +60% of its normal maximum, so one student in a tiny group can't win alone. Points, rewards and boss damage keep the full bonuses. In the prototype, **Profile → ⚙️ → Group size** restarts the demo with 2–20 students.
