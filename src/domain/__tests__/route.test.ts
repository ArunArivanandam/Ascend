import { routePosition } from '../route';

const chunks = [
  { campIndex: 0, done: true },
  { campIndex: 0, done: true },
  { campIndex: 1, done: true },
  { campIndex: 1, done: false },
];

describe('routePosition', () => {
  it('places the avatar at actual progress when the user climbed yesterday', () => {
    const position = routePosition(chunks, '2026-11-09', '2026-11-10');
    expect(position).toEqual({
      progress: 0.75,
      lastCampProgress: 0.5,
      avatarProgress: 0.75,
      missedDay: false,
    });
  });

  it('returns the avatar to the last camp after a missed day, never to zero', () => {
    const position = routePosition(chunks, '2026-11-07', '2026-11-10');
    expect(position.missedDay).toBe(true);
    expect(position.avatarProgress).toBe(0.5);
    expect(position.progress).toBe(0.75);
  });

  it('stays put after a missed day when no camp has been reached yet (never to zero)', () => {
    const position = routePosition(
      [
        { campIndex: 0, done: true },
        { campIndex: 0, done: false },
      ],
      '2026-11-01',
      '2026-11-10',
    );
    expect(position.missedDay).toBe(true);
    expect(position.lastCampProgress).toBe(0);
    expect(position.avatarProgress).toBe(0.5);
    expect(position.progress).toBe(0.5);
  });

  it('handles a brand-new mountain with no chunks or climbs', () => {
    expect(routePosition([], null, '2026-11-10')).toEqual({
      progress: 0,
      lastCampProgress: 0,
      avatarProgress: 0,
      missedDay: false,
    });
    expect(routePosition(chunks, null, '2026-11-10').missedDay).toBe(false);
  });

  it('orders camps by index regardless of chunk order', () => {
    const position = routePosition(
      [
        { campIndex: 1, done: false },
        { campIndex: 0, done: true },
      ],
      '2026-11-10',
      '2026-11-10',
    );
    expect(position.lastCampProgress).toBe(0.5);
  });
});
