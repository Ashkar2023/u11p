export const HEARTBEAT_INTERVAL_MS = 10_000;
export const LOCK_LEASE_MS = 20_000;
export const SESSION_LIFETIME_SECONDS = 2 * 60 * 60;
export const API_TIMEOUT_MS = 8_000;
export const LINEUP_TEAM_DURATION_MS = 12_000;
export const LINEUP_DURATION_MS = 2 * LINEUP_TEAM_DURATION_MS;

export const MATCH_STATUS = Object.freeze({
    UPCOMING: "upcoming",
    LIVE: "live",
    FULL_TIME: "full_time",
});

export const EVENT_TYPE = Object.freeze({
    GOAL: "goal",
    GOAL_DISALLOWED: "goal_disallowed",
});

export const GOAL_TYPE = Object.freeze({
    NORMAL: "normal",
    PENALTY: "penalty",
    OWN_GOAL: "own_goal",
});

export const TEAM_SIDES = Object.freeze(["home", "away"]);
