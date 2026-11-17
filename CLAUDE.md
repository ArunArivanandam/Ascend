# CLAUDE.md

@AGENTS.md

The shared project instructions are in AGENTS.md (imported above). The product, architecture, settled decisions and phased build plan are in [PLAN.md](PLAN.md). Notes below apply to Claude Code only.

## How to work in this repo

- **Check the current phase first.** Before starting a task, look at PLAN.md §6 and work only inside the current phase's scope. If a request reaches into a later phase (blocking, AI Divide, widgets and so on), say so before building it.
- **Domain first.** For anything that touches altitude, growth, adherence or reports, change `src/domain` and its tests first, then the UI. Run `npm test -- src/domain` after every change there.
- **Decisions live in PLAN.md §2.** If a task needs a new product decision (a formula tweak, a new threshold, a gating change), suggest the change to PLAN.md and ask before changing behaviour.
- **Native modules need a dev client.** RevenueCat, notifications and (later) blocking and widgets don't run in Expo Go. Suggest an EAS development build instead of Expo Go workarounds.
- **Environment:** the developer is on Windows. Prefer cross-platform npm scripts (no bash-only syntax in `package.json`). Android is the primary test device; iOS builds go through EAS cloud builds.
- **Verify before reporting done:** run typecheck, lint and the relevant tests, and report real results.

## Claude API usage (v1.1 AI Divide)

AI Divide runs only inside a Supabase Edge Function, never from the app. Use a small, cheap model (for example `claude-haiku-5-5`), ask for structured JSON output (chunks with titles and minute estimates), enforce the per-plan monthly cap from the `entitlements` table, and log token usage for each call.
