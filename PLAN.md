# DailyAscend Build Plan

Step-by-step plan for building DailyAscend, based on the _DailyAscend Product Spec_ and the _DailyAscend Build and Stack Plan_ (both dated 10 Nov 2026).

**One-line summary:** an Expo (React Native + TypeScript) app that works offline first, backed by Supabase and RevenueCat. It launches on Android first, then iOS, then gets blocking and AI Divide, then a web dashboard.

---

## 1. What we are building

One person picks one big task (the **mountain**) and climbs it through daily focus sessions. The app measures whether their focus is _really_ improving and shows this in a 30-day compounding report.

| Operation | In the app                                                                | Introduced                         |
| --------- | ------------------------------------------------------------------------- | ---------------------------------- |
| Add       | Activities that help the user enter flow → become the pre-climb checklist | Day 1                              |
| Subtract  | Things that break flow → become the block list (self-reported in the MVP) | Day 2                              |
| Divide    | The mountain split into chunks with time estimates, grouped into camps    | Day 3 (one default chunk on day 0) |
| Multiply  | Timed climb sessions plus a summit check-in                               | Day 0                              |

**North-star test for v1:** the user finishes a first climb within 2 minutes of install, and is still climbing on day 30.

---

## 2. Decisions made in this plan

These settle the open questions in the spec. Change them here if you disagree.

