import { buildDailySeries, cumulative, rollingMean } from '../series';
import { rated, record, session, skipped } from './helpers';

describe('buildDailySeries', () => {
  it('returns one entry per calendar day, including missed days', () => {
    const series = buildDailySeries({
      firstClimbDate: '2026-11-01',
      days: 3,
      sessions: [session('2026-11-01', 30), session('2026-11-03', 20)],
      adherence: [],
    });
    expect(series.map((d) => [d.day, d.localDate, d.climbed])).toEqual([
      [1, '2026-11-01', true],
      [2, '2026-11-02', false],
      [3, '2026-11-03', true],
    ]);
    expect(series[1]).toMatchObject({ altitude: 0, flowMinutes: 0, meanDepthTap: null });
  });

  it('sums sessions and applies the day adherence multiplier to every session', () => {
    const d = '2026-11-01';
    const [day] = buildDailySeries({
      firstClimbDate: d,
      days: 1,
      sessions: [
        session(d, 30, { checkin: rated(5), pauseCount: 2, exitCount: 1 }),
        session(d, 30, { checkin: rated(1, { chunkDone: true }) }),
      ],
      adherence: [record(d, 'a', true)], // A = 1.2
    });
    expect(day?.altitude).toBeCloseTo((30 * 1.5 + 30 * 0.5) * 1.2);
    expect(day?.flowMinutes).toBe(60);
    expect(day?.interruptions).toBe(3);
    expect(day?.chunksDone).toBe(1);
    expect(day?.meanDepthTap).toBe(3);
    expect(day?.adherence).toBe(1);
  });

  it('leaves skipped check-ins out of depth and time-to-flow averages but keeps their minutes', () => {
    const d = '2026-11-01';
    const [day] = buildDailySeries({
      firstClimbDate: d,
      days: 1,
      sessions: [
        session(d, 40, { checkin: skipped }),
        session(d, 20, { checkin: null }),
        session(d, 10, { checkin: rated(5, { timeToFlowMin: 4 }) }),
      ],
      adherence: [],
    });
    expect(day?.altitude).toBeCloseTo(40 + 20 + 10 * 1.5);
    expect(day?.ratedSessionCount).toBe(1);
    expect(day?.meanDepthTap).toBe(5);
    expect(day?.meanTimeToFlowMin).toBe(4);
  });

  it('ignores sessions outside the window', () => {
    const series = buildDailySeries({
      firstClimbDate: '2026-11-01',
      days: 2,
      sessions: [session('2026-10-31', 30), session('2026-11-03', 30)],
      adherence: [],
    });
    expect(series.every((d) => !d.climbed)).toBe(true);
  });
});

describe('rollingMean', () => {
  it('uses a trailing window and partial windows at the start', () => {
    expect(rollingMean([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
    expect(rollingMean([], 7)).toEqual([]);
  });
});

describe('cumulative', () => {
  it('returns running totals', () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
  });
});
