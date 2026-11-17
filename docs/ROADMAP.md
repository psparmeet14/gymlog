# Gymlog roadmap

Written 17 Nov 2026 from a review of the code at commit `8752649`. This file is a plan. Nothing in the app has changed.

**How to use it.** Each phase is sized for one Claude Code session and one pull request. Merge this file into `main` so new sessions can read it, then paste that phase's prompt into a new session. Do the phases in order unless a phase says it can move.

## Where the app stands

### Worth keeping

- It opens on today's workout with last time's numbers and a target to beat.
- Workouts rotate from the last one logged, so a three-session week never skips a workout.
- It is 55 KB with no dependencies, works offline, and keeps data on the device.
- After 14 days away it restarts at about 90%.

### Problems found

| # | Problem | Where | Fixed in |
|---|---|---|---|
| 1 | Saved data the app can't read (damaged, or written by a newer version) is replaced by an empty log at startup. | `load()` at `app.js:54`, first save at `app.js:147` | Phase 1 |
| 2 | Restoring an incomplete backup replaces everything, keeps no copy of what was there, and leaves Progress and Plan unable to open. | `app.js:501` | Phase 1 |
| 3 | Backups happen only when you remember. Nothing shows when the last one was. | `app.js:482` | Phase 1 |
| 4 | The app asks the browser to protect its storage and ignores the answer. On an iPhone, a site used in a Safari tab loses its data after seven days of Safari use without a visit. | `app.js:551` | Phase 1 |
| 5 | A few values go into the page unescaped (dates, weights, plan numbers). A crafted backup file could run script. | `app.js:281`, `330`, `361`, `366` | Phase 1 |
| 6 | Leg curl is in two workouts with different set counts (3 and 2). Every Lower body 1, the app misreads last time as ramped sets, shows "Same weight on every set from now on" and asks for falling reps. | `app.js:111–125` | Phase 3 |
| 7 | Timed holds are told "Same weight, one more rep" and go up one second at a time. | `app.js:117–119` | Phase 3 |
| 8 | The volume warning says "Aim for 10 or more per muscle. Doing every planned set gets you there." The default plan gives chest 9, back 9, shoulders 8 and hamstrings & glutes 8 sets a week at four sessions, and 6–7 at three, where the warning never clears. | `app.js:10`, `app.js:203` | Phase 3 |
| 9 | "Do this next" can spend all three lines on one cause. Days since the last session, sessions a week and low volume are the same problem. | `app.js:194` | Phase 3 |
| 10 | Numbers without labels: the bold figure in each Strength row is an estimated one-rep max; the hard-sets card shows "0 avg 2". | `app.js:297`, `app.js:324` | Phase 3 |
| 11 | Nothing can be reordered or renamed, and an exercise's muscle can't be seen or changed after it is created. | `app.js:356` | Phase 3 |
| 12 | With weak signal the app waits up to 2.5 seconds per file for the network before using its saved copy. | `sw.js:17` | Phase 2 |
| 13 | No tests and no automated checks. One 553-line file whose logic reads shared state and the clock directly, so it can't be tested outside a browser. | whole repo | Phases 1–2 |
| 14 | Personal assumptions are built in: kg only, barbell weight entered per side, 130 g protein, "history.json", "Four days". | `app.js:7`, `52`, `196`, `357`, `369` | Phase 8 |

Problems 1, 2, 6, 7 and 8 were reproduced in a test browser with sample data. The app was not tested on a real phone.

## Decisions

Each decision gives the choice, the reason, and what would change it.

### 1. Stay a web app in plain JavaScript

No framework, no bundler, no rewrite. The hard problems here are keeping data safe and giving clear advice. A rewrite in React or a native toolkit solves neither and adds a build chain to maintain. Split the code into modules and test the logic instead (Phase 2).

Revisit when people ask for things only a native app can do: a timer alert through a locked screen, Apple Health or Health Connect, a listing in the iPhone App Store.

### 2. Keep the data in localStorage; add snapshots in IndexedDB

A year of logging is about 100 KB against a limit near 5 MB, and browsers clear localStorage no sooner than IndexedDB. Moving the main data would add risk without adding safety. Snapshots need more room, so they go in IndexedDB.

Revisit when the main data passes 2 MB.

### 3. Automatic backup through Firebase, behind an interface

| | Firebase (Auth + Firestore) | Supabase | Your own Spring Boot service | Google Drive app folder |
|---|---|---|---|---|
| Free plan when nobody opens the app for a week | keeps running | pauses; you restore it by hand | you pay either way, roughly $5–10 a month | keeps running |
| Sign-in inside an installed iPhone app | email and password work | emailed one-time code works; needs your own mail sender for real users | you build it | relies on pop-ups, which are unreliable there |
| Work to keep it running | none | none until it pauses | hosting, security patches, being on call | none |
| Lock-in | high | low (Postgres, open source) | none | medium |

Choice: Firebase. A backup has one job, which is to be there on the day a phone dies, and that day may follow weeks of nobody opening the app. A free backend that pauses in quiet weeks fails at that job while the user count is small. Lock-in is contained by keeping Firebase behind a five-method interface in one file.

A Spring Boot backend is your strongest stack, but here it would add hosting, sign-in security and upkeep with no benefit a user would see.

Revisit when you want SQL access to the data, or when usage justifies Supabase's paid plan. Check each free plan's current terms before building; they change.

### 4. No account needed, ever

Sign-in exists only for people who want automatic backup. "No account" is part of what makes the app different.

### 5. Rules, not AI, for coaching

A rule can say exactly why it fired, works offline and costs nothing. An AI summary needs a server to hold the API key and costs money per user. Revisit after Phase 7, when a server-side piece exists.

### 6. Keep the book's name out of the product

The training ideas (heavy compound lifts, sets of 4–6, add weight when you reach the top of the range) are free to use. The title *Bigger Leaner Stronger*, its text, tables and routines belong to the author and publisher, and Legion has its own app, Stacked. Describe Gymlog as evidence-based, list the book under further reading, and don't present Gymlog as the book's app. This is caution, not legal advice.

## Phases at a glance

