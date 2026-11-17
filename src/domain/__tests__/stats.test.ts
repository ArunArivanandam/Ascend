import { clamp, lerpClamped, mean, sum } from '../stats';

describe('stats helpers', () => {
  it('sums and averages', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
    expect(mean([])).toBeNull();
    expect(mean([2, 4])).toBe(3);
  });

  it('clamps and maps linearly', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerpClamped(3, 1, 5, 0.5, 1.5)).toBe(1);
    expect(lerpClamped(9, 1, 5, 0.5, 1.5)).toBe(1.5);
  });
});
