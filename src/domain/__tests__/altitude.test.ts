import {
  adherenceFraction,
  adherenceMultiplier,
  depthMultiplier,
  flowMinutes,
  isRated,
  meanDepthTap,
  sessionAltitude,
} from '../altitude';
import { rated, record, session, skipped } from './helpers';

describe('depthMultiplier (D)', () => {
  it('maps all 1s to 0.5 and all 5s to 1.5', () => {
    expect(depthMultiplier(rated(1))).toBe(0.5);
    expect(depthMultiplier(rated(5))).toBe(1.5);
  });

  it('maps a mean of 3 to 1.0 and is linear in between', () => {
    expect(depthMultiplier(rated(3))).toBe(1);
    expect(depthMultiplier(rated(2))).toBe(0.75);
    expect(
      depthMultiplier({ ...rated(1), challengeSkill: 4, timePassing: 4 }), // mean 3
    ).toBe(1);
  });

  it('is neutral (1.0) for skipped, missing or partial check-ins', () => {
    expect(depthMultiplier(skipped)).toBe(1);
    expect(depthMultiplier(null)).toBe(1);
    expect(depthMultiplier({ ...rated(5), timePassing: null })).toBe(1);
    expect(depthMultiplier({ ...rated(5), focus: null })).toBe(1);
    expect(depthMultiplier({ ...rated(5), challengeSkill: null })).toBe(1);
  });

  it('treats a check-in marked skipped as unrated even if taps are present', () => {
    expect(isRated({ ...rated(5), skipped: true })).toBe(false);
    expect(meanDepthTap({ ...rated(5), skipped: true })).toBeNull();
  });
});

describe('adherenceFraction', () => {
  it('is null with no records', () => {
    expect(adherenceFraction([])).toBeNull();
  });

  it('uses only the lists that have records', () => {
    const d = '2026-11-01';
    expect(adherenceFraction([record(d, 'a', true), record(d, 'b', false)])).toBe(0.5);
    expect(adherenceFraction([record(d, 's', true, 'subtract')])).toBe(1);
  });

  it('averages Add and Subtract adherence equally', () => {
    const d = '2026-11-01';
    const records = [
      record(d, 'a1', true),
      record(d, 'a2', true),
      record(d, 'a3', true),
      record(d, 'a4', false), // add = 0.75
      record(d, 's1', false, 'subtract'), // subtract = 0
    ];
    expect(adherenceFraction(records)).toBe(0.375);
  });
});

describe('adherenceMultiplier (A)', () => {
  it('maps 0% to 0.8 and 100% to 1.2', () => {
    expect(adherenceMultiplier(0)).toBeCloseTo(0.8);
    expect(adherenceMultiplier(1)).toBeCloseTo(1.2);
    expect(adherenceMultiplier(0.5)).toBeCloseTo(1);
  });

  it('is neutral when there is no adherence data and clamps out-of-range input', () => {
    expect(adherenceMultiplier(null)).toBe(1);
    expect(adherenceMultiplier(2)).toBeCloseTo(1.2);
    expect(adherenceMultiplier(-1)).toBeCloseTo(0.8);
  });
});

describe('sessionAltitude', () => {
  it('is FlowMinutes × D × A', () => {
    const s = session('2026-11-01', 60, { checkin: rated(5) });
    expect(sessionAltitude(s, 1.2)).toBeCloseTo(60 * 1.5 * 1.2);
  });

  it('never goes negative for bad timer data', () => {
    const s = session('2026-11-01', 0, { flowSeconds: -120 });
    expect(flowMinutes(s)).toBe(0);
    expect(sessionAltitude(s, 1)).toBe(0);
  });
});