| Phase | What you get | Needs |
|---|---|---|
| 1. Never lose data | recovery screen, snapshots, backup reminders, tests and automated checks | none |
| 2. Foundation | modules, unit tests, instant start with weak signal, tested deploys | 1 |
| 3. Coaching you can trust | correct targets, advice that explains itself, plan check, exercise editing | 2 |
| 4. Plans and progression | templates, a BLS-style progression option, easier weeks | 3 |
| 5. Workout flow and showing up | rest timer, warm-ups, calendar reminders | 2 |
| 6. Learn page and goals | the basics page, calorie and protein calculator, goal-aware weight tracking | 2 |
| 7. Automatic backup and sync | optional sign-in, several devices | 2 |
| 8. Ready for other people | first-run setup, pounds, privacy page, plan links | 4, 6 |
| Launch | permanent address, testers, channels, Play Store | 8 |

Phases 5, 6 and 7 don't depend on each other. Move Phase 7 up if automatic backup matters more to you than the coaching work.

### Not building

- A social feed, an exercise video library, or meal logging. Other apps do these well, and they pull the app away from its one job.
- AI coaching (decision 5) and a native rewrite (decision 1).

## Rules for every phase

Phase 1 copies these into `CLAUDE.md` so every later session loads them.

1. Existing data survives every change. A change to the shape of saved data needs a version bump, a migration and a test that loads old data.
2. No framework, no bundler, no runtime dependencies. Tools used only for development (tests, type checks) are fine.
3. The app works offline. Every new file the app loads goes into the service worker's cache list.
4. Phone first: design at 390 px wide, in light and dark, with touch targets of at least 44 px.
5. Plain words on screen. Every number has a label, and anything calculated can say how.
6. Never change someone's plan, settings or history unless they asked.
7. Every behaviour change comes with a test. Run the whole suite before finishing.
8. One phase per pull request. Don't start the next phase or add extras.

### Data notes

- Everything is saved under the localStorage key `gymlog.v1` as `{ v, settings, exercises, plan, sessions, body, draft }`.
- A set is `[weight, reps]`. For `barbell` exercises the weight is per side (total = 2 × weight + bar). For `time` exercises `reps` holds seconds. For `bw` exercises the weight is added load.
- Dates are local calendar days stored as `YYYY-MM-DD`. Don't use `toISOString()` for them; it shifts the day near midnight.

---

## Phase 1: Never lose data

**Why.** The log is the product. Two paths destroy it today without warning (problems 1 and 2), and the only protection against a lost phone is remembering to export.

**Build**

1. **Safe startup.** If saved data exists but can't be parsed, fails validation, or carries a version newer than the code knows, write nothing. Keep a copy of the raw text under `gymlog.rescue.<time>` and show a recovery screen with four actions: download the raw data, restore a backup file, restore a snapshot, start fresh (asks twice). For newer-version data, say so and offer a reload.
2. **Validation.** One `normalize(state)` function used by startup, restore and history import. It fills missing parts with defaults (`settings`, `exercises`, `body`, `plan`, `draft`), coerces types (dates match `YYYY-MM-DD`, numbers are finite, names are strings), drops records it can't use and reports how many. This is also the fix for problem 5. Files that aren't Gymlog data are refused with a plain message.
3. **Snapshots.** Keep copies of the full data in IndexedDB: one automatic snapshot per day on which data changed (newest 10 kept), plus one before every restore, erase and migration (newest 5 kept). Plan → Backup gains "Earlier versions" with date, session count, reason and a Restore button. Restoring takes a snapshot first. If IndexedDB is unavailable, carry on without snapshots and say so on the Backup card.
4. **Undo.** Deleting a session shows "Deleted · Undo" for 8 seconds in place of the confirm box.
5. **Backup status and reminder.** Record when the last export happened and the session count at that time, in a separate key and not inside the backup. The Backup card shows "Last backup 12 Nov · 3 sessions since". After Finish, if the last backup is 7 or more days old and sessions were added since, the "Saved" card shows a "Back up now" button, at most once a day. Exported files gain `app: "gymlog"` and `exportedAt`. Old files still import.
6. **Storage status.** Read `navigator.storage.persisted()` and show "Storage: protected" or "Storage: the browser may clear it". In a browser tab on an iPhone or iPad, show how to add the app to the Home Screen, with an Export button beside it. On Chrome, offer Install through `beforeinstallprompt`.
7. **Versioning.** A `migrate(state)` step with a table of migrations keyed by version. Older data is snapshotted, then migrated. Newer data is never touched (item 1). The version stays 1 in this phase.
8. **Tests and automated checks.** Browser tests (Playwright) for every "Done when" line, and a GitHub Actions workflow that runs them on every push and pull request.
9. **`CLAUDE.md`** holding "Rules for every phase", "Data notes" and a pointer to this file.

*iPhone note.* Safari deletes a site's stored data after seven days of Safari use without a visit to that site. Apps added to the Home Screen are exempt. The installed app appears to keep its own storage, separate from the Safari tab; confirm this on a real iPhone. If it holds, the hint must tell people to export first and import after installing.

**Done when**

- Damaged data and newer-version data are byte-for-byte unchanged after the app loads, and the recovery screen appears.
- A backup missing `settings`, `body` or `exercises` restores cleanly, and all four tabs open with no console errors.
- Restore, erase and migration each leave a snapshot that brings back the previous state exactly.
- Export, erase, import gives identical data.
- With the clock moved 8 days ahead and a new session logged, the reminder shows. After an export it is gone.
- A deleted session comes back with Undo.
- The workflow runs all of this on every push.

**Not in this phase.** Sign-in or cloud sync (Phase 7). Moving the main data out of localStorage (decision 2).

**Prompt**

```text
Implement Phase 1 (Never lose data) from docs/ROADMAP.md.

Read "Rules for every phase", "Data notes" and the Phase 1 section first. They are the spec. If the file is missing, stop and tell me.

Start by writing browser tests for problems 1 and 2 in the roadmap's table and watch them fail against the current code. Then build.

Don't start other phases or add extras. If the spec is unclear or you disagree with part of it, ask me before deciding.

When every "Done when" line passes, show me phone-width screenshots in light and dark of each screen you changed. Then open a pull request that lists what you did under each "Done when" line and anything you left out.
```

