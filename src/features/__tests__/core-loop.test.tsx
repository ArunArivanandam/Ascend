import { act, fireEvent, screen } from 'expo-router/testing-library';

import { createTestDb } from '@/db/__tests__/testDb';
import { addAnalyticsSink, type AnalyticsEvent } from '@/services/analytics';

import { onboard, press, renderApp } from './harness';

let events: AnalyticsEvent[] = [];
let removeSink: () => void;

beforeEach(() => {
  events = [];
  removeSink = addAnalyticsSink((event) => events.push(event));
});

afterEach(() => removeSink());

describe('day-0 core loop', () => {
  it('goes from a fresh install to a first climb, check-in and altitude', async () => {
    const t = createTestDb();
    const app = await renderApp(t);

    // Fresh install: straight to onboarding, and the start button needs a name.
    expect(app.getPathname()).toBe('/onboarding');
    await press('start-first-climb');
    expect(app.getPathname()).toBe('/onboarding');

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('mountain-name'), 'Finish my thesis');
    });
    await press('target-90');
    await press('start-first-climb');

    // The climb starts immediately: no account, no extra setup.
    expect(app.getPathname()).toBe('/climb');
    expect(screen.getByTestId('climb-chunk')).toHaveTextContent('First climb');
    expect(t.repos.mountains.getActive()).toMatchObject({ targetDate: '2027-02-15' });

    // 25 minutes later, with a 5-minute pause in the middle.
    t.advance(10 * 60);
    await press('pause-resume');
    t.advance(5 * 60);
    await press('pause-resume');
    t.advance(15 * 60);
    await press('end-climb');

    expect(app.getPathname()).toMatch(/^\/checkin\//);

    // Three depth taps of 4 → D = 1.25. Then time-to-flow, then "Done".
    await press('focus-4');
    await press('challengeSkill-4');
    await press('timePassing-4');
    await press('ttf-5');
    await press('chunk-done');

    expect(app.getPathname()).toMatch(/^\/result\//);
    expect(screen.getByTestId('altitude-gained')).toHaveTextContent('+31 m'); // 25 × 1.25
    expect(screen.getByTestId('altitude-breakdown')).toHaveTextContent(
      /25 min of focus × 1.25 depth/,
    );

    await press('back-to-mountain');
    expect(app.getPathname()).toBe('/');
    expect(screen.getByTestId('mountain-title')).toHaveTextContent('Finish my thesis');
    expect(screen.getByTestId('today-altitude')).toHaveTextContent('31 m');
    expect(screen.getByTestId('total-altitude')).toHaveTextContent('31 m');

    expect(events).toEqual([
      'onboarding_completed',
      'climb_started',
      'climb_completed',
      'checkin_completed',
    ]);
  });

  it('asks for the next step once the first chunk is done, then starts a second climb', async () => {
    const t = createTestDb();
    const app = await onboard(t);
    t.advance(120);
    await press('end-climb');
    await press('focus-3');
    await press('challengeSkill-3');
    await press('timePassing-3');
    await press('chunk-done');
    await press('back-to-mountain');

    // No chunk left: the start button waits for a title.
    await press('start-climb');
    expect(app.getPathname()).toBe('/');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('next-chunk-input'), 'Write the introduction');
    });
    await press('start-climb');
    expect(app.getPathname()).toBe('/climb');
    expect(screen.getByTestId('climb-chunk')).toHaveTextContent('Write the introduction');
  });

  it('keeps the chunk as the next climb when it is not finished', async () => {
    const t = createTestDb();
    await onboard(t);
    t.advance(300);
    await press('end-climb');
    await press('focus-2');
    await press('challengeSkill-2');
    await press('timePassing-2');
    await press('chunk-not-done');
    await press('back-to-mountain');
    expect(screen.getByTestId('next-chunk')).toHaveTextContent('First climb');
  });

  it('allows skipping the check-in: minutes count with a neutral depth', async () => {
    const t = createTestDb();
    await onboard(t);
    t.advance(20 * 60);
    await press('end-climb');

    // Done / Not yet stay disabled until the three depth taps are in.
    await press('chunk-done');
    expect(screen.getByTestId('skip-checkin')).toBeOnTheScreen();

    await press('skip-checkin');
    expect(screen.getByTestId('altitude-gained')).toHaveTextContent('+20 m');
    expect(screen.getByTestId('altitude-breakdown')).toHaveTextContent(/check-in skipped/);
    expect(events).toContain('checkin_skipped');
  });

  it('discards a climb shorter than a minute and returns home', async () => {
    const t = createTestDb();
    const app = await onboard(t);
    t.advance(20);
    await press('end-climb');
    expect(app.getPathname()).toBe('/');
    expect(screen.getByTestId('total-altitude')).toHaveTextContent('0 m');
    expect(events).toContain('climb_discarded');
  });
});

describe('recovery after the app is killed', () => {
  it('reopens a running climb with the correct elapsed time', async () => {
    const t = createTestDb();
    const first = await onboard(t);
    await first.unmount();

    t.advance(12 * 60 + 5); // app killed for 12 minutes
    const app = await renderApp(t);
    expect(app.getPathname()).toBe('/climb');
    expect(screen.getByTestId('climb-clock')).toHaveTextContent('12:05');
  });

  it('returns to a check-in that was never answered', async () => {
    const t = createTestDb();
    const first = await onboard(t);
    t.advance(600);
    await press('end-climb');
    await first.unmount();

    const app = await renderApp(t);
    expect(app.getPathname()).toMatch(/^\/checkin\//);
  });

  it('sends unknown check-in and result links back home', async () => {
    const t = createTestDb();
    t.repos.mountains.create({ name: 'Book', targetDate: '2027-01-01' });
    const app = await renderApp(t, { initialUrl: '/checkin/nope' });
    expect(app.getPathname()).toBe('/');
    await app.unmount();
    const again = await renderApp(t, { initialUrl: '/result/nope' });
    expect(again.getPathname()).toBe('/');
  });
});
