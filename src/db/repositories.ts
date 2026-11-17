import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  countEvents,
  flowSecondsAt,
  isTooShort,
  type AdherenceRecord,
  type DepthTap,
  type LocalDate,
  type RoutineKind,
  type Session,
  type TimerState,
} from '@/domain';

import {
  camps,
  checkins,
  chunks,
  dayAdherence,
  deviceSettings,
  mountains,
  routineItems,
  sessionEvents,
  sessions,
  type CampRow,
  type ChunkRow,
  type MountainRow,
  type RoutineItemRow,
  type schema,
  type SessionRow,
} from './schema';

/**
 * Any synchronous Drizzle SQLite database: expo-sqlite in the app, better-sqlite3 in tests.
 * `any` is the driver's run-result type, which differs per driver and is never used here.
 */
export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>;

export interface RepoDeps {
  newId: () => string;
  /** Epoch milliseconds. */
  now: () => number;
}

export interface CheckinInput {
  focus: DepthTap;
  challengeSkill: DepthTap;
  timePassing: DepthTap;
  timeToFlowMin: number | null;
  chunkDone: boolean;
  /** Subtract items the user says pulled them away. Every other Subtract item counts as honoured. */
  slippedSubtractItemIds?: readonly string[];
}

export interface StartInput {
  mountainId: string;
  chunkId: string;
  localDate: LocalDate;
  /** Add items ticked on the pre-climb checklist. Every other Add item counts as not done. */
  tickedAddItemIds?: readonly string[];
}

export type EndResult = { discarded: true } | { discarded: false; session: SessionRow };
export type MoveDirection = 'up' | 'down';
type AdherenceSource = 'checklist' | 'self_report' | 'blocker';

export const DEFAULT_CAMP_NAME = 'Base camp';
export const DEFAULT_FIRST_CHUNK_TITLE = 'First climb';

