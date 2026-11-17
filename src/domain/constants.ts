/**
 * Every tunable number in the measurement model lives here (AGENTS.md rule 9).
 * Bump MODEL_VERSION whenever a value changes so stored reports can be traced
 * back to the model that produced them.
 */
export const MODEL_VERSION = 1;

/** Depth taps are 1 to 5. */
export const TAP_MIN = 1;
export const TAP_MAX = 5;

/** D: mean depth tap mapped linearly from TAP_MIN → 0.5 to TAP_MAX → 1.5. */
export const DEPTH_MULTIPLIER_MIN = 0.5;
export const DEPTH_MULTIPLIER_MAX = 1.5;

/** A: adherence 0% → 0.8, 100% → 1.2. */
export const ADHERENCE_MULTIPLIER_MIN = 0.8;
export const ADHERENCE_MULTIPLIER_MAX = 1.2;

/** Used for D when a check-in is skipped and for A when no routine items exist. */
export const NEUTRAL_MULTIPLIER = 1;

export const WEEK_LENGTH = 7;
export const MINI_REPORT_DAYS = 7;
export const REPORT_DAYS = 30;

/** Weeks compared by the growth rate. Week 1 = days 1–7, week 4 = days 22–28. */
export const BASELINE_WEEK = 1;
export const COMPARISON_WEEK = 4;

/** Days between the midpoints of week 1 (day 4) and week 4 (day 25). */
export const GROWTH_EXPONENT_DAYS = 21;

/** A growth rate needs at least this many climbing days in week 1 and in week 4. */
export const MIN_CLIMBING_DAYS_PER_WEEK = 4;

export const ROLLING_WINDOW_DAYS = 7;

/** A driver insight needs at least this many days with and without the item. */
export const DRIVER_MIN_DAYS = 5;

/** |g| below this daily rate is reported as a plateau (0.25% per day). */
export const PLATEAU_BAND = 0.0025;

/** Week-1 suggestion thresholds. */
export const SUGGESTION_MIN_CHECKIN_RATE = 0.5;
export const SUGGESTION_HIGH_INTERRUPTIONS_PER_SESSION = 2;
export const SUGGESTION_SLOW_TIME_TO_FLOW_MIN = 15;
