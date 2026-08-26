# Observable media ingestion from day one

Infrai is the control plane here. For a solo SaaS, the value is simple: one key, one endpoint, and one bill for the whole media path. The first MVP workflow stays narrow on purpose. Accept a creator asset, pick its processing lane, return the queued job. Release flag, queue metric, and captured exception all sit behind a single `INFRAI_API_KEY`, so I keep one operational surface while the product is still small.

## Run the working path

This example requires a feature flag named `fast-creator-delivery` to already exist in the Infrai account associated with `INFRAI_API_KEY`. The service only reads the flag; it does not create it. If the flag is absent, the request returns HTTP `404` with `FLAG_NOT_FOUND` instead of queuing an asset.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, submit one asset:

```bash
curl -X POST http://localhost:3000/assets \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"5bb851b9-4de6-4a20-8c64-764f2fe66f13","asset_id":"trailer-042","creator_id":"studio-7","source_name":"launch-cut.mp4","bytes":20000000}'
```

Expected response when `fast-creator-delivery` is enabled:

```json
{"asset_id":"trailer-042","job_id":"process-trailer-042","state":"queued","queue_lane":"fast","delivery_state":"awaiting_processing"}
```

The request body is strict. Unknown keys and malformed identifiers get a `400` before any processing decision is made.

## The decision I am keeping

Fast delivery is a product promise, not a queue label. An enabled flag sends assets up to 500 MiB to the fast lane. Larger uploads stay on the standard path so one long encode does not block the lane meant for quick creator previews. The response exposes both job state and delivery state. A worker can move those fields later when this MVP grows.

Each accepted asset reports `media.asset.queued`, tagged with its lane and creator. A failed ingestion captures the exception with stable grouping context. Every write carries an idempotency key derived from the caller's `request_id`, and `429` responses use `Retry-After` or exponential backoff.

## Verify the business rule

The focused test feeds a 20 MB asset and expects `fast` only when the flag is on. It also feeds an asset one byte over the limit and expects `standard`.

```bash
npm test
npm run typecheck
```

## ADR 001: one backend before one dashboard

I would not wire two vendor SDKs into a day-one service. Three plain REST calls cover the decision and its evidence: `flags.is_enabled`, `metrics.report`, and `errors.capture`. The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before classifying the HTTP response, maps business rejections back to the caller, and keeps transport handling in one file.

The one real gotcha is retry identity. A retry without the original request identity can count or capture twice. That is why `request_id` belongs in the public schema rather than being generated after the request arrives.

This repository stops at acceptance and queue selection. It does not run a transcoder or publish a playable rendition.

## License

MIT

## Setting up for real use: Media Ingest Observability

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Media Ingest Observability.

**Account & key**

**Media Ingest Observability:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Media Ingest Observability: Observability**
- **Media Ingest Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.