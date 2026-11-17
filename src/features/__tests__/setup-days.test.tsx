import { screen } from 'expo-router/testing-library';

import { createTestDb } from '@/db/__tests__/testDb';

import { finishClimb, nextDay, onboard, press, pressLabel, type } from './harness';

/**
 * Phase 3 exit test: a user runs the whole loop over several simulated days, and
 * Add, Subtract and Divide are introduced one day at a time.
 */
describe('the first four days', () => {
  it('introduces Add, Subtract and Divide one per day and scores the routine', async () => {
    const t = createTestDb();
    const app = await onboard(t);

    // ---- Day 1: only the mountain and a first climb. No setup prompts.
    await finishClimb(t, 25, { tap: 4 }); // 25 min × 1.25 depth = 31.25
    await press('back-to-mountain');
    expect(screen.queryByTestId('setup-prompt-add')).toBeNull();

    // ---- Day 2: Add is offered.
    await nextDay(t);
    expect(screen.getByTestId('setup-prompt-add')).toBeOnTheScreen();
    await press('setup-prompt-open');
    expect(app.getPathname()).toBe('/plan');

    await type('add-new-input', 'Short walk');
    await press('add-new-save');
    await pressLabel('Add Glass of water'); // a suggestion chip
    expect(t.repos.routine.list(t.repos.mountains.getActive()!.id, 'add')).toHaveLength(2);

    await press('tab-mountain');
    expect(screen.queryByTestId('setup-prompt-add')).toBeNull();
    expect(screen.queryByTestId('setup-prompt-subtract')).toBeNull(); // not before day 3

    // The first chunk is done, so the next step needs a name; then the checklist appears.
    await type('next-chunk-input', 'Write the introduction');
    await press('start-climb');
    expect(app.getPathname()).toBe('/preclimb');
    expect(screen.getByTestId('preclimb-chunk')).toHaveTextContent('Write the introduction');
    await pressLabel('Short walk');
    await pressLabel('Glass of water');
    await press('preclimb-start');
    expect(app.getPathname()).toBe('/climb');

    await finishClimb(t, 20, { tap: 3, done: false });
    // Both Add items ticked → routine multiplier 1.20. 20 min × 1.00 × 1.20 = 24.
    expect(screen.getByTestId('altitude-gained')).toHaveTextContent('+24 m');
    expect(screen.getByTestId('altitude-breakdown')).toHaveTextContent(
      /20 min of focus × 1.00 depth × 1.20 routine/,
    );
    await press('back-to-mountain');
    expect(app.getPathname()).toBe('/');

    // ---- Day 3: Subtract is offered. "Not now" hides it; the Plan tab still has it.
    await nextDay(t);
    expect(screen.getByTestId('setup-prompt-subtract')).toBeOnTheScreen();
    await press('setup-prompt-dismiss');
    expect(screen.queryByTestId('setup-prompt-subtract')).toBeNull();
    expect(screen.queryByTestId('setup-prompt-divide')).toBeNull(); // not before day 4

    await press('tab-plan');
    await press('plan-section-subtract');
    await pressLabel('Add Social apps');
    await press('tab-mountain');

    // Start without ticking anything, then admit to a distraction at check-in.
    expect(screen.getByTestId('next-chunk')).toHaveTextContent('Write the introduction');
    await press('start-climb');
    await press('preclimb-start');
    t.advance(30 * 60);
    await press('end-climb');
    await press('focus-5');
    await press('challengeSkill-5');
    await press('timePassing-5');
    await pressLabel('Social apps pulled me away');
    await press('chunk-done');
    // Add 0 of 2 and Subtract 0 of 1 → routine 0.80. 30 min × 1.50 × 0.80 = 36.
    expect(screen.getByTestId('altitude-gained')).toHaveTextContent('+36 m');
    expect(screen.getByTestId('altitude-breakdown')).toHaveTextContent(
      /× 1.50 depth × 0.80 routine/,
    );
    await press('back-to-mountain');

    // ---- Day 4: Divide is offered and opens the route editor.
    await nextDay(t);
    expect(screen.getByTestId('setup-prompt-divide')).toBeOnTheScreen();
    await press('setup-prompt-open');
    expect(app.getPathname()).toBe('/plan');

    await pressLabel('Add a chunk to Base camp');
    await type('chunk-new-title', 'Draft chapter 1');
    await pressLabel('Estimate 45 min');
    await press('chunk-new-save');
    expect(screen.getByText('45 min planned')).toBeOnTheScreen();
    // Finished chunks show how long they really took.
    expect(screen.getByText('Took 25 min')).toBeOnTheScreen();

    await press('camp-add');
    await type('camp-new-input', 'First draft');
    await press('camp-new-save');
    await pressLabel('Move Draft chapter 1 down'); // last in Base camp → into the new camp

    const mountainId = t.repos.mountains.getActive()!.id;
    const camps = t.repos.camps.list(mountainId);
    const draft = t.repos.chunks.list(mountainId).find((c) => c.title === 'Draft chapter 1');
    expect(camps.map((camp) => camp.name)).toEqual(['Base camp', 'First draft']);
    expect(draft).toMatchObject({ campId: camps[1]?.id, estimateMin: 45 });

    // Back home: every setup step is handled, and all three days count.
    await press('tab-mountain');
    expect(screen.queryByTestId('setup-prompt-divide')).toBeNull();
    expect(screen.getByTestId('next-chunk')).toHaveTextContent('Draft chapter 1');
    expect(screen.getByTestId('total-altitude')).toHaveTextContent('91 m'); // 31.25 + 24 + 36
    expect(screen.getByTestId('today-altitude')).toHaveTextContent('0 m');
  });

  it('edits and removes route and routine items from the Plan tab', async () => {
    const t = createTestDb();
    await onboard(t);
    await finishClimb(t, 10, { done: false });
    await press('back-to-mountain');
    await press('tab-plan');

    // Rename the chunk and give it an estimate; it shows planned and spent time.
    await pressLabel('Edit First climb');
    await type('chunk-edit-title', 'Read the sources');
    await pressLabel('Estimate 1 h');
    await press('chunk-edit-save');
    expect(screen.getByText('Read the sources')).toBeOnTheScreen();
    expect(screen.getByText('1 h planned · 10 min so far')).toBeOnTheScreen();

    // Add a chunk, then remove it again.
    await pressLabel('Add a chunk to Base camp');
    await type('chunk-new-title', 'Throwaway');
    await press('chunk-new-save');
    await pressLabel('Edit Throwaway');
    await press('chunk-edit-remove');
    expect(screen.queryByText('Throwaway')).toBeNull();

    // Rename the camp; add a second camp, then remove it while it is still empty.
    await pressLabel('Rename Base camp');
    await type('camp-edit-input', 'Research');
    await press('camp-edit-save');
    expect(screen.getByText('Research')).toBeOnTheScreen();
    await press('camp-add');
    await type('camp-new-input', 'Writing');
    await press('camp-new-save');
    await pressLabel('Rename Writing');
    await press('camp-remove');
    expect(screen.queryByText('Writing')).toBeNull();

    // Add list: add, rename, remove.
    await press('plan-section-add');
    await type('add-new-input', 'Tea');
    await press('add-new-save');
    await pressLabel('Rename Tea');
    await type('add-edit-input', 'Green tea');
    await press('add-edit-save');
    expect(screen.getByText('Green tea')).toBeOnTheScreen();
    await pressLabel('Remove Green tea');
    expect(screen.queryByText('Green tea')).toBeNull();
    expect(t.repos.routine.list(t.repos.mountains.getActive()!.id)).toEqual([]);
  });

  it('keeps the avatar in place after missed days until a camp has been reached', async () => {
    const t = createTestDb();
    await onboard(t);
    await finishClimb(t, 10, { done: false });
    await press('back-to-mountain');
    expect(screen.queryByTestId('missed-day-note')).toBeNull();

    await nextDay(t);
    await nextDay(t);
    await nextDay(t);
    expect(screen.getByTestId('missed-day-note')).toHaveTextContent(
      'Welcome back. Everything you climbed is still yours.',
    );
  });
});
