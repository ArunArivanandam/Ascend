import { addDays } from '../dates';
import { driverInsights, itemMostAssociatedWithWeakSessions, keepOrDrop } from '../insights';
import { buildDailySeries } from '../series';
import type { AdherenceRecord, RoutineItem, Session } from '../types';
import { rated, record, session } from './helpers';

const START = '2026-11-01';
const walk: RoutineItem = { id: 'walk', kind: 'add', label: 'Walk' };
const phone: RoutineItem = { id: 'phone', kind: 'subtract', label: 'Phone away' };

/** `days` climbing days; the item is honoured on the first `honouredDays` of them. */
function scenario(days: number, honouredDays: number, itemId = 'walk') {
  const sessions: Session[] = [];
  const adherence: AdherenceRecord[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(START, i);
    const honoured = i < honouredDays;
    sessions.push(session(date, 30, { checkin: rated(honoured ? 4 : 2) }));
    adherence.push(record(date, itemId, honoured));
  }
  const series = buildDailySeries({ firstClimbDate: START, days, sessions, adherence });
  return { series, adherence };
}

describe('driverInsights', () => {
  it('requires at least 5 days with and 5 days without the item', () => {
    const notEnough = scenario(9, 5); // 5 with, 4 without
    expect(driverInsights(notEnough.series, notEnough.adherence, [walk])).toEqual([]);

    const enough = scenario(10, 5);
    const [insight] = driverInsights(enough.series, enough.adherence, [walk]);
    expect(insight).toMatchObject({ daysHonoured: 5, daysNotHonoured: 5, depthDelta: 2 });
    expect(insight?.altitudeDelta).toBeGreaterThan(0);
  });

  it('marks a day as not honoured if any record that day was missed', () => {
    const { series, adherence } = scenario(10, 6);
    // Day 1 also has a missed record → it moves to the "without" side.
    const extra = [...adherence, record(START, 'walk', false)];
    const [insight] = driverInsights(series, extra, [walk]);
    expect(insight).toMatchObject({ daysHonoured: 5, daysNotHonoured: 5 });
  });

  it('ignores records on days without a climb and items with no records', () => {
    const { series, adherence } = scenario(10, 5);
    const extra = [...adherence, record('2026-12-25', 'walk', true)];
    expect(driverInsights(series, extra, [walk, phone])).toHaveLength(1);
  });

  it('reports null depth when one side has no rated sessions, and still sorts', () => {
    const { series, adherence } = scenario(10, 5);
    const unrated = series.map((day) => (day.day > 5 ? { ...day, meanDepthTap: null } : day));
    const phoneRecords = adherence.map((r) => ({ ...r, itemId: 'phone' }));
    const insights = driverInsights(unrated, [...adherence, ...phoneRecords], [walk, phone]);
    expect(insights).toHaveLength(2);
    expect(insights[0]?.depthNotHonoured).toBeNull();
    expect(insights.every((i) => i.depthDelta === null)).toBe(true);
  });

  it('sorts by the size of the depth difference', () => {
    const a = scenario(10, 5, 'walk');
    const b = scenario(10, 5, 'phone');
    // Make "phone" a weaker driver: depth equal on both sides.
    const series = a.series;
    const phoneRecords = b.adherence.map((r, i) => ({ ...r, honoured: i % 2 === 0 }));
    const insights = driverInsights(series, [...a.adherence, ...phoneRecords], [phone, walk]);
    expect(insights.map((i) => i.item.id)).toEqual(['walk', 'phone']);
  });
});

describe('itemMostAssociatedWithWeakSessions', () => {
  const base = {
    daysHonoured: 5,
    daysNotHonoured: 5,
    altitudeHonoured: 0,
    altitudeNotHonoured: 0,
    depthHonoured: null,
    depthNotHonoured: null,
    altitudeDelta: 0,
  };

  it('picks the item whose absence goes with the biggest depth drop', () => {
    const result = itemMostAssociatedWithWeakSessions([
      { ...base, item: walk, depthDelta: 0.5 },
      { ...base, item: phone, depthDelta: 1.2 },
      { ...base, item: { ...walk, id: 'x' }, depthDelta: null },
    ]);
    expect(result?.item.id).toBe('phone');
  });

  it('returns null when nothing is positively associated', () => {
    expect(
      itemMostAssociatedWithWeakSessions([{ ...base, item: walk, depthDelta: -0.4 }]),
    ).toBeNull();
    expect(itemMostAssociatedWithWeakSessions([])).toBeNull();
  });

  it('splits items into keep and drop, skipping neutral or unknown ones', () => {
    const { keep, drop } = keepOrDrop([
      { ...base, item: walk, depthDelta: 0.5 },
      { ...base, item: phone, depthDelta: -0.5 },
      { ...base, item: { ...walk, id: 'zero' }, depthDelta: 0 },
      { ...base, item: { ...walk, id: 'none' }, depthDelta: null },
    ]);
    expect(keep.map((i) => i.id)).toEqual(['walk']);
    expect(drop.map((i) => i.id)).toEqual(['phone']);
  });
});