/** All reads and writes go through here (AGENTS.md). UI code never touches SQL. */
export function createRepositories(db: Db, deps: RepoDeps) {
  const stamps = () => {
    const now = deps.now();
    return { id: deps.newId(), createdAt: now, updatedAt: now };
  };

  // ---------------------------------------------------------------- timer events

  function timerState(sessionId: string): TimerState | null {
    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    if (!session) return null;
    const events = db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(asc(sessionEvents.startedAt))
      .all();
    return { startedAt: session.startedAt, endedAt: session.endedAt, events };
  }

  function openEvent(sessionId: string) {
    return db
      .select()
      .from(sessionEvents)
      .where(and(eq(sessionEvents.sessionId, sessionId), isNull(sessionEvents.endedAt)))
      .get();
  }

  function closeOpenEvent(sessionId: string, kind?: 'pause' | 'exit') {
    const open = openEvent(sessionId);
    if (!open || (kind && open.kind !== kind)) return;
    db.update(sessionEvents)
      .set({ endedAt: deps.now() })
      .where(eq(sessionEvents.id, open.id))
      .run();
  }

  function addEvent(sessionId: string, kind: 'pause' | 'exit') {
    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    // Only a running climb can be paused or exited.
    if (!session || session.endedAt !== null || openEvent(sessionId)) return;
    db.insert(sessionEvents)
      .values({ id: deps.newId(), sessionId, kind, startedAt: deps.now(), endedAt: null })
      .run();
  }

  // ------------------------------------------------------------------- adherence

  /** One record per routine item per climb; writing again replaces the earlier answer. */
  function writeAdherence(
    session: Pick<SessionRow, 'id' | 'localDate'>,
    routineItemId: string,
    honoured: boolean,
    source: AdherenceSource,
  ) {
    db.insert(dayAdherence)
      .values({
        ...stamps(),
        sessionId: session.id,
        routineItemId,
        localDate: session.localDate,
        honoured,
        source,
      })
      .onConflictDoUpdate({
        target: [dayAdherence.sessionId, dayAdherence.routineItemId],
        set: { honoured, source, updatedAt: deps.now() },
      })
      .run();
  }

  // ------------------------------------------------------------------- mountains

  const mountainsRepo = {
    getActive(): MountainRow | undefined {
      return db
        .select()
        .from(mountains)
        .where(and(eq(mountains.status, 'active'), isNull(mountains.deletedAt)))
        .orderBy(desc(mountains.createdAt))
        .get();
    },

    /** Creates the mountain with one camp and one chunk, so the first climb can start at once. */
    create(input: { name: string; targetDate: LocalDate; firstChunkTitle?: string }): {
      mountain: MountainRow;
      chunk: ChunkRow;
    } {
      return db.transaction((tx) => {
        const mountain = tx
          .insert(mountains)
          .values({ ...stamps(), name: input.name.trim(), targetDate: input.targetDate })
          .returning()
          .get();
        const camp = tx
          .insert(camps)
          .values({ ...stamps(), mountainId: mountain.id, name: DEFAULT_CAMP_NAME, position: 0 })
          .returning()
          .get();
        const chunk = tx
          .insert(chunks)
          .values({
            ...stamps(),
            mountainId: mountain.id,
            campId: camp.id,
            title: input.firstChunkTitle?.trim() || DEFAULT_FIRST_CHUNK_TITLE,
            position: 0,
          })
          .returning()
          .get();
        return { mountain, chunk };
      });
    },

    /** Renames the mountain or moves its summit date. Blank names are ignored. */
    update(mountainId: string, changes: { name?: string; targetDate?: LocalDate }) {
      const name = changes.name?.trim();
      db.update(mountains)
        .set({
          ...(name ? { name } : {}),
          ...(changes.targetDate ? { targetDate: changes.targetDate } : {}),
          updatedAt: deps.now(),
        })
        .where(eq(mountains.id, mountainId))
        .run();
    },
  };

  // ----------------------------------------------------------------------- camps

  const campsRepo = {
    /** Camps in route order. */
    list(mountainId: string): CampRow[] {
      return db
        .select()
        .from(camps)
        .where(and(eq(camps.mountainId, mountainId), isNull(camps.deletedAt)))
        .orderBy(asc(camps.position))
        .all();
    },

    /** Adds a camp above the current last one. */
    add(mountainId: string, name: string): CampRow {
      const last = campsRepo.list(mountainId).at(-1);
      return db
        .insert(camps)
        .values({
          ...stamps(),
          mountainId,
          name: name.trim(),
          position: (last?.position ?? -1) + 1,
        })
        .returning()
        .get();
    },

    rename(campId: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) return;
      db.update(camps)
        .set({ name: trimmed, updatedAt: deps.now() })
        .where(eq(camps.id, campId))
        .run();
    },

    /** Removes an empty camp. The last remaining camp and camps with chunks stay. */
    remove(campId: string): boolean {
      const camp = db.select().from(camps).where(eq(camps.id, campId)).get();
      if (!camp || camp.deletedAt !== null) return false;
      const hasChunks = chunkIdsInCamp(campId).length > 0;
      if (hasChunks || campsRepo.list(camp.mountainId).length <= 1) return false;
      const now = deps.now();
      db.update(camps).set({ deletedAt: now, updatedAt: now }).where(eq(camps.id, campId)).run();
      return true;
    },
  };

  // ---------------------------------------------------------------------- chunks

  function chunkIdsInCamp(campId: string): string[] {
    return db
      .select({ id: chunks.id })
      .from(chunks)
      .where(and(eq(chunks.campId, campId), isNull(chunks.deletedAt)))
      .orderBy(asc(chunks.position))
      .all()
      .map((row) => row.id);
  }

  /** Puts these chunks into the camp in exactly this order. */
  function placeChunks(campId: string, orderedIds: readonly string[]) {
    const now = deps.now();
    orderedIds.forEach((id, position) => {
      db.update(chunks).set({ campId, position, updatedAt: now }).where(eq(chunks.id, id)).run();
    });
  }

  const chunksRepo = {
    /** Chunks in route order, each with the position of its camp. */
    list(mountainId: string): (ChunkRow & { campPosition: number })[] {
      return db
        .select({ chunk: chunks, campPosition: camps.position })
        .from(chunks)
        .innerJoin(camps, eq(chunks.campId, camps.id))
        .where(and(eq(chunks.mountainId, mountainId), isNull(chunks.deletedAt)))
        .orderBy(asc(camps.position), asc(chunks.position))
        .all()
        .map((row) => ({ ...row.chunk, campPosition: row.campPosition }));
    },

    get(chunkId: string): ChunkRow | undefined {
      return db.select().from(chunks).where(eq(chunks.id, chunkId)).get();
    },

    /** The first chunk on the route that is not done yet. */
    next(mountainId: string): ChunkRow | undefined {
      return chunksRepo.list(mountainId).find((chunk) => chunk.doneAt === null);
    },

    /** Adds a chunk to the end of a camp (the last camp unless one is given). */
    add(
      mountainId: string,
      title: string,
      options: { campId?: string; estimateMin?: number | null } = {},
    ): ChunkRow {
      const campList = campsRepo.list(mountainId);
      const camp = options.campId
        ? campList.find((candidate) => candidate.id === options.campId)
        : campList.at(-1);
      if (!camp) throw new Error(`Mountain ${mountainId} has no camp`);
      return db
        .insert(chunks)
        .values({
          ...stamps(),
          mountainId,
          campId: camp.id,
          title: title.trim(),
          estimateMin: options.estimateMin ?? null,
          position: chunkIdsInCamp(camp.id).length,
        })
        .returning()
        .get();
    },

    /** Changes the title or the time estimate. A blank title is ignored. */
    update(chunkId: string, changes: { title?: string; estimateMin?: number | null }) {
      const title = changes.title?.trim();
      db.update(chunks)
        .set({
          ...(title ? { title } : {}),
          ...(changes.estimateMin !== undefined ? { estimateMin: changes.estimateMin } : {}),
          updatedAt: deps.now(),
        })
        .where(eq(chunks.id, chunkId))
        .run();
    },

    /**
     * Takes a chunk off the route. Finished chunks and the chunk being climbed right
     * now stay. Past climbs on a removed chunk keep their altitude.
     */
    remove(chunkId: string): boolean {
      const chunk = chunksRepo.get(chunkId);
      if (!chunk || chunk.deletedAt !== null || chunk.doneAt !== null) return false;
      if (sessionsRepo.getActive()?.chunkId === chunkId) return false;
      const now = deps.now();
      db.transaction(() => {
        db.update(chunks)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(chunks.id, chunkId))
          .run();
        placeChunks(chunk.campId, chunkIdsInCamp(chunk.campId));
      });
      return true;
    },

    /**
     * Moves a chunk one step along the route. At the edge of its camp it crosses into
     * the neighbouring camp (the end of the one below, the start of the one above).
     */
    move(chunkId: string, direction: MoveDirection) {
      const chunk = chunksRepo.get(chunkId);
      if (!chunk || chunk.deletedAt !== null) return;
      const ids = chunkIdsInCamp(chunk.campId);
      const index = ids.indexOf(chunkId);
      const target = direction === 'up' ? index - 1 : index + 1;
      const neighbour = ids[target];

      db.transaction(() => {
        if (neighbour !== undefined) {
          ids[target] = chunkId;
          ids[index] = neighbour;
          placeChunks(chunk.campId, ids);
          return;
        }
        const campList = campsRepo.list(chunk.mountainId);
        const campIndex = campList.findIndex((camp) => camp.id === chunk.campId);
        const otherCamp = campList[campIndex + (direction === 'up' ? -1 : 1)];
        if (!otherCamp) return;
        const otherIds = chunkIdsInCamp(otherCamp.id);
        placeChunks(
          chunk.campId,
          ids.filter((id) => id !== chunkId),
        );
        placeChunks(
          otherCamp.id,
          direction === 'up' ? [...otherIds, chunkId] : [chunkId, ...otherIds],
        );
      });
    },
  };

  // --------------------------------------------------------------------- routine

  const routineRepo = {
    /** Active Add and Subtract items in list order (archived ones are left out). */
    list(mountainId: string, kind?: RoutineKind): RoutineItemRow[] {
      return db
        .select()
        .from(routineItems)
        .where(
          and(
            eq(routineItems.mountainId, mountainId),
            isNull(routineItems.archivedAt),
            isNull(routineItems.deletedAt),
            kind ? eq(routineItems.kind, kind) : undefined,
          ),
        )
        .orderBy(asc(routineItems.kind), asc(routineItems.position))
        .all();
    },

    /** Adds an item. Blank labels are ignored; a label already on the list is returned as is. */
    add(mountainId: string, kind: RoutineKind, label: string): RoutineItemRow | null {
      const trimmed = label.trim();
      if (!trimmed) return null;
      const existing = routineRepo.list(mountainId, kind);
      const duplicate = existing.find((item) => item.label.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) return duplicate;
      return db
        .insert(routineItems)
        .values({
          ...stamps(),
          mountainId,
          kind,
          label: trimmed,
          position: (existing.at(-1)?.position ?? -1) + 1,
        })
        .returning()
        .get();
    },

    rename(itemId: string, label: string) {
      const trimmed = label.trim();
      if (!trimmed) return;
      db.update(routineItems)
        .set({ label: trimmed, updatedAt: deps.now() })
        .where(eq(routineItems.id, itemId))
        .run();
    },

    /** Takes an item off the list but keeps its history for reports. */
    archive(itemId: string) {
      const now = deps.now();
      db.update(routineItems)
        .set({ archivedAt: now, updatedAt: now })
        .where(eq(routineItems.id, itemId))
        .run();
    },
  };

  // -------------------------------------------------------------------- sessions

  /**
   * Deletes a climb and everything recorded for it. Callers run this inside their own
   * transaction: expo-sqlite cannot start a transaction inside another one, so
   * repository functions that open a transaction must never call each other.
   */
  function deleteSessionRows(sessionId: string) {
    db.delete(dayAdherence).where(eq(dayAdherence.sessionId, sessionId)).run();
    db.delete(sessionEvents).where(eq(sessionEvents.sessionId, sessionId)).run();
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  const sessionsRepo = {
    get(sessionId: string): SessionRow | undefined {
      return db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    },

    /** The climb that is running or paused right now, if any. */
    getActive(): SessionRow | undefined {
      return db
        .select()
        .from(sessions)
        .where(and(isNull(sessions.endedAt), isNull(sessions.deletedAt)))
        .get();
    },

    /**
     * Starts a climb and records the pre-climb checklist (Add adherence). If a climb
     * is already active, returns that one and changes nothing.
     */
    start(input: StartInput): SessionRow {
      const active = sessionsRepo.getActive();
      if (active) return active;
      const { tickedAddItemIds = [], ...values } = input;
      const ticked = new Set(tickedAddItemIds);
      return db.transaction(() => {
        const session = db
          .insert(sessions)
          .values({ ...stamps(), ...values, startedAt: deps.now() })
          .returning()
          .get();
        for (const item of routineRepo.list(input.mountainId, 'add')) {
          writeAdherence(session, item.id, ticked.has(item.id), 'checklist');
        }
        return session;
      });
    },

    timer: timerState,

    pause(sessionId: string) {
      addEvent(sessionId, 'pause');
    },

    resume(sessionId: string) {
      closeOpenEvent(sessionId, 'pause');
    },

    /** The app went to the background while the climb was running. */
    markExit(sessionId: string) {
      addEvent(sessionId, 'exit');
    },

    /** The app came back to the foreground. */
    markReturn(sessionId: string) {
      closeOpenEvent(sessionId, 'exit');
    },

    /**
     * Ends the climb and stores flow seconds and interruption counts. A climb shorter
     * than the minimum is deleted instead: it is not a session.
     */
    end(sessionId: string): EndResult {
      return db.transaction(() => {
        closeOpenEvent(sessionId);
        const now = deps.now();
        const timer = timerState(sessionId);
        if (!timer) return { discarded: true };
        const flowSeconds = flowSecondsAt({ ...timer, endedAt: timer.endedAt ?? now }, now);
        if (isTooShort(flowSeconds)) {
          deleteSessionRows(sessionId);
          return { discarded: true };
        }
        const session = db
          .update(sessions)
          .set({
            endedAt: timer.endedAt ?? now,
            flowSeconds,
            pauseCount: countEvents(timer, 'pause'),
            exitCount: countEvents(timer, 'exit'),
            updatedAt: now,
          })
          .where(eq(sessions.id, sessionId))
          .returning()
          .get();
        return { discarded: false, session };
      });
    },

    /**
     * Removes a climb that is still running, with everything recorded for it. It was
     * never a session, so nothing syncs. Finished climbs are never removed.
     */
    discard(sessionId: string) {
      const session = sessionsRepo.get(sessionId);
      if (!session || session.endedAt !== null) return;
      db.transaction(() => deleteSessionRows(sessionId));
    },
  };

  // ------------------------------------------------------------------- check-ins

  function writeCheckin(
    sessionId: string,
    values: {
      skipped: boolean;
      focus: number | null;
      challengeSkill: number | null;
      timePassing: number | null;
      timeToFlowMin: number | null;
      chunkDone: boolean;
    },
    /** Null when the check-in was skipped: nothing is known about the Subtract list. */
    slippedSubtractItemIds: readonly string[] | null,
  ) {
    db.transaction(() => {
      const session = sessionsRepo.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);
      const now = deps.now();
      db.insert(checkins)
        .values({ ...stamps(), sessionId, ...values })
        .onConflictDoUpdate({ target: checkins.sessionId, set: { ...values, updatedAt: now } })
        .run();
      if (values.chunkDone) {
        db.update(chunks)
          .set({ doneAt: now, updatedAt: now })
          .where(and(eq(chunks.id, session.chunkId), isNull(chunks.doneAt)))
          .run();
      }
      if (slippedSubtractItemIds) {
        const slipped = new Set(slippedSubtractItemIds);
        for (const item of routineRepo.list(session.mountainId, 'subtract')) {
          writeAdherence(session, item.id, !slipped.has(item.id), 'self_report');
        }
      }
    });
  }

  const checkinsRepo = {
    /** Saves the taps and the Subtract self-report, and marks the chunk done if it is. */
    save(sessionId: string, input: CheckinInput) {
      const { slippedSubtractItemIds = [], ...values } = input;
      writeCheckin(sessionId, { skipped: false, ...values }, slippedSubtractItemIds);
    },

    /** Skipping is allowed: the session keeps its minutes and gets a neutral depth. */
    skip(sessionId: string) {
      writeCheckin(
        sessionId,
        {
          skipped: true,
          focus: null,
          challengeSkill: null,
          timePassing: null,
          timeToFlowMin: null,
          chunkDone: false,
        },
        null,
      );
    },
  };

  // ----------------------------------------------------------------------- stats

  const finishedSessionsOf = (mountainId: string) =>
    and(
      eq(sessions.mountainId, mountainId),
      isNotNull(sessions.endedAt),
      isNull(sessions.deletedAt),
    );

  const statsRepo = {
    /** Finished climbs in the shape the domain layer scores. */
    domainSessions(mountainId: string): Session[] {
      return db
        .select({ session: sessions, checkin: checkins })
        .from(sessions)
        .leftJoin(checkins, eq(checkins.sessionId, sessions.id))
        .where(finishedSessionsOf(mountainId))
        .orderBy(asc(sessions.startedAt))
        .all()
        .map(({ session, checkin }) => ({
          id: session.id,
          localDate: session.localDate,
          flowSeconds: session.flowSeconds ?? 0,
          pauseCount: session.pauseCount,
          exitCount: session.exitCount,
          checkin: checkin && {
            skipped: checkin.skipped,
            focus: checkin.focus as DepthTap | null,
            challengeSkill: checkin.challengeSkill as DepthTap | null,
            timePassing: checkin.timePassing as DepthTap | null,
            timeToFlowMin: checkin.timeToFlowMin,
            chunkDone: checkin.chunkDone,
          },
        }));
    },

    /** Add and Subtract adherence for finished climbs, in the shape the domain layer scores. */
    domainAdherence(mountainId: string): AdherenceRecord[] {
      return db
        .select({
          localDate: dayAdherence.localDate,
          itemId: dayAdherence.routineItemId,
          kind: routineItems.kind,
          honoured: dayAdherence.honoured,
        })
        .from(dayAdherence)
        .innerJoin(routineItems, eq(dayAdherence.routineItemId, routineItems.id))
        .innerJoin(sessions, eq(dayAdherence.sessionId, sessions.id))
        .where(and(finishedSessionsOf(mountainId), isNull(dayAdherence.deletedAt)))
        .orderBy(asc(sessions.startedAt))
        .all();
    },

    /** Total focus seconds spent on each chunk, for planned-versus-actual. */
    focusSecondsByChunk(mountainId: string): Map<string, number> {
      const rows = db
        .select({
          chunkId: sessions.chunkId,
          seconds: sql<number>`coalesce(sum(${sessions.flowSeconds}), 0)`,
        })
        .from(sessions)
        .where(finishedSessionsOf(mountainId))
        .groupBy(sessions.chunkId)
        .all();
      return new Map(rows.map((row) => [row.chunkId, Number(row.seconds)]));
    },
  };

  // -------------------------------------------------------------------- settings

  /** Small per-device values such as the reminder time. Never synced. */
  const settingsRepo = {
    get(key: string): string | null {
      const row = db.select().from(deviceSettings).where(eq(deviceSettings.key, key)).get();
      return row?.value ?? null;
    },

    set(key: string, value: string) {
      const updatedAt = deps.now();
      db.insert(deviceSettings)
        .values({ key, value, updatedAt })
        .onConflictDoUpdate({ target: deviceSettings.key, set: { value, updatedAt } })
        .run();
    },

    remove(key: string) {
      db.delete(deviceSettings).where(eq(deviceSettings.key, key)).run();
    },
  };

  return {
    mountains: mountainsRepo,
    camps: campsRepo,
    chunks: chunksRepo,
    routine: routineRepo,
    sessions: sessionsRepo,
    checkins: checkinsRepo,
    stats: statsRepo,
    settings: settingsRepo,
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
