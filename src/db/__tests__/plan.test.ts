import { createTestDb } from './testDb';

const TODAY = '2026-11-17';

function setup() {
  const t = createTestDb();
  const { mountain, chunk } = t.repos.mountains.create({
    name: 'Finish thesis',
    targetDate: '2027-01-31',
  });
  return { ...t, mountain, chunk };
}

type T = ReturnType<typeof setup>;

function climb(t: T, options: { ticked?: string[]; seconds?: number } = {}) {
  const session = t.repos.sessions.start({
    mountainId: t.mountain.id,
    chunkId: t.chunk.id,
    localDate: TODAY,
    tickedAddItemIds: options.ticked,
  });
  t.advance(options.seconds ?? 1800);
  t.repos.sessions.end(session.id);
  return session;
}

const taps = { focus: 4, challengeSkill: 4, timePassing: 4, timeToFlowMin: 5 } as const;

describe('routine items (Add and Subtract lists)', () => {
  it('adds items in order, per kind', () => {
    const t = setup();
    t.repos.routine.add(t.mountain.id, 'add', '  Short walk ');
    t.repos.routine.add(t.mountain.id, 'subtract', 'Social apps');
    t.repos.routine.add(t.mountain.id, 'add', 'Glass of water');

    expect(t.repos.routine.list(t.mountain.id, 'add').map((i) => i.label)).toEqual([
      'Short walk',
      'Glass of water',
    ]);
    expect(t.repos.routine.list(t.mountain.id, 'subtract').map((i) => i.label)).toEqual([
      'Social apps',
    ]);
    expect(t.repos.routine.list(t.mountain.id)).toHaveLength(3);
  });

  it('ignores blank labels and does not duplicate an existing label', () => {
    const t = setup();
    const walk = t.repos.routine.add(t.mountain.id, 'add', 'Short walk');
    expect(t.repos.routine.add(t.mountain.id, 'add', '   ')).toBeNull();
    expect(t.repos.routine.add(t.mountain.id, 'add', 'short WALK')?.id).toBe(walk?.id);
    // The same label on the other list is a different item.
    expect(t.repos.routine.add(t.mountain.id, 'subtract', 'Short walk')?.id).not.toBe(walk?.id);
    expect(t.repos.routine.list(t.mountain.id, 'add')).toHaveLength(1);
  });

  it('renames and archives items', () => {
    const t = setup();
    const walk = t.repos.routine.add(t.mountain.id, 'add', 'Walk')!;
    const water = t.repos.routine.add(t.mountain.id, 'add', 'Water')!;
    t.repos.routine.rename(walk.id, ' Ten-minute walk ');
    t.repos.routine.rename(water.id, '   '); // ignored
    t.repos.routine.archive(water.id);
    expect(t.repos.routine.list(t.mountain.id, 'add').map((i) => i.label)).toEqual([
      'Ten-minute walk',
    ]);
  });
});

