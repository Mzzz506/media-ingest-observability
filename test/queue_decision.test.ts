import assert from "node:assert/strict";
import test from "node:test";
import { FAST_LANE_LIMIT_BYTES, chooseQueueLane } from "../src/queue_decision.js";

test("small assets use the fast lane only when creator delivery is enabled", () => {
  assert.equal(chooseQueueLane(20_000_000, true), "fast");
  assert.equal(chooseQueueLane(20_000_000, false), "standard");
});

test("large assets stay in the standard lane when the flag is enabled", () => {
  assert.equal(chooseQueueLane(FAST_LANE_LIMIT_BYTES + 1, true), "standard");
});
