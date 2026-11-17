import { addDays } from '../dates';
import type { AdherenceRecord, DepthTap, LocalDate, RoutineItem, Session } from '../types';

/**
 * Deterministic synthetic users for tests and the dev "load fixture user" menu.
 * Each profile spans 30 days starting at `firstClimbDate`.
 */
export type FixtureProfile =
  'improving' | 'flat' | 'declining' | 'sparse' | 'gappy' | 'exact_doubling';

export const FIXTURE_PROFILES: readonly FixtureProfile[] = [
  'improving',
  'flat',
  'declining',
  'sparse',
  'gappy',
  'exact_doubling',
];

export interface FixtureUser {
  profile: FixtureProfile;
  firstClimbDate: LocalDate;
  items: RoutineItem[];
  sessions: Session[];
  adherence: AdherenceRecord[];
}

export const FIXTURE_ITEMS: RoutineItem[] = [
  { id: 'add-walk', kind: 'add', label: '10-minute walk' },
  { id: 'add-water', kind: 'add', label: 'Glass of water' },
  { id: 'sub-phone', kind: 'subtract', label: 'Phone in another room' },
];

/** Small seeded PRNG (mulberry32) so fixtures never change between runs. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTap(value: number): DepthTap {
  return Math.min(5, Math.max(1, Math.round(value))) as DepthTap;
}

/** Linear interpolation across days 1..30. */
function ramp(day: number, from: number, to: number): number {
  return from + ((to - from) * (day - 1)) / 29;
}

interface DayPlan {
  climbs: boolean;
  minutes: number;
  depth: number;
  timeToFlow: number;
  interruptions: number;
  walk: boolean;
  phoneAway: boolean;
}

function planDay(profile: FixtureProfile, day: number, random: () => number): DayPlan {
  const jitter = (size: number) => (random() - 0.5) * 2 * size;
  const walk = day % 2 === 0;
  const phoneAway = day % 3 !== 0;
  switch (profile) {
    case 'improving':
      return {
        climbs: day % 7 !== 0,
        minutes: ramp(day, 30, 65) + jitter(3),
        // Walking days are a full tap deeper, so the walk shows up as a driver.
        depth: ramp(day, 2, 3.5) + (walk ? 1 : 0),
        timeToFlow: ramp(day, 20, 5),
        interruptions: Math.round(ramp(day, 4, 0)),
        walk,
        phoneAway,
      };
    case 'flat':
      return {
        climbs: day % 7 !== 0,
        minutes: 40 + jitter(2),
        depth: 3,
        timeToFlow: 12,
        interruptions: 1,
        walk,
        phoneAway,
      };
    case 'declining':
      return {
        climbs: day % 7 !== 0,
        minutes: ramp(day, 60, 30) + jitter(3),
        // Days with the phone nearby are a full tap shallower.
        depth: ramp(day, 4, 2.5) - (phoneAway ? 0 : 1),
        timeToFlow: ramp(day, 8, 20),
        interruptions: Math.round(ramp(day, 1, 4)),
        walk,
        phoneAway,
      };
    case 'sparse':
      return {
        climbs: day % 7 === 1 || day % 7 === 4,
        minutes: 45,
        depth: 3,
        timeToFlow: 10,
        interruptions: 1,
        walk,
        phoneAway,
      };
    case 'gappy':
      return {
        climbs: day <= 7 || day >= 22,
        minutes: day <= 7 ? 40 : 50,
        depth: 3,
        timeToFlow: 10,
        interruptions: 1,
        walk,
        phoneAway,
      };
    case 'exact_doubling':
      // Week 1: 50 altitude/day; week 4: 100/day; D = 1 (all 3s) and A = 1 (no items).
      return {
        climbs: true,
        minutes: day <= 7 ? 50 : day >= 22 && day <= 28 ? 100 : 75,
        depth: 3,
        timeToFlow: 10,
        interruptions: 0,
        walk: false,
        phoneAway: false,
      };
  }
}

export function makeFixtureUser(
  profile: FixtureProfile,
  firstClimbDate: LocalDate = '2026-11-01',
): FixtureUser {
  const random = seededRandom(FIXTURE_PROFILES.indexOf(profile) + 1);
  const items = profile === 'exact_doubling' ? [] : FIXTURE_ITEMS;
  const sessions: Session[] = [];
  const adherence: AdherenceRecord[] = [];

  for (let day = 1; day <= 30; day++) {
    const plan = planDay(profile, day, random);
    if (!plan.climbs) continue;
    const localDate = addDays(firstClimbDate, day - 1);
    const tap = toTap(plan.depth);
    sessions.push({
      id: `${profile}-${day}`,
      localDate,
      flowSeconds: Math.round(plan.minutes * 60),
      pauseCount: Math.ceil(plan.interruptions / 2),
      exitCount: Math.floor(plan.interruptions / 2),
      checkin: {
        skipped: false,
        focus: tap,
        challengeSkill: tap,
        timePassing: tap,
        timeToFlowMin: Math.round(plan.timeToFlow),
        chunkDone: day % 2 === 1,
      },
    });
    if (items.length > 0) {
      adherence.push(
        { localDate, itemId: 'add-walk', kind: 'add', honoured: plan.walk },
        { localDate, itemId: 'add-water', kind: 'add', honoured: true },
        { localDate, itemId: 'sub-phone', kind: 'subtract', honoured: plan.phoneAway },
      );
    }
  }

  return { profile, firstClimbDate, items, sessions, adherence };
}
