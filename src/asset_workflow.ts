import { z } from "zod";
import { infrai } from "./infrai_client.js";
import { chooseQueueLane } from "./queue_decision.js";

export const assetRequest = z.object({
  request_id: z.string().uuid(),
  asset_id: z.string().min(1).max(100),
  creator_id: z.string().min(1).max(100),
  source_name: z.string().min(1).max(255),
  bytes: z.number().int().positive(),
}).strict();

export type AssetRequest = z.infer<typeof assetRequest>;

export type AcceptedAsset = {
  asset_id: string;
  job_id: string;
  state: "queued";
  queue_lane: "fast" | "standard";
  delivery_state: "awaiting_processing";
};

export async function acceptAsset(input: AssetRequest): Promise<AcceptedAsset> {
  const fastDeliveryEnabled = await infrai.flags.is_enabled("fast-creator-delivery");
  const queueLane = chooseQueueLane(input.bytes, fastDeliveryEnabled);
  const jobId = `process-${input.asset_id}`;

  await infrai.metrics.report({
    type: "counter",
    name: "media.asset.queued",
    value: 1,
    tags: { queue_lane: queueLane, creator_id: input.creator_id },
  }, `${input.request_id}:asset-queued`);

  return {
    asset_id: input.asset_id,
    job_id: jobId,
    state: "queued",
    queue_lane: queueLane,
    delivery_state: "awaiting_processing",
  };
}

export async function captureIngestError(input: AssetRequest, error: unknown): Promise<void> {
  const exception = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await infrai.errors.capture({
    exception,
    message: "Asset ingestion failed",
    level: "error",
    fingerprint: ["asset-ingestion"],
    context: { asset_id: input.asset_id, creator_id: input.creator_id },
  }, `${input.request_id}:ingest-error`);
}