describe('adherence', () => {
  it('records every Add item at the start of a climb: ticked or not', () => {
    const t = setup();
    const walk = t.repos.routine.add(t.mountain.id, 'add', 'Walk')!;
    const water = t.repos.routine.add(t.mountain.id, 'add', 'Water')!;
    climb(t, { ticked: [walk.id] });

    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([
      { localDate: TODAY, itemId: walk.id, kind: 'add', honoured: true },
      { localDate: TODAY, itemId: water.id, kind: 'add', honoured: false },
    ]);
  });

  it('records nothing when there are no lists yet', () => {
    const t = setup();
    const session = climb(t);
    t.repos.checkins.save(session.id, { ...taps, chunkDone: false });
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([]);
  });

  it('records the Subtract self-report at check-in', () => {
    const t = setup();
    const social = t.repos.routine.add(t.mountain.id, 'subtract', 'Social apps')!;
    const news = t.repos.routine.add(t.mountain.id, 'subtract', 'News sites')!;
    const session = climb(t);
    t.repos.checkins.save(session.id, {
      ...taps,
      chunkDone: false,
      slippedSubtractItemIds: [news.id],
    });

    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([
      { localDate: TODAY, itemId: social.id, kind: 'subtract', honoured: true },
      { localDate: TODAY, itemId: news.id, kind: 'subtract', honoured: false },
    ]);
  });

  it('records no Subtract answer when the check-in is skipped, and replaces it on a later save', () => {
    const t = setup();
    const social = t.repos.routine.add(t.mountain.id, 'subtract', 'Social apps')!;
    const session = climb(t);
    t.repos.checkins.skip(session.id);
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([]);

    t.repos.checkins.save(session.id, { ...taps, chunkDone: false });
    t.repos.checkins.save(session.id, {
      ...taps,
      chunkDone: false,
      slippedSubtractItemIds: [social.id],
    });
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([
      { localDate: TODAY, itemId: social.id, kind: 'subtract', honoured: false },
    ]);
  });

  it('leaves archived items off new climbs but keeps their history', () => {
    const t = setup();
    const walk = t.repos.routine.add(t.mountain.id, 'add', 'Walk')!;
    climb(t, { ticked: [walk.id] });
    t.repos.routine.archive(walk.id);
    climb(t);
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toHaveLength(1);
  });

  it('counts only finished climbs, and discarding a climb removes its checklist', () => {
    const t = setup();
    const walk = t.repos.routine.add(t.mountain.id, 'add', 'Walk')!;
    const running = t.repos.sessions.start({
      mountainId: t.mountain.id,
      chunkId: t.chunk.id,
      localDate: TODAY,
      tickedAddItemIds: [walk.id],
    });
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([]);

    t.advance(600);
    t.repos.sessions.discard(running.id);
    expect(t.repos.sessions.get(running.id)).toBeUndefined();

    // A too-short climb with a checklist is also removed cleanly when it ends.
    const short = t.repos.sessions.start({
      mountainId: t.mountain.id,
      chunkId: t.chunk.id,
      localDate: TODAY,
      tickedAddItemIds: [walk.id],
    });
    t.advance(10);
    expect(t.repos.sessions.end(short.id)).toEqual({ discarded: true });
    expect(t.repos.stats.domainAdherence(t.mountain.id)).toEqual([]);
  });

  it('never discards a finished climb', () => {
    const t = setup();
    const session = climb(t);
    t.repos.sessions.discard(session.id);
    t.repos.sessions.discard('nope');
    expect(t.repos.sessions.get(session.id)).toBeDefined();
  });
});

