# AGENTS.md

Instructions for AI coding agents (and people) working on DailyAscend. Read [PLAN.md](PLAN.md) for the product, the decisions already made and the phase you are in.

## Project in one paragraph

DailyAscend is a mobile productivity app with a mountain-climbing theme. A user picks one big task (a **mountain**) and splits it into **chunks** grouped into **camps**. They run timed **climbs** (focus sessions) and answer a short **summit check-in** after each one. The app calculates a daily **altitude** score and a 30-day **compounding** report. It runs offline first on Expo, backed by Supabase and RevenueCat. Android launches first, then iOS.

## Stack

- Expo (latest stable SDK), React Native, TypeScript (`strict`), Expo Router, EAS Build
- Local DB: `expo-sqlite` + `drizzle-orm` (the device is the source of truth)
- State: Zustand (UI), TanStack Query (remote)
- Backend: Supabase (Postgres + RLS, Auth, Edge Functions in Deno/TypeScript)
- Billing: RevenueCat (`react-native-purchases`)
- Tests: Jest + React Native Testing Library; Maestro for end-to-end tests

## Layout

```
src/
  app/                  Expo Router routes only (thin; no business logic). Every file here is a screen.
    (onboarding)/
    (tabs)/             index = mountain/today, plan, reports, settings
    climb/[chunkId].tsx
    checkin/[sessionId].tsx
    paywall.tsx
  domain/               PURE TypeScript (lint-enforced): altitude, series, growth, insights, reports, route, dates
    constants.ts        all multiplier ranges and thresholds, plus MODEL_VERSION
    fixtures/           synthetic 30-day users for tests and the dev "load fixture" menu
    __tests__/          unit tests (*.test.ts) + helpers.ts
  db/                   Drizzle schema, migrations, repositories
  sync/                 Supabase push/pull sync queue
  features/<feature>/   components + hooks per feature (climb, checkin, mountain, reports, divide, routine, paywall)
  services/             notifications, purchases, analytics, sentry, supabase client
  components/           shared UI
  theme/
supabase/
  migrations/           SQL migrations (schema + RLS)
  functions/            Edge Functions (revenuecat-webhook, ai-divide in v1.1)
e2e/                    Maestro flows
```

## Commands

| Task                         | Command                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| Install                      | `npm install`                                                       |
| Add a dependency             | `npx expo install <pkg>` (never plain `npm install <pkg>`)          |
| Dev server (dev client)      | `npm start`                                                         |
| Dev server (Expo Go)         | `npm run start:go` (only until the first native module lands)       |
| Android dev build            | `npx eas-cli@latest build --profile development --platform android` |
| **Everything CI runs**       | `npm run check` (typecheck + lint + format check + tests)           |
| Typecheck                    | `npm run typecheck`                                                 |
| Lint                         | `npm run lint`                                                      |
| Format                       | `npm run format`                                                    |
| Unit tests                   | `npm test`                                                          |
| Domain tests + 100% coverage | `npm run test:domain`                                               |
| Dependency health            | `npm run doctor`                                                    |
| DB migration (Phase 2+)      | `npx drizzle-kit generate`                                          |
| Supabase local (Phase 5+)    | `npx supabase start` / `npx supabase db reset`                      |
| End-to-end tests (Phase 7+)  | `maestro test e2e/`                                                 |

Before calling a task done, run `npm run check` (and `npm run test:domain` if `src/domain` changed) and make sure it passes.

## Expo has changed — do not trust training data

This project uses **Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6). Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or React Native API, read the versioned docs at `https://docs.expo.dev/versions/v58.0.0/`, or start from `https://docs.expo.dev/llms.txt`.

- `ios/` and `android/` are generated (Continuous Native Generation) and git-ignored. Never edit them; configure native behaviour through `app.json` and config plugins.
- After adding a library with native code, the app needs a new development build.
- TypeScript 6 doesn't load `@types/*` packages automatically: add new global type packages to `compilerOptions.types` in `tsconfig.json`.

## Domain rules (do not break)

These carry the product. Any change needs a matching change to PLAN.md §2/§5 and to the tests.

1. **Altitude** = Σ over sessions of `flowMinutes × D × A`.
   - `D = 0.25 × mean(three depth taps) + 0.25` (range 0.5–1.5). Skipped check-in → `D = 1.0`, and the session is left out of depth averages.
   - `A = 0.8 + 0.4 × adherence` (range 0.8–1.2). No routine items → `A = 1.0`.
2. **No streak multipliers and no bonuses.** Growth must reflect real improvement in rate.
3. **Growth** `g = (avgWeek4 / avgWeek1)^(1/21) − 1`. Weekly averages are over 7 calendar days, with missed days counted as 0. Only shown when there are ≥4 climbing days in week 1 **and** in week 4, and week 1's average is > 0.
4. The 30-day window starts at the **first completed climb**. Days are the user's **local dates**. A session belongs to the date it **started**.
5. Trend lines use 7-day rolling averages.
6. A driver insight needs ≥5 days with the item and ≥5 without. The copy always says "associated with", never "caused".
7. Altitude already gained is never removed. On missed days the avatar goes back to the last camp, never to zero.
8. Reports must be honest: when growth is flat or negative, say so plainly, lead with the strongest positive signal, then name one item to change.
9. All tunable numbers live in `src/domain/constants.ts`. Never hard-code them anywhere else.

## Coding conventions

- `src/domain` has **no imports** from React, Expo, the DB or the network. Pure functions, and every exported function is unit-tested.
- Route files in `app/` only compose feature components. Logic goes in `src/features/*` hooks or `src/domain`.
- The timer works out elapsed time from stored timestamps, never by adding up `setInterval` ticks.
- All writes go through `src/db` repositories, which also put rows on the sync queue. Never call Supabase directly from UI code.
- Every synced table has `id` (uuid generated on the client), `user_id`, `created_at`, `updated_at` and `deleted_at`. Use soft deletes only.
- Every Supabase table has RLS enabled with a `user_id = auth.uid()` policy. Never ship a table without RLS.
- Check paid features with `useEntitlement()`; never compare product IDs in UI code.
- Secrets: only `EXPO_PUBLIC_*` keys that are safe for the client (Supabase anon key, RevenueCat public SDK keys) go in the app. Service-role keys and AI API keys live only in Edge Function secrets.
- Keep the check-in to at most 4 interactions, and under 10 seconds.
- Copy tone: encouraging, plain, never shaming about missed days.
- TypeScript strict; no `any` without a comment explaining why. Prefer named exports.

## Scope guardrails

- MVP scope is in PLAN.md Phases 1–8. **Do not** build blocking, AI Divide, multiple mountains, widgets, cosmetics, calendar sync, rope teams, wearables or export until their phase.
- Non-goals: team/enterprise features, a general to-do list or calendar, a social feed.
- The first climb must never require an account, a paywall or more than the mountain name and target date.

## Git

- Small commits with descriptive messages. Branch per phase or feature (`phase-2/climb-timer`).
- Never commit `.env*`, keystores, `google-services.json` with secrets, or the Supabase service-role key.
