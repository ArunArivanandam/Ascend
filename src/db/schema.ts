import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Local SQLite schema: the device is the source of truth (PLAN.md §4).
 * Timestamps are epoch milliseconds. Synced tables carry user_id / updated_at /
 * deleted_at so the Phase 5 sync engine can push and pull by updated_at.
 */
const synced = {
  id: text('id').primaryKey(),
  /** Null until the device gets a Supabase user (Phase 5). */
  userId: text('user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const mountains = sqliteTable('mountains', {
  ...synced,
  name: text('name').notNull(),
  /** Local date, YYYY-MM-DD. */
  targetDate: text('target_date').notNull(),
  status: text('status', { enum: ['active', 'summited', 'archived'] })
    .notNull()
    .default('active'),
  summitedAt: integer('summited_at'),
});

export const camps = sqliteTable(
  'camps',
  {
    ...synced,
    mountainId: text('mountain_id')
      .notNull()
      .references(() => mountains.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [index('camps_mountain_idx').on(table.mountainId)],
);

export const chunks = sqliteTable(
  'chunks',
  {
    ...synced,
    mountainId: text('mountain_id')
      .notNull()
      .references(() => mountains.id),
    campId: text('camp_id')
      .notNull()
      .references(() => camps.id),
    title: text('title').notNull(),
    estimateMin: integer('estimate_min'),
    position: integer('position').notNull(),
    doneAt: integer('done_at'),
  },
  (table) => [index('chunks_mountain_idx').on(table.mountainId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    ...synced,
    mountainId: text('mountain_id')
      .notNull()
      .references(() => mountains.id),
    chunkId: text('chunk_id')
      .notNull()
      .references(() => chunks.id),
    startedAt: integer('started_at').notNull(),
    /** Null while the climb is still running. */
    endedAt: integer('ended_at'),
    /** Set when the climb ends; computed from timestamps, never from ticks. */
    flowSeconds: integer('flow_seconds'),
    pauseCount: integer('pause_count').notNull().default(0),
    exitCount: integer('exit_count').notNull().default(0),
    /** The user's local date when the climb started. */
    localDate: text('local_date').notNull(),
  },
  (table) => [index('sessions_local_date_idx').on(table.localDate)],
);

/** Raw pause and app-exit intervals. Device only: never synced (only the counts are). */
export const sessionEvents = sqliteTable(
  'session_events',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    kind: text('kind', { enum: ['pause', 'exit'] }).notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
  },
  (table) => [index('session_events_session_idx').on(table.sessionId)],
);

export const checkins = sqliteTable(
  'checkins',
  {
    ...synced,
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    skipped: integer('skipped', { mode: 'boolean' }).notNull(),
    focus: integer('focus'),
    challengeSkill: integer('challenge_skill'),
    timePassing: integer('time_passing'),
    timeToFlowMin: integer('time_to_flow_min'),
    chunkDone: integer('chunk_done', { mode: 'boolean' }).notNull(),
  },
  (table) => [uniqueIndex('checkins_session_idx').on(table.sessionId)],
);

/** Add items (what helps the user enter flow) and Subtract items (what breaks it). */
export const routineItems = sqliteTable(
  'routine_items',
  {
    ...synced,
    mountainId: text('mountain_id')
      .notNull()
      .references(() => mountains.id),
    kind: text('kind', { enum: ['add', 'subtract'] }).notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    /** Removed from the lists, but kept so past adherence still means something. */
    archivedAt: integer('archived_at'),
  },
  (table) => [index('routine_items_mountain_idx').on(table.mountainId)],
);

/**
 * Whether one routine item was honoured for one climb: Add items from the pre-climb
 * checklist, Subtract items from the self-report at check-in (or a blocker in v1.1).
 */
export const dayAdherence = sqliteTable(
  'day_adherence',
  {
    ...synced,
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    routineItemId: text('routine_item_id')
      .notNull()
      .references(() => routineItems.id),
    localDate: text('local_date').notNull(),
    honoured: integer('honoured', { mode: 'boolean' }).notNull(),
    source: text('source', { enum: ['checklist', 'self_report', 'blocker'] }).notNull(),
  },
  (table) => [
    uniqueIndex('day_adherence_session_item_idx').on(table.sessionId, table.routineItemId),
    index('day_adherence_date_idx').on(table.localDate),
  ],
);

/** Small per-device settings (reminder time, dismissed prompts). Device only: never synced. */
export const deviceSettings = sqliteTable('device_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const schema = {
  mountains,
  camps,
  chunks,
  sessions,
  sessionEvents,
  checkins,
  routineItems,
  dayAdherence,
  deviceSettings,
};

export type MountainRow = typeof mountains.$inferSelect;
export type CampRow = typeof camps.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionEventRow = typeof sessionEvents.$inferSelect;
export type CheckinRow = typeof checkins.$inferSelect;
export type RoutineItemRow = typeof routineItems.$inferSelect;
