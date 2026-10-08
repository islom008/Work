# UpLingo Quest

The game version of [UpLingo](https://github.com/islom008/UpLingo), built from the *Homework Tracker — Game Design Plan*.

**Same purpose:** teachers assign homework, students self-mark each task (Not full / 50% / 75% / Full), and teachers check the work.
**Different view:** the course is a world map, each group is a guild, and verified homework is the only weapon that wins.

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765   # then open http://localhost:8765/
```

The **Student / Teacher** toggle in the top bar switches between the two sides of the demo. Progress is saved in your browser. Use **Me → Reset demo** to start over.

### Try this flow
1. **Map** → *Start this homework* → mark tasks, record the speaking task → **Attack**. The damage shows as *pending*.
2. Switch to **Teacher** → **Verify** → give 3★ → the damage lands as a **Critical Hit**. The boss loses HP, and you earn a chest for a Full homework.
3. Back as **Student** → **Me** → open the chest → **Shop**.
4. **Quests** → *The lighthouse keeper* → pass the 1-minute check to earn coins (capped at 3 a day).

## UpLingo vs UpLingo Quest

| | UpLingo (today) | UpLingo Quest (this project) |
|---|---|---|
| Home screen | Greeting + stat cards (Full tasks, Half tasks, Overdue) | **World map**: each unit is a region and each homework is an island. Classmates appear as pins. Future units stay locked until the guild beats the boss. |
| Homework | Checklist of tasks with a status per task | Same checklist and statuses, plus a **live damage preview** (task damage, Full bonus, Early Strike, streak, teacher stars) |
| Group | A class list with a ranking inside the group | A **guild** that fights another group of the same level each week, plus a Boss Raid for each unit |
| Ranking | Position within the group (#1, podium…) | No public bottom. You see **MVP of the Week**, **Most Improved**, and Raid MVPs. Students see counts only ("3 teammates haven't attacked"), never names. |
| Points | Full = 20, 75% = 15, 50% = 10 | Damage: grammar/vocab/listening/reading 10, writing 25, speaking 30 (needs audio). Bonuses: +20 for a Full homework, ×1.5 early, ×0.5 late, ×0.5 / ×1 / ×2 for 1–3★, +10% for a 3+ streak |
| Teacher check | Teacher can override a student's status | **Verify** with 1–3 stars. This is what makes the damage land, and the teacher can award a Critical Hit or send the work back. |
| Watch & Read | Library with quizzes | **Side quests** (video, article, shadowing, flashcards). Each one ends with a check and pays mostly coins, capped at 3 a day. |
| Badges | Achievement badges | XP levels, season ranks (Bronze → Diamond), titles ("Grammar Strategist"), and chests |
| Extras | Materials, calendar, AI writing feedback, Telegram reminders | Coin shop (avatars, frames, streak freeze, shield charm; **coins never buy damage**), 1v1 duels, and a **minimal mode** for adult learners |
| Teacher dashboard | Stats, feed, roster, homework builder | Verify queue, battle matchups (automatic or the teacher's choice), boss creator, and a private "who needs help" class view |

Both apps use the same brand (lime on dark, Archivo/Inter) and the same stack: React from a CDN with no build step. The demo uses UpLingo's data (B1-Evening, Ms. Nargiza, Units 2–6), so the two apps tell the same story.

## Files

- `game.js` holds the game rules as pure functions (damage, shield, guild-size fairness, levels, ranks) and the demo data. It has no UI code, so the rules can move into a Supabase RPC or edge function unchanged.
- `app.js` is the UI: map, battle and live feed, raid, side quests, profile and shop, and the teacher screens.
- `index.html` contains the styles and script tags.

All numbers are the starting defaults from the design plan, collected at the top of `game.js` so they can be tuned.

## Connecting it to UpLingo's Supabase (next steps)

This is a front-end prototype with demo data. Recording is simulated, and the other guild's attacks are simulated every 40 seconds. To make it real, it can reuse UpLingo's existing tables (`groups`, `students`, `homeworks`, `hw_tasks`, task statuses, speaking audio in Storage, teacher override) and add:

- `battles` (group_a, group_b, starts_at, ends_at) and `attacks` (student, homework, raw_damage, fortress_damage, stars, state `pending|verified|returned`)
- `bosses` (group, unit, name, hp, deadline)
- `side_quests` / `side_quest_completions`, plus `wallets` (xp, coins, season_pts) and `inventory`
- Supabase Realtime on `attacks` for the live feed and HP bars
