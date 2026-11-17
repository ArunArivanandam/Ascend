import { addDays } from '../dates';
import { FIXTURE_PROFILES, makeFixtureUser } from '../fixtures/users';
import {
  buildCompoundingReport,
  buildMiniReport,
  strongestPositiveSignal,
  type WeekTrend,
} from '../reports';
import { rated, record, session, skipped } from './helpers';

const START = '2026-11-01';

describe('buildCompoundingReport with fixture users', () => {
  it('reports growth for the improving user, with the walk as a driver', () => {
    const report = buildCompoundingReport(makeFixtureUser('improving'));
    expect(report.outcome).toBe('growth');
    expect(report.growth.status === 'ok' && report.growth.g).toBeGreaterThan(0.01);
    expect(report.compoundingGap).toBeGreaterThan(0);
    expect(report.itemToChange).toBeNull();
    expect(report.drivers[0]?.item.id).toBe('add-walk');
    expect(report.nextThirtyDays.keep.map((i) => i.id)).toContain('add-walk');
    expect(report.nextThirtyDays.projectedAltitude).toBeGreaterThan(report.totalAltitude);
    expect(report.strongestPositiveSignal).not.toBeNull();
  });

  it('reports a plateau honestly for the flat user', () => {
    const report = buildCompoundingReport(makeFixtureUser('flat'));
    expect(report.outcome).toBe('plateau');
    expect(Math.abs(report.compoundingGap)).toBeLessThan(report.totalAltitude * 0.05);
  });

  it('reports a decline and names the item most associated with weak sessions', () => {
    const report = buildCompoundingReport(makeFixtureUser('declining'));
    expect(report.outcome).toBe('decline');
    expect(report.compoundingGap).toBeLessThan(0);
    expect(report.itemToChange?.item.id).toBe('sub-phone');
  });

  it('shows trends without a growth rate for a sparse user (2 climbs a week)', () => {
    const report = buildCompoundingReport(makeFixtureUser('sparse'));
    expect(report.outcome).toBe('insufficient_data');
    expect(report.nextThirtyDays.projectedAltitude).toBeNull();
    expect(report.trends).toHaveLength(4);
    expect(report.rollingAltitude).toHaveLength(30);
  });

  it('still gives a growth rate when only weeks 2–3 are missed (weeks 1 and 4 qualify)', () => {
    const report = buildCompoundingReport(makeFixtureUser('gappy'));
    expect(report.growth.status).toBe('ok');
    expect(report.trends[1]?.climbingDays).toBe(0);
    expect(report.trends[2]?.climbingDays).toBe(0);
  });

  it('builds a report for every fixture profile without throwing', () => {
    for (const profile of FIXTURE_PROFILES) {
      const report = buildCompoundingReport(makeFixtureUser(profile));
      expect(report.series).toHaveLength(30);
      expect(report.actualCumulative.at(-1)).toBeCloseTo(report.totalAltitude);
    }
  });

  it('handles a user with no sessions at all', () => {
    const report = buildCompoundingReport({
      firstClimbDate: START,
      sessions: [],
      adherence: [],
      items: [],
    });
    expect(report.outcome).toBe('insufficient_data');
    expect(report.totalAltitude).toBe(0);
    expect(report.compoundingGap).toBe(0);
    expect(report.strongestPositiveSignal).toBeNull();
    expect(report.trends[0]).toMatchObject({ velocity: null, interruptionsPerSession: null });
  });
});

describe('buildMiniReport', () => {
  const walk = { id: 'walk', kind: 'add' as const, label: 'Walk' };
  const water = { id: 'water', kind: 'add' as const, label: 'Water' };

  function week(minutesPerDay: number[], overrides = {}) {
    return minutesPerDay.flatMap((minutes, i) =>
      minutes > 0 ? [session(addDays(START, i), minutes, overrides)] : [],
    );
  }

  it('totals the week and finds the best session and what preceded it', () => {
    const sessions = week([30, 30, 90, 30, 30, 0, 0]);
    const bestDate = addDays(START, 2);
    const report = buildMiniReport({
      firstClimbDate: START,
      sessions,
      adherence: [
        record(bestDate, 'walk', true),
        record(bestDate, 'water', false),
        record(bestDate, 'phone', true, 'subtract'),
      ],
      items: [walk, water],
    });
    expect(report.climbingDays).toBe(5);
    expect(report.totalFlowMinutes).toBe(210);
    expect(report.bestSession?.session.localDate).toBe(bestDate);
    expect(report.bestSession?.precededBy.map((i) => i.id)).toEqual(['walk']);
    expect(report.averageTimeToFlowMin).toBe(10);
    expect(report.suggestion).toBe('keep_routine');
  });

  it('has no best session in an empty week', () => {
    const report = buildMiniReport({
      firstClimbDate: START,
      sessions: [],
      adherence: [],
      items: [],
    });
    expect(report.bestSession).toBeNull();
    expect(report.averageTimeToFlowMin).toBeNull();
    expect(report.suggestion).toBe('climb_more_days');
  });

  it.each([
    ['climb_more_days', week([30, 30, 30, 0, 0, 0, 0])],
    ['complete_checkins', week([30, 30, 30, 30, 0, 0, 0], { checkin: skipped })],
    ['reduce_interruptions', week([30, 30, 30, 30, 0, 0, 0], { pauseCount: 2 })],
    [
      'add_warmup_item',
      week([30, 30, 30, 30, 0, 0, 0], { checkin: rated(3, { timeToFlowMin: 20 }) }),
    ],
    [
      'keep_routine',
      week([30, 30, 30, 30, 0, 0, 0], { checkin: rated(3, { timeToFlowMin: null }) }),
    ],
  ])('suggests %s', (expected, sessions) => {
    const report = buildMiniReport({ firstClimbDate: START, sessions, adherence: [], items: [] });
    expect(report.suggestion).toBe(expected);
  });
});

describe('strongestPositiveSignal', () => {
  const trend = (overrides: Partial<WeekTrend>): WeekTrend => ({
    week: 1,
    climbingDays: 5,
    flowMinutes: 100,
    meanDepthTap: 3,
    meanTimeToFlowMin: 10,
    velocity: 1,
    interruptionsPerSession: 1,
    ...overrides,
  });

  it('treats lower time-to-flow and fewer interruptions as improvements', () => {
    const signal = strongestPositiveSignal(trend({}), trend({ meanTimeToFlowMin: 4 }));
    expect(signal).toMatchObject({ metric: 'timeToFlow', relativeImprovement: 0.6 });
  });

  it('picks the largest relative improvement', () => {
    const signal = strongestPositiveSignal(
      trend({}),
      trend({ flowMinutes: 110, meanDepthTap: 4.5, interruptionsPerSession: 0.8 }),
    );
    expect(signal?.metric).toBe('depth');
  });

  it('skips metrics with a zero or missing baseline and returns null when nothing improved', () => {
    expect(
      strongestPositiveSignal(
        trend({ interruptionsPerSession: 0, velocity: null }),
        trend({ flowMinutes: 50, interruptionsPerSession: 0 }),
      ),
    ).toBeNull();
  });
});
