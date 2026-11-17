/**
 * Analytics events (PLAN.md Phase 2). For now events go to the dev console only;
 * Phase 7 sends them to PostHog by registering a sink here.
 */
export type AnalyticsEvent =
  | 'onboarding_completed'
  | 'climb_started'
  | 'climb_completed'
  | 'climb_discarded'
  | 'checkin_completed'
  | 'checkin_skipped'
  | 'setup_prompt_opened'
  | 'setup_prompt_dismissed'
  | 'reminder_enabled'
  | 'reminder_disabled';

export type AnalyticsProps = Record<string, string | number | boolean | null>;
export type AnalyticsSink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

const sinks = new Set<AnalyticsSink>();

/** Registers a destination for events. Returns a function that removes it. */
export function addAnalyticsSink(sink: AnalyticsSink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  for (const sink of sinks) sink(event, props);
}

if (__DEV__ && process.env.NODE_ENV !== 'test') {
  addAnalyticsSink((event, props) => console.log(`[analytics] ${event}`, props));
}
