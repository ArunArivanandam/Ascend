import { MAX_SESSION_SECONDS } from '../constants';
import { countEvents, flowSecondsAt, formatClock, isPaused, isTooShort } from '../timer';

const T0 = 1_000_000;
const sec = (n: number) => T0 + n * 1000;

describe('flowSecondsAt', () => {
  it('counts wall-clock time since the start while running', () => {
    expect(flowSecondsAt({ startedAt: T0, endedAt: null, events: [] }, sec(90))).toBe(90);
  });

  it('stops at endedAt once the climb has ended', () => {
    expect(flowSecondsAt({ startedAt: T0, endedAt: sec(60), events: [] }, sec(500))).toBe(60);
  });

  it('subtracts closed and still-open pauses', () => {
    const timer = {
      startedAt: T0,
      endedAt: null,
      events: [
        { kind: 'pause' as const, startedAt: sec(10), endedAt: sec(20) },
        { kind: 'pause' as const, startedAt: sec(50), endedAt: null },
      ],
    };
    expect(flowSecondsAt(timer, sec(80))).toBe(40); // 80 − 10 − 30
    expect(isPaused(timer)).toBe(true);
  });

  it('counts app exits but does not subtract them', () => {
    const timer = {
      startedAt: T0,
      endedAt: null,
      events: [{ kind: 'exit' as const, startedAt: sec(10), endedAt: sec(40) }],
    };
    expect(flowSecondsAt(timer, sec(60))).toBe(60);
    expect(countEvents(timer, 'exit')).toBe(1);
    expect(countEvents(timer, 'pause')).toBe(0);
    expect(isPaused(timer)).toBe(false);
  });

  it('clips pauses that fall outside the climb', () => {
    const timer = {
      startedAt: T0,
      endedAt: sec(60),
      events: [{ kind: 'pause' as const, startedAt: sec(50), endedAt: sec(200) }],
    };
    expect(flowSecondsAt(timer, sec(300))).toBe(50);
  });

  it('never goes negative and is capped at the maximum session length', () => {
    expect(flowSecondsAt({ startedAt: T0, endedAt: null, events: [] }, T0 - 5000)).toBe(0);
    expect(flowSecondsAt({ startedAt: T0, endedAt: null, events: [] }, sec(24 * 3600))).toBe(
      MAX_SESSION_SECONDS,
    );
  });
});

describe('isTooShort', () => {
  it('rejects climbs under a minute', () => {
    expect(isTooShort(59)).toBe(true);
    expect(isTooShort(60)).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});