---

## Phase 2: Foundation

**Why.** Every later phase changes progression or coaching logic. Today that logic can't be tested without a browser, because it reads shared state and the clock directly (problem 13).

**Build**

1. **Modules, behaviour unchanged.**
   - `src/core/`: pure functions with no page access, no storage and no clock (today's date is passed in). Dates, strength maths, progression (`targetFor`), analysis (`hardSets`, `weekCounts`, `trend`, `stalled`, `insights`), validation and migration.
   - `src/store.js`: load, save, snapshots, backup.
   - `src/ui/`: one module per screen plus shared pieces. The only code that touches the page.
2. **Unit tests** on Node's built-in test runner for everything in `src/core/`, written as tables of cases for `targetFor`.
3. **Types without a build step.** JSDoc type definitions for the saved data (`State`, `Session`, `Entry`, `PlanItem`, `Exercise`), `// @ts-check`, and `tsc --noEmit` in the workflow.
4. **Service worker.** Serve the app from a saved copy first and fetch updates in the background. All files of one version are saved together so versions never mix. Show "Update ready · Reload" when a new version has finished downloading. The version changes by itself whenever a shipped file changes, with no manual step to forget. A test fails if a module the app imports is missing from the cache list.
5. **Deploy from the workflow.** Publish to GitHub Pages only after tests pass on `main`.
6. **Formatting.** Run Prettier once, in its own commit, so later diffs stay readable.

*Why the service worker changes.* Today every file is fetched from the network first and falls back to the saved copy after 2.5 seconds. With weak gym signal that is several seconds before the app opens, and with many module files it could load a mix of old and new ones.

**Done when**

- The Phase 1 browser tests pass without edits.
- Unit tests cover every function listed under `src/core/`.
- After one online load, the app opens with the network switched off.
- Type check, unit tests and browser tests all run in the workflow, and deploy runs only when they pass.

**You do by hand.** In the repository's Settings → Pages, set Source to "GitHub Actions".

**Not in this phase.** Frameworks, compiling TypeScript, bundlers, any change a user would notice other than faster start and the update notice.

**Prompt**

```text
Implement Phase 2 (Foundation) from docs/ROADMAP.md.

Read CLAUDE.md and the Phase 2 section first. They are the spec.

This phase must not change behaviour. Run the existing browser tests before you touch anything, move code in small steps, and re-run them after each step. If a test needs editing to pass, stop and tell me why.

Don't start other phases or add extras. Ask me before deciding anything the spec doesn't cover.

When every "Done when" line passes, open a pull request that lists what you did under each line, the module layout you chose, and anything you left out.
```

---

## Phase 3: Coaching you can trust

**Why.** The app's advice is its edge over a paper logbook, and some of it is wrong or unclear today (problems 6–11).

**Build**

1. **Progression fixes in `targetFor`.**
   - When the last session used one weight but fewer sets than today's plan asks for, treat it as straight sets: progress the sets that were done and start the extra sets at the bottom of the range. "Ramped" means only that the weight changed between sets.
   - Timed holds get the note "Hold 5 seconds longer" and move in steps of 5 seconds. Bodyweight exercises get "One more rep".
2. **Volume measured against the plan.** Planned weekly sets for a muscle = its sets across the rotation × (sessions-per-week setting ÷ workouts in the rotation). Flag a muscle when its four-week average is under 80% of planned, as "Chest: 6 of 9 planned sets a week". Remove the fixed "Aim for 10" sentence.
3. **Half credit for helper muscles.** An exercise may list other muscles it trains, and those count as half a set. Defaults: bench and other presses → triceps; rows and pull-ups → biceps; squat, split squat and leg press → hamstrings & glutes; deadlift → back. Stored as an optional `also` list on the exercise.
4. **Plan check on the Plan screen.** Weekly sets per muscle at the chosen sessions per week, direct and with half credit, marking muscles under 10. It updates as the plan is edited.
5. **"Do this next", rewritten.**
   - One cause, not its symptoms. If attendance is the issue (6 or more days since the last session, or under 3 sessions a week over four weeks), don't also list low volume.
   - Each item has a title with the numbers, one sentence saying what to do, and a "Why?" line saying how it was calculated.
   - The first item gets a button where an action exists (start today's workout, log weight).
   - The first item also appears on Today, under the heading.
6. **Labels.** The bold number in each Strength row is labelled "est. 1-rep max". The hard-sets card shows done and planned.
7. **Editing.** Rename an exercise, with history, plan, key lifts and the workout in progress following. Change an exercise's muscle, type, weight step and helper muscles. Rename a workout. Move exercises up and down. Choose which lifts appear under Strength.

*Example "Why?" line.* "A hard set is any set within 10% of your heaviest weight that day, so warm-ups don't count. This is your average over the last four weeks."

**Done when**

- Unit tests cover each `targetFor` case above, the planned-volume sum, and which advice is shown when attendance is low.
- With the default plan, leg curl on Lower body 1 shows "Same weight, one more rep".
- Renaming an exercise keeps every past session under the new name.
- No fixed "10 sets" claim remains anywhere a plan can't meet it.

**Prompt**

```text
Implement Phase 3 (Coaching you can trust) from docs/ROADMAP.md.

Read CLAUDE.md and the Phase 3 section first. They are the spec.

For each of problems 6, 7 and 8 in the roadmap's table, write a failing unit test before the fix.

All new on-screen wording must be plain enough for someone who has never read a training book. Show me the full text of every "Do this next" item and its "Why?" line before you finish, so I can edit the wording.

Don't start other phases or add extras. Ask me before deciding anything the spec doesn't cover.

When every "Done when" line passes, show me phone-width screenshots in light and dark of Today, Progress and Plan, then open a pull request that lists what you did under each line and anything you left out.
```

---

## Phase 4: Plans and progression

**Why.** The default plan loads its main lifts lighter than the approach it is meant to follow, and nobody but its author can start from a sensible plan. Appendix B has the review.

**Build**

1. **Progression setting, "Add weight when".**
   - "Every set reaches the top of the range." The default, and today's behaviour.
   - "The first set reaches the top." After you tick a first set at the top of the range, the app offers the next weight step for the remaining sets, and the next session starts at the new weight at the bottom of the range. If the first set at a new weight falls below the bottom of the range, go back to the previous weight next time and require the top of the range on two sets before stepping up again.
2. **Templates.** "Start from a template" on the Plan screen, with a preview and the plan check from Phase 3. Two templates, both in Appendix B: Upper/Lower (4 workouts) and Full body (3 workouts). Applying one replaces the plan after a snapshot and a confirm. History is untouched, and nobody's existing plan changes on update.
3. **Easier week.** After 8 weeks in a row with 3 or more sessions, "Do this next" suggests one. A switch on Today turns the current workout into 2 sets per exercise at the same weight and half the top reps. Sessions logged this way are marked, and targets, trends and stall checks ignore them.
4. **New default exercise.** Romanian deadlift (hamstrings & glutes; helper muscle: back).

**Done when**

- Unit tests cover both progression settings, including the missed-reps case.
- Applying a template takes a snapshot first and leaves every session in place.
- An easier-week session doesn't change the next normal target.

**Prompt**

```text
Implement Phase 4 (Plans and progression) from docs/ROADMAP.md.

Read CLAUDE.md, the Phase 4 section and Appendix B first. They are the spec. Use the two templates in Appendix B exactly as written; if you think a set count or rep range is wrong, tell me instead of changing it.

Don't start other phases or add extras. Ask me before deciding anything the spec doesn't cover.

When every "Done when" line passes, show me phone-width screenshots in light and dark of the template picker and the progression setting, then open a pull request that lists what you did under each line and anything you left out.
```

---

## Phase 5: Workout flow and showing up

**Why.** Rest length changes how many reps the next set gets, and the app doesn't time it. The best plan also does nothing in a week with no sessions, and today the app only reports missed sessions afterwards.

**Build**

1. **Rest timer.** Starts when a set is ticked. Default by rep range: 3:00 when the top of the range is 6 or less, 2:30 up to 10, 2:00 up to 12, 1:30 above. "+30 s" and "Skip" buttons. It counts from timestamps, so it is still right after the screen sleeps. Sound and vibration at zero where the browser allows, with a mute setting.
2. **Screen stays on during a workout,** where the browser supports it, with a setting. A web app can't reliably alert through a locked screen, so keeping the screen on is what makes the timer useful.
3. **Warm-up line** for the first exercise of each workout, worked out from today's weight: 50% × 10, then 70% × 4. Shown, not logged.
4. **Progress line** on Today: sets done out of planned, and minutes since the first tick. A second line shows sessions this week against the target.
5. **In-app sheets and toasts** replace `alert`, `confirm` and `prompt`. Prefer undo to "are you sure".
6. **Tick button** shows a faint ✓ before it is pressed, so it reads as a button.
7. **Training days in your calendar.** Pick days and a time. The app produces a calendar file (`.ics`) with a weekly repeating event and an alert for each day. The phone's calendar does the reminding and no server is involved.

**Done when**

- The timer shows the right remaining time after the page has been hidden for 60 seconds (tested with a controlled clock).
- No native `alert`, `confirm` or `prompt` calls remain.
- The calendar file opens as repeating events in Google Calendar and Apple Calendar.

**Prompt**

```text
Implement Phase 5 (Workout flow and showing up) from docs/ROADMAP.md.

Read CLAUDE.md and the Phase 5 section first. They are the spec.

The timer and the progress line must never cover the set you are entering on a 390 px wide screen. Check with the on-screen keyboard open.

Don't start other phases or add extras. Ask me before deciding anything the spec doesn't cover.

When every "Done when" line passes, show me phone-width screenshots in light and dark of Today with the timer running, then open a pull request that lists what you did under each line and anything you left out.
```

---

## Phase 6: Learn page and goals

**Why.** Getting lean is decided by eating, and the app tracks only a protein tick. The basics also fit on one page, and a page is something people share and search for; a tracker isn't.

**Build**

1. **`learn.html`.** An ordinary page holding the copy in Appendix A, so it can be linked, shared and found by search. A fifth tab, Learn, loads that page's content and shows it in place, saved for offline use. One copy of the text serves both.
2. **Layout.** "The short version" is always open. Other sections are closed and open with one tap. No images.
3. **"Your numbers" calculator,** using the rules in Appendix A. It gives calories, protein, fat and carbs for the chosen goal. "Use this protein target" saves it to settings.
4. **Goal setting:** lose fat, maintain, or gain muscle. Body entries can be daily. With at least four weigh-ins in each of the last two weeks, the Body card shows the weekly average, its change as a percentage of body weight, and one line of advice against the goal's pace: lose 0.5–1% a week, hold within 0.25% a week, or gain 0.5–1% a month. With fewer entries it behaves as it does today.
5. **Waist against height,** shown when height is known: "Your waist is 0.52 of your height. Under 0.5 is the health target."
6. **Footer disclaimer** from Appendix A.

**Done when**

- Learn opens with the network switched off.
- The calculator is unit-tested against cases worked out by hand, including the under-18 case and the calorie floor.
- `learn.html` reads correctly when opened directly in a browser.

**Prompt**

```text
Implement Phase 6 (Learn page and goals) from docs/ROADMAP.md.

Read CLAUDE.md, the Phase 6 section and Appendix A first. They are the spec.

Use the Learn copy in Appendix A word for word. Don't add health claims of your own. If you think a number in it is wrong or out of date, tell me with a source instead of changing it.

Don't start other phases or add extras. Ask me before deciding anything the spec doesn't cover.

When every "Done when" line passes, show me phone-width screenshots in light and dark of the Learn tab, the calculator and the Body card, then open a pull request that lists what you did under each line and anything you left out.
```

---

## Phase 7: Automatic backup and sync

**Why.** Manual backups depend on memory. The only complete protection against a lost or broken phone is a copy that leaves the phone by itself.

**You do first, in the Firebase console**

1. Create a project.
2. Turn on Email/Password and Google sign-in.
3. Create a Firestore database in production mode.
4. Add the app's web address under authorised domains. Settle the permanent address first (see Launch).
5. Copy the web configuration and give it to the session. It identifies the project and is not a secret; the security rules do the protecting.

**Build**

1. **Data shape, version 2.** Every session and body entry gets `updatedAt`. Deletions leave a marker so they reach other devices. Migration from version 1, with a snapshot.
2. **A `SyncBackend` interface** with `signIn`, `signOut`, `push(changes)`, `pull(since)` and `deleteAccount`. Firebase is one implementation in one file, loaded only when sync is turned on.
3. **Layout in the database.** `users/{uid}/sessions/{id}`, `users/{uid}/body/{date}`, and `users/{uid}/profile/plan` for plan, exercises and settings. One document per session keeps each far below Firestore's 1 MiB document limit.
4. **Security rules.** A signed-in person can read and write only their own documents. The rules file lives in the repository.
5. **Sync.** Local data stays the source for the screen. Changes are pushed when online. Remote changes are pulled and merged record by record, newest wins. The first sign-in on a device that already has data merges by id and never replaces, after taking a snapshot.
6. **Sign-in that completes inside an installed iPhone app,** where pop-ups and links that open Safari don't carry the session back. Email and password are always available. Google sign-in is offered where pop-ups work.
7. **Backup card.** "Synced 2 min ago", "Offline, will sync later", or the error in plain words. Also "Delete my account and cloud data".
8. **Privacy page** updated to say what is stored on the server.

**Done when**

- Two browser profiles signed in to one account end up with the same data after edits on both, including a delete and an edit made offline.
- The rules refuse a read of another person's data (emulator test, or a written manual check if the emulator is impractical).
- Signed out and offline, the app behaves exactly as before.

**Prompt**

```text
Implement Phase 7 (Automatic backup and sync) from docs/ROADMAP.md.

Read CLAUDE.md, the Phase 7 section and decision 3 first. They are the spec. Here is my Firebase web configuration: <paste it here>

Before writing code, show me the merge rules as a short table: what happens for each combination of local and remote state, including deletes and a first sign-in with data on both sides. Wait for my reply.

Sync must never lose a record. When two versions conflict and you can't tell which is newer, keep both and tell me how you surface that.

Don't start other phases or add extras.

When every "Done when" line passes, open a pull request that lists what you did under each line, the steps I need to run to publish the security rules, and anything you left out.
```

---

## Phase 8: Ready for other people

**Why.** The app assumes its author (problem 14). A stranger meets kilograms, per-side barbell weights and a 130 g protein target with no explanation.

**Build**

1. **First run.** Three questions: units (kg or lb), sessions a week (3 gives Full body, 4 gives Upper/Lower), and how barbell weight is entered (total on the bar, or per side). Then Today. Also "Look around with sample data", clearly marked, cleared with one tap.
2. **Units.** A setting chosen at first run that sets labels, default weight steps (2.5 kg or 5 lb) and the default bar (20 kg or 45 lb). Numbers are stored as entered, with no automatic conversion.
3. **Barbell entry.** "Total on the bar" for new users; "per side" stays for existing data. Stored per side either way and converted on screen.
4. **Personal wording and defaults removed:** "history.json", "converted old logs", "Four days", "this phone", the 130 g protein default.
5. **Pages.** Privacy (what is stored where, in plain words), About, a licence (MIT), and a `README.md` with screenshots and how to run, test and deploy.
6. **Content-Security-Policy** that allows scripts only from the app's own address.
7. **Sharing details.** Title, description and preview image for links. The manifest gains `id`, `description` and `screenshots`.
8. **Share a plan by link.** The plan is packed into the link itself. Opening it shows a preview and "Use this plan". It passes through `normalize`.
9. **Anonymous usage counts** with an off switch: app opened, workout finished, app installed. No workout data and nothing that identifies a person. Stated on the Privacy page.
10. **Feedback link.**
11. **Accessibility pass.** Labels, contrast, focus order, and text enlarged to 200%.

*On item 9.* This is the one place the app talks to a server without sync turned on. Include it, because you can't improve what you can't see, but say so plainly and let people switch it off. If "nothing leaves your phone" matters more to you than knowing whether anyone uses the app, drop this item and rely on feedback.

**Done when**

- A fresh install in pounds with total-weight entry shows no kilograms and no per-side wording anywhere.
- Existing data opens exactly as before.
- A plan link made on one browser profile opens as a preview on another and imports cleanly.
- A malformed plan link is refused with a plain message.

**Prompt**

```text
Implement Phase 8 (Ready for other people) from docs/ROADMAP.md.

Read CLAUDE.md and the Phase 8 section first. They are the spec.

Before building, list every piece of on-screen text that assumes one particular person, unit or gym, and show me the replacement wording. Wait for my reply.

For item 9, propose two analytics services that use no cookies and collect no personal data, with their current free-plan terms, and let me choose.

Don't start other phases or add extras.

When every "Done when" line passes, show me phone-width screenshots in light and dark of first run, then open a pull request that lists what you did under each line and anything you left out.
```

---

## Launch

Not a coding phase. Do it after Phase 8.

**What to say the app is.** "Open it and it tells you what to lift today. No account, no subscription, works offline." It is for people who lift three or four times a week and don't want training to become a second job.

Don't present it as a general workout tracker. Strong and Hevy own that, and readers of the book already have Legion's Stacked. A new tracker spreads only if people can say what is different in one sentence.

**Steps, in order**

1. **Pick the permanent address before inviting anyone.** Saved data is tied to the exact web address. If the app later moves from `github.io/gymlog` to its own domain, everyone's data stays behind at the old one. A domain of its own (about $12 a year) also keeps Gymlog's data apart from any other site under your `github.io` address, and the Play Store route needs a file at the domain's root.
2. **Check the name.** "Gymlog" is a generic term, so look in the app stores and search results for apps already using it. A distinct name is easier to find and to list in a store.
3. **Five people, watched.** Ask five people who lift to use it for two weeks. Sit with each for one session and say nothing. Fix whatever makes them hesitate.
4. **Write in public.** LinkedIn posts drawn from the build, each ending with the link:
   - "I built a workout app with no backend, no framework and no account. Here is why."
   - "The bug that could have erased two years of training logs, and three rules I now follow for data kept on the device."
   - "When you don't need a server."
   - "Everything a busy engineer needs to know about fitness, on one page."
5. **Open the source.** A README with screenshots and the sample-data link. List it on AlternativeTo and on relevant "awesome" lists.
6. **Launch posts.** Show HN, r/SideProject, r/PWA, r/opensource. Most fitness subreddits ban self-promotion, so answer questions there and keep the link in your profile.
7. **Let search find the Learn page and the calculator.** They answer questions people type every day.
8. **Google Play, once about 50 people use it weekly.** Wrap the web app as a Trusted Web Activity for a one-time $25. Personal developer accounts created after 13 Nov 2023 must first run a closed test with 12 testers for 14 days. It needs the privacy page and, if sign-in exists, account deletion.
9. **Apple's App Store: not yet.** It needs a native wrapper and $99 a year, and review may reject a thin wrapper. iPhone users can install from Safari today.

**What to measure.** People who finish at least one workout a week, and how many of a month's new users are still logging four weeks later. Before any big push, aim for ten people you don't know who are still logging after four weeks.

**What to expect.** Features don't bring users; telling people does. The first hundred usually arrive one conversation at a time.

---

## Appendix A: Learn page copy

For review before Phase 6 ships it. Simple words on purpose.

### The basics

What matters most for a stronger, leaner, healthier body. Everything else is detail.

#### The short version

1. Lift weights 3–4 times a week. Each time, try to beat last time by one rep or a little weight.
2. Eat protein at every meal. Aim for 1.6–2.2 g per kg of body weight a day (0.7–1 g per lb).
3. Calories decide your weight. Eat a bit less than you burn to lose fat, a bit more to build muscle.
4. Walk every day. 7,000–10,000 steps is a good target.
5. Sleep 7–9 hours.
6. Keep going. A decent plan followed for a year beats a perfect plan followed for a month.

#### Build muscle

- Muscles grow when you ask them to do slightly more than before. Add a rep, then add weight. This is called progressive overload.
- Build your week around big lifts that work many muscles at once: squat, deadlift, bench press, overhead press, rows and pull-ups. Add a few smaller lifts for shoulders, arms, hamstrings and calves.
- Make your sets hard. Stop when you could do only one to three more good reps.
- About 10 hard sets per muscle per week is a solid target. Up to 20 can help if you recover well. Warm-up sets don't count.
- Heavy sets of 4–8 reps build the most strength. Anything from about 5 to 30 reps builds muscle if the set is hard.
- Rest 2–3 minutes between hard sets of big lifts and 1–2 minutes for small ones. Short rests cost you reps.
- Train each muscle about twice a week.
- Use a full range of motion and control the weight on the way down. If your form breaks, the set is over.
- Keep the same exercises for months. You can't beat your numbers if the exercises keep changing.

#### Lose fat

- You lose fat when you eat fewer calories than you burn. No food, meal time or workout gets around this.
- Aim to lose 0.5–1% of your body weight a week. For most people that means eating 20–25% less than they burn.
- Keep protein high and keep lifting heavy. That tells your body to keep muscle and burn fat.
- You can't choose where fat comes off. Ab exercises build abs; they don't burn belly fat. Stubborn areas go last.
- Weigh yourself each morning and compare weekly averages. Day-to-day jumps are water and food, not fat.
- Measure your waist once a week. A shrinking waist with steady lifts means it is working.
- If the weekly average hasn't moved for two weeks, eat 100–200 calories less a day or walk more.

#### Eat well

- Calories decide your weight. Protein decides how much of it is muscle. Food quality decides your health and how full you feel.
- Good protein: meat, fish, eggs, yoghurt, cottage cheese, milk, lentils, beans, tofu, protein powder.
- Eat mostly whole foods: vegetables, fruit, potatoes, rice, oats, beans, nuts. A rough guide is 80% whole foods and 20% whatever you enjoy.
- Carbs don't make you fat, and they fuel training. You need fat too: keep it at 20% of your calories or more.
- Eat fruit or vegetables with most meals. Aim for 400 g a day (five portions) and at least 25 g of fibre.
- Watch liquid calories. Sugary drinks, juice and alcohol add up fast and don't fill you.
- When and how often you eat matters little. The day's totals matter most.

#### Lose fat or build muscle first?

- If you carry a lot of fat (roughly above 15% body fat for men, 25% for women), lose fat first. If you can't see any outline of your abs, treat that as "lose fat first".
- If you are already lean (around 10% for men, 20% for women) and want more size, eat about 10% more than you burn and gain slowly: 0.5–1% of your body weight a month.
- In between, pick the one you want more.
- New to lifting, or back after a long break? You can lose fat and gain muscle at the same time. Eat slightly less than you burn and keep protein high.
- A simple health check for anyone: keep your waist under half your height.

#### Cardio and daily movement

- For health, get at least 150 minutes a week of moderate activity such as brisk walking or cycling, or 75 minutes of hard activity.
- Walking is the easiest fat-loss tool. It takes little effort and doesn't wear you out for lifting.
- One to three cardio sessions a week is plenty alongside lifting. Don't let cardio replace lifting.

#### Sleep and recovery

- Sleep 7–9 hours. Short sleep makes you hungrier and weaker, and when you diet you lose more muscle.
- You grow between sessions, not during them. Three to five sessions a week is enough.
- After 8–10 hard weeks, take an easier week.
- Sharp pain or joint pain is not "good pain". Stop and swap the exercise.

#### Supplements

- None are required. Training, food and sleep do nearly all the work.
- Worth considering: creatine monohydrate, 3–5 g every day. Protein powder, if you can't get enough protein from food. Caffeine before training, if you like it. Vitamin D, if you get little sun.
- Skip fat burners, BCAAs, testosterone boosters and detoxes.

#### Myths

- "Lifting makes women bulky." Muscle comes slowly and takes years of trying.
- "Toning." Looking toned means more muscle and less fat. No special workout does it.
- "Sweat means fat loss." It is water.
- "Eating late makes you fat." Only the day's total counts.
- "Muscle turns into fat." They are different tissues. Neither becomes the other.
- "You have to be sore." Soreness says the workout was new, not that it worked. Your log shows whether it worked.
- "Confuse your muscles." Keep the same lifts and beat your numbers.

#### What to expect

- First month: stronger every week, little change in the mirror.
- Three months: clothes fit differently.
- A year at three sessions a week: a visibly different body.
- A man new to lifting can gain roughly 0.5–1 kg of muscle a month in the first year, and women about half that. It slows every year after.
- You will miss sessions. Never miss twice.

#### Footer

General information for healthy adults, not medical advice. Talk to a doctor first if you have a health condition, are pregnant, or are under 18.

Further reading: *Bigger Leaner Stronger* and *Thinner Leaner Stronger* by Michael Matthews; the World Health Organization's guidelines on physical activity.

### "Your numbers" calculator rules

- **Inputs:** sex, age, height, weight (filled in from the latest body entry), sessions a week (from settings), daily life (mostly sitting, on your feet, physical work), goal.
- **Calories burned at rest** (Mifflin-St Jeor): men 10 × kg + 6.25 × cm − 5 × age + 5; women the same with − 161 in place of + 5.
- **Activity multiplier** by sessions a week: none 1.2; 1–3 → 1.375; 4–5 → 1.55; 6–7 → 1.725. Add 0.1 for "on your feet" and 0.2 for "physical work", up to 1.9.
- **Goal:** lose fat −20%; maintain 0; gain muscle +10%.
- **Protein:** 2.2 g per kg when losing fat, 1.8 g per kg otherwise. If BMI is over 30, use the weight that would give BMI 25.
- **Fat:** 25% of calories. **Carbs:** the rest.
- **Rounding:** calories to the nearest 50, grams to the nearest 5.
- **Floor:** never show a target under 1,500 calories for men or 1,200 for women. Show the floor and say a slower loss is safer.
- **Under 18:** show no numbers; suggest talking to a doctor or coach.
- **Line under the result:** "An estimate. Follow it for two weeks, then let your weekly average decide. Change by 100–200 calories if you are off pace."

### Where the numbers come from

Citations are from memory unless linked in Appendix C. Check them before the page is published.

| Claim | Source |
|---|---|
| Protein 1.6–2.2 g per kg | Morton et al., 2018, British Journal of Sports Medicine |
| 10 or more sets per muscle per week | Schoenfeld, Ogborn & Krieger, 2017, Journal of Sports Sciences |
| 5–30 reps build muscle; heavy builds more strength | Schoenfeld et al., 2021, Sports |
| Stop 1–3 reps short of failure | Refalo et al., 2023, Sports Medicine |
| Rest 2–3 minutes | Schoenfeld et al., 2016, Journal of Strength and Conditioning Research |
| Each muscle about twice a week | Schoenfeld, Ogborn & Krieger, 2016, Sports Medicine |
| Lose 0.5–1% a week | Helms, Aragon & Fitschen, 2014, Journal of the International Society of Sports Nutrition |
| No spot reduction | Vispute et al., 2011, Journal of Strength and Conditioning Research |
| Short sleep costs muscle when dieting | Nedeltcheva et al., 2010, Annals of Internal Medicine |
| 150 minutes of activity; 400 g fruit and vegetables; 25 g fibre | World Health Organization guidelines (2020 activity; 2023 carbohydrate intake) |
| 7,000–10,000 steps | Paluch et al., 2022, and Ding et al., 2025, Lancet Public Health |
| Waist under half your height | NICE obesity guidance, 2022 |
| Creatine 3–5 g a day | Kreider et al., 2017, ISSN position stand |
| Cut above 15% / 25% body fat, gain at 10% / 20%; deficit 20–25% | Legion, "cut or bulk" (Appendix C) |
| Muscle gain per month | McDonald and Aragon models; rules of thumb, not trials |

---

## Appendix B: Plan review and templates

The goal this is judged against: lean, strong and muscular, with well-defined legs and a balanced physique, on three or four sessions a week, following the *Bigger Leaner Stronger* (BLS) approach.

### What BLS prescribes

I could not open Legion's site from this session. These points come from search summaries of Legion's pages and published summaries of the book. Check them against your copy before Phase 4 ships.

- Heavy compound lifts come first.
- Sets of 4–6 reps at about 80–85% of a one-rep max.
- 9–15 hard sets per workout (older editions say 9–12), with 2–4 minutes of rest.
- When one set reaches 6 reps, add 10 lb (about 5 kg) for the next set. If you then get only 2–3 reps, take 5 lb off.
- Three-, four- and five-day versions. The four-day version is push, pull, upper body, legs.
- It is written for men who are new to lifting. Matthews points people who have gained their first 25 lb or so of muscle to *Beyond Bigger Leaner Stronger*.

### How the default plan compares

| | BLS four-day | App default |
|---|---|---|
| Split | push, pull, upper body, legs: one leg day in four | upper, lower, upper, lower: two leg days in four |
| Reps on the main lifts | 4–6 | 6–10 (deadlift 5–8) |
| When weight goes up | one set reaches the top of the range | every set reaches the top |
| Hard sets per workout | 9–15 | 13–17 |
| Rest | 2–4 minutes | not timed |

### Verdict

Keep the upper/lower rotation. It gives legs half the sessions, which suits a goal of well-defined legs and a balanced physique better than one leg day in four, and it loses nothing when a week has three sessions. Matthews also publishes an upper/lower split, so this stays within his approach.

Change three things:

1. **Load the first lift of each day in the 4–6 range.** Bench press, squat and deadlift move to 3 × 4–6; seated dumbbell press to 3 × 6–8, since heavy dumbbells are awkward to get into place. This matches BLS and serves the "strong" part of the goal. The app will raise the weight a step each session until the reps fall into the range, or enter a heavier weight yourself.
2. **Add Romanian deadlift, 3 × 6–8, to Lower body 1.** Hamstrings & glutes go from 8 to 11 sets a week, level with quads.
3. **Add lateral raise, 2 × 10–15, to Upper body 2.** Shoulders go from 8 to 10 sets a week, with the extra going to the side of the shoulder, which does most for width.

One departure from the book: isolation lifts stay at 8–15 reps. Sets of 4–6 on lateral raises or curls are hard on joints, and higher reps build the same muscle when the set is hard.

Don't add more volume until you have logged 12 weeks at an average of 3.5 sessions or more. If a muscle still lags then, give it 2–3 more sets a week.

BLS is aimed at beginners. For this goal and schedule its level of volume and complexity is still the right one. Move to a periodised programme only if progress stalls after a long consistent stretch with good sleep and protein.

### Template 1: Upper/Lower, four workouts

| Workout | Exercise | Sets × reps | Change |
|---|---|---|---|
| Upper body 1 | Barbell bench press | 3 × 4–6 | was 6–10 |
| | Seated machine row | 3 × 8–12 | |
| | Incline DB press | 3 × 8–12 | |
| | Lateral raise | 3 × 10–15 | |
| | Barbell curl | 3 × 8–12 | |
| | Hanging knee raise | 2 × 8–15 | |
| Lower body 1 | Back squat | 3 × 4–6 | was 6–10 |
| | Romanian deadlift | 3 × 6–8 | new |
| | Bulgarian split squat | 2 × 8–12 | |
| | Leg curl | 3 × 8–12 | |
| | Standing calf raise | 3 × 10–15 | |
| | Plank | 2 × 45–90 s | |
| Upper body 2 | Seated DB press | 3 × 6–8 | was 6–10 |
| | Pull-ups | 3 × 5–10 | |
| | DB bench press | 3 × 8–12 | |
| | One-arm DB row | 3 × 8–12 | |
| | Lateral raise | 2 × 10–15 | new |
| | Triceps pushdown | 3 × 10–15 | |
| | Face pulls | 2 × 12–15 | |
| Lower body 2 | Deadlift | 3 × 4–6 | was 5–8 |
| | Leg press | 3 × 8–12 | |
| | Leg extension | 3 × 10–15 | |
| | Leg curl | 2 × 8–12 | was 10–15, to match Lower body 1 |
| | Seated calf raise | 3 × 10–15 | |
| | Crunches | 2 × 12–20 | |

Sets per workout: 17, 16, 19, 16. If the lower back complains about two hinge days a week, swap Romanian deadlift for a back extension.

### Template 2: Full body, three workouts

| Workout | Exercise | Sets × reps |
|---|---|---|
| Full body A | Back squat | 3 × 4–6 |
| | Barbell bench press | 3 × 4–6 |
| | Seated machine row | 3 × 8–12 |
| | Romanian deadlift | 3 × 6–8 |
| | Lateral raise | 3 × 10–15 |
| | Triceps pushdown | 2 × 10–15 |
| Full body B | Deadlift | 3 × 4–6 |
| | Seated DB press | 3 × 6–8 |
| | Pull-ups | 3 × 5–10 |
| | Leg press | 3 × 8–12 |
| | DB bench press | 3 × 8–12 |
| | Barbell curl | 2 × 8–12 |
| Full body C | Bulgarian split squat | 3 × 8–12 |
| | Incline DB press | 3 × 8–12 |
| | One-arm DB row | 3 × 8–12 |
| | Leg curl | 3 × 8–12 |
| | Face pulls | 2 × 12–15 |
| | Standing calf raise | 3 × 10–15 |
| | Hanging knee raise | 2 × 8–15 |

Sets per workout: 17, 17, 19.

### Weekly sets per muscle

Direct sets only, rounded.

| Muscle | Default now, 4 a week | Upper/Lower, 4 a week | Upper/Lower, 3 a week | Full body, 3 a week |
|---|---|---|---|---|
| Chest | 9 | 9 | 7 | 9 |
| Back | 9 | 9 | 7 | 9 |
| Shoulders | 8 | 10 | 8 | 8 |
| Quads | 11 | 11 | 8 | 9 |
| Hamstrings & glutes | 8 | 11 | 8 | 9 |
| Biceps | 3 | 3 | 2 | 2 |
| Triceps | 3 | 3 | 2 | 2 |
| Calves | 6 | 6 | 5 | 3 |
| Abs | 6 | 6 | 5 | 2 |

Biceps and triceps look low because pulling and pressing aren't counted here. With half credit (Phase 3), Upper/Lower at four a week gives biceps about 8 and triceps about 9.

### Which template

- Averaging 3.5 sessions a week or more: Upper/Lower.
- Averaging closer to 3: Full body. For the same gym time it gives chest and back about a third more weekly work, and legs slightly more. The cost is less direct work for arms, calves and abs, and a heavy leg lift in every session.

The Progress screen's four-week average answers this. Set "Sessions / week" to what you do, not what you intend.

---

## Appendix C: Sources and what was not verified

**Checked by search on 16–17 Nov 2026**

- BLS programme overview, three-, four- and five-day versions, audience: [Legion, Bigger Leaner Stronger workout plan](https://legionathletics.com/bigger-leaner-stronger-workout-plan)
- Rep range, hard sets per workout, rest: [Shortform, The Bigger Leaner Stronger workout](https://www.shortform.com/blog/?p=109999)
- Progression rule: [Legion, double progression](https://legionathletics.com/double-progression) and [Shortform, double progression](https://www.shortform.com/blog/double-progression-method/)
- Upper/lower split from the same author: [Legion podcast, episode 1095](https://legionathletics.com/muscle-for-life-episode-1095)
- Who the follow-up book is for: [Legion, Beyond Bigger Leaner Stronger](https://legionathletics.com/beyond-bigger-leaner-stronger/)
- Legion's own app: [Legion, Stacked](https://legionathletics.com/stacked-workout-app)
- Body-fat thresholds, deficit, protein when losing fat: [Legion, cut or bulk](https://legionathletics.com/cut-or-bulk)
- Safari's seven-day rule and the Home Screen exemption: [WebKit bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350) and [The Register](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/)
- Supabase pausing free projects: [Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing.md)
- Google Play's 12-tester rule: [Google Play Console help](https://support.google.com/googleplay/android-developer/answer/14151465)

**Not verified**

- Legion's pages could not be opened from this session, so the BLS details rest on search summaries. The 10% surplus for gaining muscle was not confirmed as Matthews' figure; it is used here as general guidance.
- Firebase's free-plan limits were confirmed only by third-party pages.
- Whether an installed iPhone app keeps storage separate from the Safari tab was not tested.
- Journal citations in Appendix A are from memory.
- Nothing was tested on a real phone.
