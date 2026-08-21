export const FAST_LANE_LIMIT_BYTES = 500 * 1024 * 1024;

export type QueueLane = "fast" | "standard";

export function chooseQueueLane(bytes: number, fastDeliveryEnabled: boolean): QueueLane {
  return fastDeliveryEnabled && bytes <= FAST_LANE_LIMIT_BYTES ? "fast" : "standard";
}
