import { MAX_SESSION_SECONDS } from '@/domain';

import { DEFAULT_FIRST_CHUNK_TITLE } from '../repositories';
import { createTestDb } from './testDb';

const TODAY = '2026-11-17';

function setup() {
  const t = createTestDb();
  const { mountain, chunk } = t.repos.mountains.create({
    name: '  Finish thesis ',
    targetDate: '2027-01-31',
  });
  return { ...t, mountain, chunk };
}

function startClimb(t: ReturnType<typeof setup>) {
  return t.repos.sessions.start({
    mountainId: t.mountain.id,
    chunkId: t.chunk.id,
    localDate: TODAY,
  });
}

describe('mountains', () => {
  it('has no active mountain on a fresh install', () => {
    expect(createTestDb().repos.mountains.getActive()).toBeUndefined();
  });

  it('creates a mountain with a camp and a first chunk, ready to climb', () => {
    const t = setup();
    expect(t.repos.mountains.getActive()).toMatchObject({
      name: 'Finish thesis',
      targetDate: '2027-01-31',
      status: 'active',
    });
    expect(t.chunk.title).toBe(DEFAULT_FIRST_CHUNK_TITLE);
    expect(t.repos.chunks.next(t.mountain.id)?.id).toBe(t.chunk.id);
  });

  it('uses a custom first chunk title when given', () => {
    const t = createTestDb();
    const { chunk } = t.repos.mountains.create({
      name: 'Book',
      targetDate: '2027-01-31',
      firstChunkTitle: 'Outline chapter 1',
    });
    expect(chunk.title).toBe('Outline chapter 1');
  });
});

describe('chunks', () => {
  it('adds chunks to the end of the route', () => {
    const t = setup();
    const second = t.repos.chunks.add(t.mountain.id, 'Write intro');
    const third = t.repos.chunks.add(t.mountain.id, 'Edit intro');
    expect(t.repos.chunks.list(t.mountain.id).map((c) => c.id)).toEqual([
      t.chunk.id,
      second.id,
      third.id,
    ]);
    expect(t.repos.chunks.get(second.id)?.title).toBe('Write intro');
  });

  it('refuses to add a chunk to an unknown mountain', () => {
    expect(() => setup().repos.chunks.add('nope', 'x')).toThrow('has no camp');
  });
});

describe('sessions', () => {
  it('measures flow time from timestamps and subtracts pauses', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(600);
    t.repos.sessions.pause(session.id);
    t.advance(120);
    t.repos.sessions.resume(session.id);
    t.advance(300);

    const result = t.repos.sessions.end(session.id);
    expect(result).toMatchObject({
      discarded: false,
      session: { flowSeconds: 900, pauseCount: 1, exitCount: 0, localDate: TODAY },
    });
    expect(t.repos.sessions.getActive()).toBeUndefined();
  });

  it('counts app exits as interruptions without subtracting their time', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(100);
    t.repos.sessions.markExit(session.id);
    t.advance(200);
    t.repos.sessions.markReturn(session.id);
    t.advance(100);
    const result = t.repos.sessions.end(session.id);
    expect(result).toMatchObject({ session: { flowSeconds: 400, exitCount: 1 } });
  });

  it('survives an app kill: the active climb and its timer are read back from the database', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(1800); // app killed for 30 minutes
    const active = t.repos.sessions.getActive();
    expect(active?.id).toBe(session.id);
    expect(t.repos.sessions.timer(session.id)).toMatchObject({
      startedAt: session.startedAt,
      endedAt: null,
      events: [],
    });
  });

  it('returns the running climb instead of starting a second one', () => {
    const t = setup();
    const first = startClimb(t);
    expect(startClimb(t).id).toBe(first.id);
  });

  it('ignores pause and exit while already paused, and a stray resume', () => {
    const t = setup();
    const session = startClimb(t);
    t.repos.sessions.resume(session.id); // nothing to resume
    t.advance(120);
    t.repos.sessions.pause(session.id);
    t.repos.sessions.pause(session.id);
    t.repos.sessions.markExit(session.id); // paused: not an exit
    t.repos.sessions.markReturn(session.id); // must not close the pause
    t.advance(60);
    const result = t.repos.sessions.end(session.id); // ending closes the open pause
    expect(result).toMatchObject({ session: { flowSeconds: 120, pauseCount: 1, exitCount: 0 } });
  });

  it('discards a climb shorter than a minute', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(30);
    expect(t.repos.sessions.end(session.id)).toEqual({ discarded: true });
    expect(t.repos.sessions.get(session.id)).toBeUndefined();
    expect(t.repos.stats.domainSessions(t.mountain.id)).toEqual([]);
  });

  it('caps a forgotten timer at the maximum session length', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(20 * 3600);
    expect(t.repos.sessions.end(session.id)).toMatchObject({
      session: { flowSeconds: MAX_SESSION_SECONDS },
    });
  });

  it('handles unknown sessions safely', () => {
    const t = setup();
    expect(t.repos.sessions.end('nope')).toEqual({ discarded: true });
    expect(t.repos.sessions.timer('nope')).toBeNull();
    t.repos.sessions.pause('nope');
    expect(() => t.repos.checkins.skip('nope')).toThrow('not found');
  });

  it('does not add events to a finished climb', () => {
    const t = setup();
    const session = startClimb(t);
    t.advance(90);
    t.repos.sessions.end(session.id);
    t.repos.sessions.pause(session.id);
    expect(t.repos.sessions.timer(session.id)?.events).toEqual([]);
  });
});

