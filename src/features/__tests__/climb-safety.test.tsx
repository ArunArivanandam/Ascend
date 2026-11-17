import { act, fireEvent, screen } from 'expo-router/testing-library';

import { createTestDb } from '@/db/__tests__/testDb';
import { mountains } from '@/db/schema';

import { DAY_SECONDS, finishClimb, mockAppState, onboard, press, renderApp, type } from './harness';

afterEach(() => jest.restoreAllMocks());

describe('double taps', () => {
  it('create only one mountain when the first-climb button is tapped twice', async () => {
    const t = createTestDb();
    await renderApp(t);
    await type('mountain-name', 'Book');
    await act(async () => {
      const button = screen.getByTestId('start-first-climb');
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(t.db.select().from(mountains).all()).toHaveLength(1);
  });

  it('create only one chunk when Start climb is tapped twice', async () => {
    const t = createTestDb();
    await onboard(t);
    await finishClimb(t, 10);
    await press('back-to-mountain');
    await type('next-chunk-input', 'Write the introduction');
    await act(async () => {
      const button = screen.getByTestId('start-climb');
      fireEvent.press(button);
      fireEvent.press(button);
    });
    const mountainId = t.repos.mountains.getActive()!.id;
    expect(t.repos.chunks.list(mountainId).map((chunk) => chunk.title)).toEqual([
      'First climb',
      'Write the introduction',
    ]);
  });
});

describe('a forgotten timer', () => {
  it('stops counting at four hours, says so, and can be discarded with two taps', async () => {
    const t = createTestDb();
    const app = await onboard(t);
    t.advance(9 * 60 * 60);
    // Pausing and resuming refreshes the display, as the one-second tick would.
    await press('pause-resume');
    await press('pause-resume');
    expect(screen.getByTestId('climb-clock')).toHaveTextContent('4:00:00');
    expect(screen.getByTestId('climb-hint')).toHaveTextContent(/stops counting after 4 hours/);

    await press('discard-climb');
    expect(app.getPathname()).toBe('/climb'); // first tap only asks
    await press('discard-climb');
    expect(app.getPathname()).toBe('/');
    expect(t.repos.stats.domainSessions(t.repos.mountains.getActive()!.id)).toEqual([]);
    expect(screen.getByTestId('total-altitude')).toHaveTextContent('0 m');
  });
});

describe('leaving and returning to the app', () => {
  it('logs an app exit during a climb as one interruption without losing time', async () => {
    const t = createTestDb();
    const emitAppState = mockAppState();
    await onboard(t);
    t.advance(5 * 60);
    await emitAppState('background');
    t.advance(10 * 60);
    await emitAppState('active');
    expect(screen.getByTestId('climb-clock')).toHaveTextContent('15:00');

    await finishClimb(t, 5);
    const [session] = t.repos.stats.domainSessions(t.repos.mountains.getActive()!.id);
    expect(session).toMatchObject({ flowSeconds: 20 * 60, exitCount: 1, pauseCount: 0 });
  });

  it('refreshes the home screen when the app comes back on a later day', async () => {
    const t = createTestDb();
    const emitAppState = mockAppState();
    await onboard(t);
    await finishClimb(t, 30);
    await press('back-to-mountain');
    expect(screen.getByTestId('today-altitude')).toHaveTextContent('30 m');

    t.advance(DAY_SECONDS);
    await emitAppState('active');
    expect(screen.getByTestId('today-altitude')).toHaveTextContent('0 m');
    expect(screen.getByTestId('total-altitude')).toHaveTextContent('30 m');
    expect(screen.getByTestId('setup-prompt-add')).toBeOnTheScreen();
  });
});
