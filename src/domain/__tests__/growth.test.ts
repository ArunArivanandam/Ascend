import { makeFixtureUser } from '../fixtures/users';
import {
  classifyGrowth,
  computeGrowth,
  flatPath,
  projectAltitude,
  weekAverageAltitude,
} from '../growth';
import { buildDailySeries } from '../series';
import type { DaySummary } from '../types';

function seriesFor(altitudes: number[]): DaySummary[] {
  return altitudes.map((altitude, index) => ({
    day: index + 1,
    localDate: `d${index + 1}`,
    altitude,
    flowMinutes: altitude,
    sessionCount: altitude > 0 ? 1 : 0,
    climbed: altitude > 0,
    ratedSessionCount: 0,
    meanDepthTap: null,
    meanTimeToFlowMin: null,
    interruptions: 0,
    chunksDone: 0,
    adherence: null,
    adherenceMultiplier: 1,
  }));
}

describe('computeGrowth', () => {
  it('gives (2)^(1/21) − 1 when week-4 altitude is double week 1', () => {
    const user = makeFixtureUser('exact_doubling');
    const series = buildDailySeries({ ...user, days: 30 });
    const growth = computeGrowth(series);
    expect(growth.status).toBe('ok');
    if (growth.status !== 'ok') return;
    expect(growth.week1Average).toBeCloseTo(50);
    expect(growth.week4Average).toBeCloseTo(100);
    expect(growth.g).toBeCloseTo(Math.pow(2, 1 / 21) - 1, 10);
  });

  it('counts missed days as zero in weekly averages', () => {
    const series = seriesFor([70, 70, 70, 70, 0, 0, 0]);
    expect(weekAverageAltitude(series, 1)).toBe(40);
  });

  it('needs at least 4 climbing days in week 1', () => {
    const altitudes = [50, 50, 50, 0, 0, 0, 0, ...Array(14).fill(50), ...Array(9).fill(80)];
    const growth = computeGrowth(seriesFor(altitudes));
    expect(growth).toMatchObject({ status: 'insufficient_data', week1ClimbingDays: 3 });
  });

  it('needs at least 4 climbing days in week 4', () => {
    const altitudes = [...Array(21).fill(50), 80, 80, 80, 0, 0, 0, 0, 80, 80];
    const growth = computeGrowth(seriesFor(altitudes));
    expect(growth).toMatchObject({ status: 'insufficient_data', week4ClimbingDays: 3 });
  });

  it('is insufficient when the series has not reached week 4 yet', () => {
    expect(computeGrowth(seriesFor(Array(20).fill(50))).status).toBe('insufficient_data');
  });

  it('is insufficient when week 1 has climbs but zero altitude', () => {
    const series = seriesFor(Array(30).fill(50)).map((day) =>
      day.day <= 7 ? { ...day, altitude: 0 } : day,
    );
    expect(computeGrowth(series)).toMatchObject({ status: 'insufficient_data', week1Average: 0 });
  });

  it('reports negative growth honestly', () => {
    const altitudes = [...Array(7).fill(100), ...Array(14).fill(75), ...Array(9).fill(50)];
    const growth = computeGrowth(seriesFor(altitudes));
    expect(growth.status === 'ok' && growth.g).toBeLessThan(0);
  });
});

describe('classifyGrowth', () => {
  it('uses the plateau band', () => {
    expect(classifyGrowth(0.01)).toBe('growth');
    expect(classifyGrowth(0.001)).toBe('plateau');
    expect(classifyGrowth(-0.001)).toBe('plateau');
    expect(classifyGrowth(-0.01)).toBe('decline');
  });
});

describe('flatPath and projection', () => {
  it('projects week-1 average linearly', () => {
    expect(flatPath(10, 3)).toEqual([10, 20, 30]);
  });

  it('projects a flat 30 days when g = 0', () => {
    expect(projectAltitude(100, 0, 30, 30)).toBeCloseTo(3000);
  });

  it('compounds from the week-4 midpoint (day 25)', () => {
    // Day 31 is 6 days after day 25.
    expect(projectAltitude(100, 0.01, 30, 1)).toBeCloseTo(100 * Math.pow(1.01, 6));
  });
});