describe('check-ins', () => {
  function finishedClimb(t: ReturnType<typeof setup>, seconds = 1800) {
    const session = startClimb(t);
    t.advance(seconds);
    t.repos.sessions.end(session.id);
    return session;
  }

  it('saves the taps, marks the chunk done and feeds the domain layer', () => {
    const t = setup();
    const session = finishedClimb(t);
    t.repos.checkins.save(session.id, {
      focus: 5,
      challengeSkill: 4,
      timePassing: 3,
      timeToFlowMin: 10,
      chunkDone: true,
    });

    expect(t.repos.chunks.get(t.chunk.id)?.doneAt).not.toBeNull();
    expect(t.repos.chunks.next(t.mountain.id)).toBeUndefined();
    expect(t.repos.stats.domainSessions(t.mountain.id)).toEqual([
      {
        id: session.id,
        localDate: TODAY,
        flowSeconds: 1800,
        pauseCount: 0,
        exitCount: 0,
        checkin: {
          skipped: false,
          focus: 5,
          challengeSkill: 4,
          timePassing: 3,
          timeToFlowMin: 10,
          chunkDone: true,
        },
      },
    ]);
  });

  it('keeps the chunk open when it is not done, and allows a skip', () => {
    const t = setup();
    const session = finishedClimb(t);
    t.repos.checkins.skip(session.id);
    expect(t.repos.chunks.get(t.chunk.id)?.doneAt).toBeNull();
    expect(t.repos.stats.domainSessions(t.mountain.id)[0]?.checkin).toMatchObject({
      skipped: true,
      focus: null,
    });
  });

  it('replaces an earlier check-in for the same session instead of duplicating it', () => {
    const t = setup();
    const session = finishedClimb(t);
    t.repos.checkins.skip(session.id);
    t.repos.checkins.save(session.id, {
      focus: 2,
      challengeSkill: 2,
      timePassing: 2,
      timeToFlowMin: null,
      chunkDone: false,
    });
    const rows = t.repos.stats.domainSessions(t.mountain.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.checkin).toMatchObject({ skipped: false, focus: 2 });
  });

  it('reports a finished climb with no check-in yet as checkin: null', () => {
    const t = setup();
    finishedClimb(t);
    expect(t.repos.stats.domainSessions(t.mountain.id)[0]?.checkin).toBeNull();
  });
});
