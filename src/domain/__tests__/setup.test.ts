import { isRouteDivided, nextSetupPrompt, type SetupState } from '../setup';

const none = { add: false, subtract: false, divide: false };

function state(dayNumber: number | null, overrides: Partial<SetupState> = {}): SetupState {
  return { dayNumber, done: none, dismissed: none, ...overrides };
}

describe('nextSetupPrompt', () => {
  it('shows nothing before the first climb or on the day of the first climb', () => {
    expect(nextSetupPrompt(state(null))).toBeNull();
    expect(nextSetupPrompt(state(1))).toBeNull();
  });

  it('introduces Add, then Subtract, then Divide, one per day', () => {
    expect(nextSetupPrompt(state(2))).toBe('add');
    expect(nextSetupPrompt(state(3, { done: { ...none, add: true } }))).toBe('subtract');
    expect(nextSetupPrompt(state(4, { done: { add: true, subtract: true, divide: false } }))).toBe(
      'divide',
    );
  });

  it('keeps showing the earliest unfinished step on later days', () => {
    expect(nextSetupPrompt(state(10))).toBe('add');
  });

  it('skips steps that are done or dismissed, but not ahead of their day', () => {
    expect(nextSetupPrompt(state(2, { dismissed: { ...none, add: true } }))).toBeNull();
    expect(nextSetupPrompt(state(3, { dismissed: { ...none, add: true } }))).toBe('subtract');
    expect(nextSetupPrompt(state(9, { done: { ...none, add: true, subtract: true } }))).toBe(
      'divide',
    );
  });

  it('shows nothing once every step is done or dismissed', () => {
    expect(
      nextSetupPrompt(
        state(30, {
          done: { add: true, subtract: false, divide: true },
          dismissed: { add: false, subtract: true, divide: false },
        }),
      ),
    ).toBeNull();
  });
});

describe('isRouteDivided', () => {
  it('needs two chunks planned ahead or a second camp', () => {
    expect(isRouteDivided({ undoneChunks: 1, camps: 1 })).toBe(false);
    expect(isRouteDivided({ undoneChunks: 2, camps: 1 })).toBe(true);
    expect(isRouteDivided({ undoneChunks: 0, camps: 2 })).toBe(true);
  });
});
