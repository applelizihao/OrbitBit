import test from "node:test";
import assert from "node:assert/strict";
import { completeMission, defaultState, sanitizeState, startMission, supply } from "../src/core/game.js";

test("mission flow consumes energy and awards one star", () => {
  const active = startMission(defaultState);
  assert.equal(active.missionStatus, "active");
  assert.equal(active.energy, 3);
  const complete = completeMission(active);
  assert.equal(complete.missionStatus, "idle");
  assert.equal(complete.stars, 4);
  assert.equal(complete.completedMissions, 1);
});

test("stars and supplies stay inside their limits", () => {
  assert.equal(completeMission({ ...defaultState, missionStatus: "active", stars: 7 }, 4).stars, 7);
  assert.equal(supply({ ...defaultState, energy: 5 }).energy, 5);
});

test("persisted state is sanitized", () => {
  assert.deepEqual(sanitizeState({ stars: 99, energy: -3, missionStatus: "broken" }), { stars: 7, energy: 0, missionStatus: "idle", completedMissions: 0 });
});