| Question                                 | Decision                                                                                                                                                                                                   | Why                                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which platform first?                    | Android first, built with cross-platform Expo; iOS from the same code soon after                                                                                                                           | Matches the stack plan                                                                                                                                                                            |
| When does the 30-day window start?       | At the **first completed climb**, not at install                                                                                                                                                           | Install-to-first-climb gaps would add empty days to week 1 and distort `g`                                                                                                                        |
| Day numbering                            | Day 1 = date of first climb (in the user's local timezone). Week 1 = days 1–7, week 4 = days 22–28, report unlocks on day 30                                                                               | The exponent 1/21 is the gap between the middles of week 1 and week 4 (day 4 to day 25)                                                                                                           |
| Weekly average altitude                  | Mean over **all 7 calendar days**, counting missed days as 0                                                                                                                                               | Showing up consistently is part of the routine; the 4-climbing-day minimum already guards against too little data                                                                                 |
| Skipped check-in                         | The session still counts for flow minutes, uses neutral **D = 1.0**, and is left out of depth averages                                                                                                     | The spec says to leave skipped sessions out of depth averages                                                                                                                                     |
| No Add/Subtract items yet (days 0–2)     | Neutral **A = 1.0**                                                                                                                                                                                        | Users shouldn't be penalised for steps they haven't been shown yet                                                                                                                                |
| Ranking "What drove it" items            | By **depth difference**, not altitude difference. Both are still shown                                                                                                                                     | Altitude already includes A, so days with an item honoured get up to a 1.5× boost automatically; ranking by altitude would always favour the routine                                              |
| Missing weeks 2–3 only                   | Still gets a growth rate if weeks 1 and 4 each have ≥4 climbing days                                                                                                                                       | This is what the spec's rule says; the report's trends will show the gap                                                                                                                          |
| App exits during a climb                 | Logged as interruptions with timestamps, but their time is **not subtracted** from flow minutes                                                                                                            | JavaScript cannot tell "locked the phone and worked" from "opened another app". Subtracting would zero out anyone who puts the phone down. Revisit when blocking (v1.1) gives real app-usage data |
| Shortest and longest climb               | Under **1 minute** is discarded (not a session, not a climbing day). One climb is capped at **4 hours**                                                                                                    | Stops accidental taps counting as climbing days, and stops a forgotten timer recording a whole day                                                                                                |
| Summit date at onboarding                | Four presets (2 weeks, 1 month, 3 months, 6 months) instead of a date picker                                                                                                                               | Keeps install-to-first-climb under 2 minutes; an exact date can be set in the Plan tab (Phase 3)                                                                                                  |
| Mountain with no chunks left             | The route always has one more step above the last finished chunk, and home asks "What will you work on next?"                                                                                              | Until Divide exists (Phase 3) the route has no known end, so finishing one chunk must not look like the summit                                                                                    |
| When setup steps appear                  | One card on the home screen per day after the first climb: Add from day 2, Subtract from day 3, Divide from day 4. A step that is done or dismissed ("Not now") is skipped; all three stay in the Plan tab | The spec says setup must never block the first climb, and introduces steps 2 to 4 over the first three days                                                                                       |
| When a route counts as divided           | Two or more chunks planned ahead, or a second camp                                                                                                                                                         | The Divide card should stop once the user has actually planned ahead                                                                                                                              |
| Add adherence                            | Recorded per climb from the pre-climb checklist: every Add item gets a record, ticked or not. Starting without ticking is allowed                                                                          | Unticked must count as not done, or adherence would always read 100%                                                                                                                              |
| Subtract adherence (self-report)         | At check-in the Subtract items appear as chips; the user taps only the ones that pulled them away. Untapped means honoured. A skipped check-in records nothing                                             | Keeps a clean climb at zero extra taps (check-in fatigue is a named risk). **Trade-off:** the default leans towards "honoured"; revisit once blocking (v1.1) gives real data                      |
| Reordering chunks                        | Up and down arrows; at the edge of a camp the chunk crosses into the next camp. No drag-and-drop                                                                                                           | Works with screen readers and needs no gesture library. Drag can be added later if testers ask                                                                                                    |
| Removing things                          | Routine items are archived (history kept). Unfinished chunks can be removed; finished chunks cannot. A camp can be removed only when empty and not the last one                                            | Past climbs and adherence must keep meaning what they meant                                                                                                                                       |
| Daily reminder                           | One local notification a day at the chosen time, skipped on days already climbed. Scheduled 14 days ahead and re-planned whenever the app opens, so it stops after 14 days without opening the app         | Avoids nagging someone who already climbed, and avoids reminding forever after someone has left. The 14 days is `REMINDER_DAYS_AHEAD`                                                             |
| Notification permission                  | Asked only when the user turns the reminder on. The "climb in progress" notification is shown only to users who have reminders on                                                                          | Day 0 must not include a permission prompt                                                                                                                                                        |
| Summit date editing                      | Step buttons (±1, ±7, ±30 days) in Settings, never earlier than today                                                                                                                                      | No native date-picker dependency                                                                                                                                                                  |
| Device settings                          | Reminder time and dismissed prompts live in a local `device_settings` table, not in a synced `profiles` row                                                                                                | Notifications are per device; `profiles` arrives with accounts in Phase 5                                                                                                                         |
| Daily adherence                          | Mean of Add adherence and Subtract adherence, using only lists that have items                                                                                                                             | Simple; matches "routine adherence"                                                                                                                                                               |
| At the summit                            | Celebrate, archive the mountain (keep its history), then offer to start the next one. On the free plan only one mountain can be **active**                                                                 | Keeps the free plan's one-mountain limit without hiding history                                                                                                                                   |
| Avatar on missed days                    | Avatar position = route progress (chunks done). After a missed day it is drawn at the last camp reached. **If no camp has been reached yet it stays where it is.** Cumulative altitude never goes down     | Matches "returns to last camp, never to zero". Before the first camp, sliding back would mean sliding to the very bottom                                                                          |
| Account before first session             | None. The app works locally with no sign-in. A Supabase **anonymous user** is created silently when the device is online, and the user can link Google/Apple/email later                                   | Meets "no account before first session" and still allows cloud backup                                                                                                                             |
| What syncs                               | Mountains, camps, chunks, routine items, session rows, check-ins, daily adherence. Raw pause/exit events stay on the device; only their counts sync                                                        | Follows the "store on device, sync summaries" profit lever while still allowing restore from backup                                                                                               |
| AI Divide monthly cap (v1.1)             | Starting point: Paid 30 runs/month, Lifetime 30/month, Free 0. Revisit after measuring cost                                                                                                                | Placeholder; the spec leaves it open                                                                                                                                                              |
| Multiplier ranges (D 0.5–1.5, A 0.8–1.2) | Keep them as **constants in one file**, versioned, so they can be tuned after the first cohort                                                                                                             | Tuning is expected                                                                                                                                                                                |

---

## 3. Architecture

```
┌──────────────────────── Expo app (Android / iOS) ────────────────────────┐
│ Expo Router screens                                                      │
│   ↓                                                                      │
│ Feature hooks (Zustand for UI state, TanStack Query for server reads)    │
│   ↓                                                                      │
│ src/domain  ← pure TypeScript: altitude, growth, reports, insights       │
│   ↓                                                                      │
│ src/db (expo-sqlite + Drizzle)  ← source of truth on the device          │
│   ↓ sync queue (push on change / pull on sign-in)                        │
└───────┬──────────────────────────────────────────────┬───────────────────┘
        ↓                                              ↓
  Supabase (Postgres + RLS, Auth, Edge Functions)   RevenueCat (Play / App Store billing)
        ↑                                              │ webhook
        └──────────── entitlements table ←─────────────┘
```

**Libraries**

| Concern         | Choice                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| App framework   | Expo (latest stable SDK), TypeScript strict, Expo Router, EAS Build/Submit   |
| Local DB        | `expo-sqlite` + `drizzle-orm` (typed schema and migrations)                  |
| State           | Zustand (UI/session state), TanStack Query (remote data)                     |
| Backend         | Supabase: Postgres, Auth (anonymous, Google, Apple, email), Edge Functions   |
| Billing         | RevenueCat (`react-native-purchases` + `react-native-purchases-ui` paywalls) |
| Animation / art | `react-native-reanimated`, `react-native-svg` (mountain, avatar, charts)     |
| Charts          | `victory-native`, or hand-drawn SVG for the hero chart                       |
| Notifications   | `expo-notifications` (local daily reminder; no push server needed)           |
| Share card      | `react-native-view-shot` + `expo-sharing`                                    |
| Analytics       | PostHog (free tier) for activation and retention funnels                     |
| Crashes         | Sentry (`@sentry/react-native`)                                              |
| Tests           | Jest + `@testing-library/react-native`; Maestro for end-to-end flows         |

**Timer rule:** never count time by adding up ticks. Store `started_at`, pause intervals and `ended_at` as timestamps, and work out elapsed time from the clock. This keeps the timer correct when the app is backgrounded or killed. Detect app exits with `AppState`.

---

## 4. Data model (Supabase; mirrored in SQLite)

Every table has `id uuid`, `user_id uuid`, `created_at`, `updated_at` and `deleted_at` (soft delete, for sync). Row-level security on every table: `user_id = auth.uid()`.

| Table                | Key columns                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles` (Phase 5) | `timezone`, `first_climb_date`                                                                                                             |
| `mountains`          | `name`, `target_date`, `status` (active / summited / archived), `summited_at`                                                              |
| `camps`              | `mountain_id`, `name`, `position`                                                                                                          |
| `chunks`             | `mountain_id`, `camp_id`, `title`, `estimate_min`, `position`, `done_at`                                                                   |
| `routine_items`      | `mountain_id`, `kind` (add / subtract), `label`, `position`, `archived_at`                                                                 |
| `sessions`           | `chunk_id`, `started_at`, `ended_at`, `flow_seconds`, `pause_count`, `exit_count`, `local_date`                                            |
| `checkins`           | `session_id`, `focus`, `challenge_skill`, `time_passing` (1–5, nullable), `time_to_flow_min`, `chunk_done`, `skipped`                      |
| `day_adherence`      | `session_id`, `routine_item_id`, `local_date`, `honoured` (bool), `source` (checklist / self_report / blocker). One row per item per climb |
| `device_settings`    | `key`, `value`. Device only, never synced: reminder time, dismissed setup prompts                                                          |
| `entitlements`       | `user_id`, `entitlement`, `expires_at`, `source` (written only by the RevenueCat webhook)                                                  |

Altitude and reports are **calculated from these rows, not stored**: on the device for the app, and in SQL views for any later web dashboard.

---

## 5. Measurement maths (put in `src/domain`, fully unit-tested)

```
D(session)   = 0.25 * mean(focus, challenge_skill, time_passing) + 0.25      // 1→0.5, 5→1.5; skipped → 1.0
adherence    = mean of available { addTicked/addTotal, subtractHonoured/subtractTotal }
A(day)       = 0.8 + 0.4 * adherence                                         // no items → 1.0
Altitude_day = Σ_sessions flowMinutes × D × A(day)
avgWeek(k)   = Σ altitude over the 7 days of week k / 7
g            = (avgWeek(4) / avgWeek(1))^(1/21) − 1                          // needs ≥4 climbing days in week 1 AND week 4, and avgWeek(1) > 0
flatPath(n)  = avgWeek(1) × n                                                // cumulative, n = 1…30
compounding  = actualCumulative(30) − flatPath(30)
trend lines  = 7-day rolling averages
driver item  = shown only when ≥5 days with it honoured AND ≥5 days without; copy says "associated with"
```

Edge cases to test: zero sessions, all check-ins skipped, a missed week, DST and timezone changes, a session running past midnight (it belongs to the start date), negative growth, week 1 average of 0.

---

## 6. Step-by-step build plan

Rough estimates assume one developer working full-time. Each phase ends with an exit check that must pass before moving on.

### Phase 0 — Accounts and setup (2–3 days)

> **Status (17 Nov 2026):** code scaffold done (Expo SDK 58, strict TS, ESLint + Prettier, Jest, `eas.json`, GitHub Actions CI). Store, Supabase, RevenueCat, PostHog, Sentry and EAS accounts are still to do.

1. Create a Google Play Console account ($25). Plan for the **closed test requirement for new personal accounts** (at time of writing: 12 testers opted in for 14 days before production access; check the current rule). **Start recruiting testers now.**
2. Enrol in Google Play's 15% service-fee tier.
3. Create Supabase (free for now), RevenueCat, PostHog, Sentry and Expo/EAS accounts. Register the domain.
4. `git init`, create a GitHub repo, and add this PLAN.md, AGENTS.md and CLAUDE.md.
5. Scaffold the app: `npx create-expo-app@latest` (TypeScript, Expo Router). Add ESLint, Prettier, Jest, and strict `tsconfig`.
6. Set up EAS: a `development` profile (dev client, needed for RevenueCat and native modules), plus `preview` and `production` profiles.
7. Set up GitHub Actions CI: typecheck, lint and test on every push.

**Exit:** a dev-client build runs on a physical Android phone; CI is green.

### Phase 1 — Domain engine first (3–4 days)

> **Status (17 Nov 2026):** done. `src/domain` has 65 tests at 100% coverage, and a lint rule keeps the folder pure.

The product bet is the measurement, so build and prove it before any UI.

1. `src/domain/constants.ts`: the multiplier ranges, report thresholds and `MODEL_VERSION`.
2. `altitude.ts`, `adherence.ts`, `growth.ts`, `rolling.ts`, `insights.ts`, `reports.ts` (pure functions, no I/O).
3. `src/domain/fixtures/`: 30-day synthetic users (improving, flat, declining, sparse, gappy).
4. Unit tests for every formula and edge case in §5.

**Exit:** 100% branch coverage on `src/domain`; a fixture of an improving user gives the expected `g`.

### Phase 2 — Local data and day-0 core loop (1.5–2 weeks)

> **Status (17 Nov 2026):** done, and confirmed running in Expo Go. Review fixes applied: double-tap guards, a two-tap "Discard climb", a notice at the 4-hour cap, and home refreshing when the app returns to the foreground. The ongoing climb notification is built (shown only when reminders are on). Still open: an animated avatar (it moves, but without animation) and the 2-minute stopwatch test on a phone.

1. Drizzle schema + migrations in `src/db`, with typed repository functions (`mountains.create`, `sessions.start`, and so on).
2. **Onboarding:** one screen asks for the mountain name and target date, creates a default camp and a "First chunk" chunk, then goes straight to the climb screen. No sign-in.
3. **Mountain screen:** SVG mountain, camps, an avatar placed by route progress, and today's altitude.
4. **Climb timer:** pick a chunk (pre-selected on day 0), start / pause / resume / end. Elapsed time is computed from timestamps; pauses and app exits are counted; it works offline. Show an ongoing notification during a climb on Android.
5. **Summit check-in:** three 1–5 tap rows, a time-to-flow tap (0 / 5 / 10 / 15 / 20+ min), chunk done or not, and a Skip button. At most 4 interactions; aim for under 10 seconds.
6. A summit / altitude-gained moment after check-in, with avatar animation.
7. Analytics events: `app_installed`, `onboarding_completed`, `climb_started`, `climb_completed`, `checkin_completed`, `checkin_skipped`.

**Exit:** on a fresh install, a stopwatch test from launch to the end of a first climb shows under 2 minutes of setup; killing the app mid-climb and reopening restores the timer correctly.

### Phase 3 — Gradual Add / Subtract / Divide setup and reminders (1 week)

> **Status (17 Nov 2026):** built and covered by automated tests, including a four-day simulated run (Add on day 2, Subtract on day 3, Divide on day 4). Booted once in a browser; **not yet run on a phone**, and reminders have not been seen firing on a real device. Use Settings → Developer tools → "Advance one day" to test the day-by-day prompts.

1. One-card prompts on the home screen: Add from day 2, Subtract from day 3, Divide from day 4 (day 1 is the first climb). Each can be dismissed and is always reachable later in the Plan tab.
2. Add list → the pre-climb checklist shown before the timer starts (ticking it records Add adherence).
3. Subtract list → self-report after check-in ("Did you avoid: …?"), which records Subtract adherence.
4. Manual Divide: create, edit, reorder (up/down arrows) and estimate chunks; group them into camps; record estimate vs actual time.
5. Missed-day handling: the avatar is drawn at the last camp, with no shaming copy.
6. Daily reminder at a time the user picks (`expo-notifications`, scheduled locally 14 days ahead and re-planned on every app open, so time and timezone changes are picked up).

**Exit:** a test user can run the whole loop for 3 simulated days using the developer "Advance one day" button in Settings.

### Phase 4 — Reports (1.5 weeks)

1. **Today view:** today's altitude, position on the mountain, and the next chunk.
2. **7-day mini report** (on day 7 and from the Reports tab): total altitude, flow minutes, best session and the checklist items that came before it, average time-to-flow, and one week-2 suggestion chosen by rules.
3. **30-day report:** headline (`g` + total altitude), a hero chart of actual cumulative altitude vs the flat path, trends, what drove it, next 30 days, and a share card.
4. **Honest states:** not-enough-data (trends with no growth rate); plateau / decline (lead with the strongest positive signal, then name the one item most associated with weak sessions).
5. Free / paid gating hooks on each section (locked previews in place; real paywall comes in Phase 6).
6. Dev tool: "Load fixture user" to view every report state on a device.

**Exit:** every fixture from Phase 1 renders a correct, honest report.

### Phase 5 — Accounts and sync (1 week)

1. Supabase SQL migrations for §4, with RLS policies and indexes on `(user_id, updated_at)`.
2. Create an anonymous Supabase user silently the first time the device is online.
3. Sync engine: push local changes since the last sync, pull remote changes since the last sync, last-write-wins on `updated_at`, soft deletes.
4. Settings → "Back up your climb": link Google or email (Apple added in Phase 9). Restore on a new device.
5. Account deletion (required by both stores): deletes the user's server data and local data.

**Exit:** install on phone A, climb, link the account, install on phone B, sign in → identical history.

### Phase 6 — Subscriptions and paywalls (1 week)

1. Create the products in Play Console: monthly, annual (with a 7-day free trial) and founder lifetime (one-time purchase). Set **regional prices per country** (USD tier plus INR prices from the spec).
2. RevenueCat: one `pro` entitlement and an offering with annual as the default.
3. Paywall moments: (1) after the first completed climb, offer the trial; (2) day-7 report with a locked trends preview; (3) when adding a second mountain; (4) day-30 report with the breakdown locked.
4. `useEntitlement()` hook; gating as in the spec's free/paid table (free stats history = last 7 days).
5. RevenueCat webhook → Supabase Edge Function → `entitlements` table (needed for server-gated AI Divide later).
6. Restore purchases, plus a manage-subscription link.

**Exit:** a sandbox purchase, trial, cancel and restore all work on a test device.

### Phase 7 — Hardening and launch prep (1 week, overlapping the closed test)

1. Sentry release tracking; PostHog funnels for activation, D7, D30, check-in completion and trial-to-paid.
2. Accessibility (screen-reader labels on taps, dynamic type, contrast), plus dark mode.
3. Maestro end-to-end flows: onboarding → first climb → check-in; paywall; sync restore.
4. Landing page (Astro or Next.js on **Cloudflare Pages**, not Vercel Hobby), privacy policy and terms.
5. Play Store listing: screenshots, the Data safety form, content rating.
6. Move Supabase to **Pro ($25/mo)** before launch so the project never pauses.
7. Run the closed test (the required testers for the required days). Fix what they find.

**Exit:** closed test done, production access granted, no crash-free-rate regressions.

### Phase 8 — Android launch (a few days)

1. Staged rollout (10% → 50% → 100%).
2. Watch activation (target 60%) and check-in completion (target 80%) daily; fix onboarding friction first.
3. Price test on the **annual** plan first.

### Phase 9 — iOS release (1–2 weeks)

1. Apple Developer Program ($99/yr); enrol in the **App Store Small Business Program** (15%).
2. **Sign in with Apple** (required when other social sign-ins are offered).
3. App Store Connect products mirroring Android; RevenueCat iOS app.
4. iOS quirks: notification permission prompt timing, Live Activity for the running climb (optional), App Review notes on subscriptions.
5. TestFlight beta → submit.

### Phase 10 — v1.1: paid drivers (4–6 weeks; validate first)

1. **Blocking spike before committing to scope:**
   - Android: UsageStatsManager + overlay, or AccessibilityService. Check Play's Accessibility API policy and declaration requirements.
   - iOS: FamilyControls / ManagedSettings / DeviceActivity. **Apply for the Family Controls distribution entitlement early**; build it as an Expo config plugin + native module.
   - Write the blocker's results into `day_adherence` with `source = 'blocker'`.
2. **AI Divide:** a Supabase Edge Function calls a small, cheap model (for example Claude Haiku), returns chunks and estimates as JSON, enforces the monthly cap per plan from the `entitlements` table, and logs token cost.
3. Multiple mountains (paid), home-screen widget (Android Glance / iOS WidgetKit via config plugins), cosmetic avatars and mountain ranges.

### Phase 11 — Web (later)

1. Next.js web dashboard on Cloudflare, reading the same Supabase data through SQL views.
2. Web checkout (Stripe through RevenueCat Web Billing) where store rules allow it.
3. Later backlog: calendar sync, rope teams, wearables, CSV/PDF export.

**Rough timeline to Android production:** about 9–11 weeks of build time, plus the closed-test wait (start it as early as Phase 4–5 with an internal build so it doesn't hold up launch).

---

## 7. Risks to watch

| Risk                                      | Plan                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Most users show no compounding in 30 days | Honest plateau report designed and tested in Phase 4 using fixtures        |
| Check-in fatigue                          | At most 4 taps, Skip button, check-in completion metric tracked from day 1 |
| Blocking blocked by platform policy       | Phase 10 starts with a spike; v1 never depends on it                       |
| Play closed-test delay                    | Recruit testers in Phase 0; start the test early with an internal build    |
| AI cost runaway                           | Server-side caps per user, cheap model, cost logged per call               |
| Timezone / midnight bugs corrupt reports  | `local_date` stored per session; domain tests cover DST and travel         |

## 8. Success metrics (from the spec)

Activation 60% · Day-7 retention 30% · Day-30 retention 12% · Check-in completion 80% · Trial-to-paid 35%. Revise these after the first cohort.
