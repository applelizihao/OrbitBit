export const MAX_STARS = 7;

export const defaultState = Object.freeze({ stars: 3, energy: 4, missionStatus: "idle", completedMissions: 0 });

export function sanitizeState(value = {}) {
  return {
    stars: clampNumber(value.stars, 0, MAX_STARS, defaultState.stars),
    energy: clampNumber(value.energy, 0, 5, defaultState.energy),
    missionStatus: value.missionStatus === "active" ? "active" : "idle",
    completedMissions: clampNumber(value.completedMissions, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export function startMission(state) {
  const current = sanitizeState(state);
  if (current.missionStatus === "active") return current;
  return { ...current, missionStatus: "active", energy: Math.max(0, current.energy - 1) };
}

export function completeMission(state, reward = 1) {
  const current = sanitizeState(state);
  if (current.missionStatus !== "active") return current;
  return { ...current, missionStatus: "idle", stars: Math.min(MAX_STARS, current.stars + Math.max(0, reward)), completedMissions: current.completedMissions + 1 };
}

export function supply(state) {
  const current = sanitizeState(state);
  return { ...current, energy: Math.min(5, current.energy + 1) };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}
