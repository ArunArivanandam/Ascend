import type { AdherenceRecord, Checkin, DepthTap, Session } from '../types';

export function rated(tap: DepthTap, overrides: Partial<Checkin> = {}): Checkin {
  return {
    skipped: false,
    focus: tap,
    challengeSkill: tap,
    timePassing: tap,
    timeToFlowMin: 10,
    chunkDone: false,
    ...overrides,
  };
}

export const skipped: Checkin = {
  skipped: true,
  focus: null,
  challengeSkill: null,
  timePassing: null,
  timeToFlowMin: null,
  chunkDone: false,
};

let nextId = 0;

export function session(
  localDate: string,
  minutes: number,
  overrides: Partial<Session> = {},
): Session {
  nextId += 1;
  return {
    id: `s${nextId}`,
    localDate,
    flowSeconds: minutes * 60,
    pauseCount: 0,
    exitCount: 0,
    checkin: rated(3),
    ...overrides,
  };
}

export function record(
  localDate: string,
  itemId: string,
  honoured: boolean,
  kind: AdherenceRecord['kind'] = 'add',
): AdherenceRecord {
  return { localDate, itemId, kind, honoured };
}