describe('route editing (Divide)', () => {
  function titles(t: T) {
    const campNames = new Map(t.repos.camps.list(t.mountain.id).map((c) => [c.id, c.name]));
    return t.repos.chunks.list(t.mountain.id).map((c) => `${campNames.get(c.campId)}: ${c.title}`);
  }

  it('adds chunks with estimates, to a chosen camp or the last one', () => {
    const t = setup();
    const camp2 = t.repos.camps.add(t.mountain.id, ' Camp 2 ');
    const base = t.repos.camps.list(t.mountain.id)[0]!;
    t.repos.chunks.add(t.mountain.id, 'Outline', { campId: base.id, estimateMin: 45 });
    const draft = t.repos.chunks.add(t.mountain.id, 'Draft');

    expect(titles(t)).toEqual(['Base camp: First climb', 'Base camp: Outline', 'Camp 2: Draft']);
    expect(draft.campId).toBe(camp2.id);
    expect(t.repos.chunks.list(t.mountain.id)[1]).toMatchObject({ estimateMin: 45, position: 1 });
    expect(() => t.repos.chunks.add(t.mountain.id, 'x', { campId: 'nope' })).toThrow('no camp');
  });

  it('edits the title and estimate, ignoring a blank title', () => {
    const t = setup();
    t.repos.chunks.update(t.chunk.id, { title: ' Read sources ', estimateMin: 60 });
    expect(t.repos.chunks.get(t.chunk.id)).toMatchObject({
      title: 'Read sources',
      estimateMin: 60,
    });
    t.repos.chunks.update(t.chunk.id, { title: '  ', estimateMin: null });
    expect(t.repos.chunks.get(t.chunk.id)).toMatchObject({
      title: 'Read sources',
      estimateMin: null,
    });
    t.repos.chunks.update(t.chunk.id, {});
    expect(t.repos.chunks.get(t.chunk.id)?.title).toBe('Read sources');
  });

  it('moves chunks within a camp and across camp edges', () => {
    const t = setup();
    t.repos.camps.add(t.mountain.id, 'Camp 2');
    const base = t.repos.camps.list(t.mountain.id)[0]!;
    const b = t.repos.chunks.add(t.mountain.id, 'B', { campId: base.id });
    const c = t.repos.chunks.add(t.mountain.id, 'C');
    expect(titles(t)).toEqual(['Base camp: First climb', 'Base camp: B', 'Camp 2: C']);

    t.repos.chunks.move(b.id, 'up');
    expect(titles(t)).toEqual(['Base camp: B', 'Base camp: First climb', 'Camp 2: C']);

    t.repos.chunks.move(b.id, 'down');
    t.repos.chunks.move(b.id, 'down'); // last in Base camp → first in Camp 2
    expect(titles(t)).toEqual(['Base camp: First climb', 'Camp 2: B', 'Camp 2: C']);

    t.repos.chunks.move(c.id, 'up');
    t.repos.chunks.move(c.id, 'up'); // first in Camp 2 → last in Base camp
    expect(titles(t)).toEqual(['Base camp: First climb', 'Base camp: C', 'Camp 2: B']);

    // Already at the very top or bottom of the route: nothing happens.
    t.repos.chunks.move(t.chunk.id, 'up');
    t.repos.chunks.move(b.id, 'down');
    t.repos.chunks.move('nope', 'up');
    expect(titles(t)).toEqual(['Base camp: First climb', 'Base camp: C', 'Camp 2: B']);
    expect(t.repos.chunks.list(t.mountain.id).map((x) => x.position)).toEqual([0, 1, 0]);
  });

  it('removes unfinished chunks only, and never the one being climbed', () => {
    const t = setup();
    const extra = t.repos.chunks.add(t.mountain.id, 'Extra');
    const last = t.repos.chunks.add(t.mountain.id, 'Last');

    const running = t.repos.sessions.start({
      mountainId: t.mountain.id,
      chunkId: extra.id,
      localDate: TODAY,
    });
    expect(t.repos.chunks.remove(extra.id)).toBe(false);
    t.advance(600);
    t.repos.sessions.end(running.id);
    t.repos.checkins.save(running.id, { ...taps, chunkDone: false });

    // Worked on but not finished: it can go, and its climb keeps counting.
    expect(t.repos.chunks.remove(extra.id)).toBe(true);
    expect(t.repos.chunks.remove(extra.id)).toBe(false);
    expect(titles(t)).toEqual(['Base camp: First climb', 'Base camp: Last']);
    expect(t.repos.chunks.get(last.id)?.position).toBe(1);
    expect(t.repos.stats.domainSessions(t.mountain.id)).toHaveLength(1);
    t.repos.chunks.move(extra.id, 'up'); // removed chunks do not move

    const session = climb(t);
    t.repos.checkins.save(session.id, { ...taps, chunkDone: true });
    expect(t.repos.chunks.remove(t.chunk.id)).toBe(false); // finished
    expect(t.repos.chunks.remove('nope')).toBe(false);
  });

  it('renames camps and removes only empty, non-last camps', () => {
    const t = setup();
    const base = t.repos.camps.list(t.mountain.id)[0]!;
    expect(t.repos.camps.remove(base.id)).toBe(false); // the only camp

    const camp2 = t.repos.camps.add(t.mountain.id, 'Camp 2');
    t.repos.camps.rename(camp2.id, ' Halfway ');
    t.repos.camps.rename(camp2.id, '  ');
    expect(t.repos.camps.list(t.mountain.id).map((c) => c.name)).toEqual(['Base camp', 'Halfway']);

    expect(t.repos.camps.remove(base.id)).toBe(false); // has a chunk
    expect(t.repos.camps.remove(camp2.id)).toBe(true);
    expect(t.repos.camps.remove(camp2.id)).toBe(false);
    expect(t.repos.camps.remove('nope')).toBe(false);
    expect(t.repos.camps.list(t.mountain.id)).toHaveLength(1);
  });

  it('totals focus time per chunk for planned-versus-actual', () => {
    const t = setup();
    climb(t, { seconds: 600 });
    climb(t, { seconds: 900 });
    expect(t.repos.stats.focusSecondsByChunk(t.mountain.id)).toEqual(new Map([[t.chunk.id, 1500]]));
  });
});

describe('mountain details and device settings', () => {
  it('renames the mountain and moves the summit date', () => {
    const t = setup();
    t.repos.mountains.update(t.mountain.id, { name: ' Thesis v2 ', targetDate: '2027-03-01' });
    expect(t.repos.mountains.getActive()).toMatchObject({
      name: 'Thesis v2',
      targetDate: '2027-03-01',
    });
    t.repos.mountains.update(t.mountain.id, { name: '   ' });
    expect(t.repos.mountains.getActive()?.name).toBe('Thesis v2');
  });

  it('stores, replaces and removes device settings', () => {
    const t = setup();
    expect(t.repos.settings.get('reminder.time')).toBeNull();
    t.repos.settings.set('reminder.time', '09:00');
    t.repos.settings.set('reminder.time', '20:30');
    expect(t.repos.settings.get('reminder.time')).toBe('20:30');
    t.repos.settings.remove('reminder.time');
    expect(t.repos.settings.get('reminder.time')).toBeNull();
  });
});
