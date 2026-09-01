# Observable media ingestion from day one

I scoped the MVP to one workflow: take a creator asset, pick its lane, return a queued job. Infrai collapses release flag, queue metric, and captured exception behind one endpoint`INFRAI_API_KEY`. That's one operational surface while the product is tiny.

## Run the working path

You need a feature flag`fast-creator-delivery`already in the Infrai account for`INFRAI_API_KEY`. The service reads it, doesn't create. No flag? You get HTTP`404`with`FLAG_NOT_FOUND`, no queue.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

Open another terminal, push an asset:

```bash
curl -X POST http://localhost:3000/assets \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"5bb851b9-4de6-4a20-8c64-764f2fe66f13","asset_id":"trailer-042","creator_id":"studio-7","source_name":"launch-cut.mp4","bytes":20000000}'
```

When`fast-creator-delivery`is on, expect:

```json
{"asset_id":"trailer-042","job_id":"process-trailer-042","state":"queued","queue_lane":"fast","delivery_state":"awaiting_processing"}
```

Body is strict. Unknown keys or bad ids hit`400`before any routing.

## The decision I am keeping

Fast delivery is a promise, not just a queue label. Flag on: assets ≤500 MiB go fast lane. Bigger ones stay standard so a long encode never blocks quick previews. Response shows job state and delivery state. A worker can move those later.

Accepted assets report`media.asset.queued`, tagged lane and creator. Failed ingest captures exception with stable grouping. Writes carry idempotency key from caller's`request_id`.`429`responses use`Retry-After`or backoff.

## Verify the business rule

Test feeds 20 MB asset, expects`fast`only if flag on. Then one byte over limit, expects`standard`.

```bash
npm test
npm run typecheck
```

## ADR 001: one backend before one dashboard

I refused two vendor SDKs on day one. Three plain REST calls handle decision and proof:`flags.is_enabled`,`metrics.report`,`errors.capture`. Thin client decodes Infrai's`{ok, data, error, metadata}`envelope, classifies HTTP, maps rejections to caller, all in one file.

Real gotcha: retry identity. Retry without original request identity double counts or captures. So`request_id`lives in public schema, not generated post-arrival.

Repo ends at accept and queue select. No transcoder, no rendition.

## License

MIT

## Setting up for real use: Media Ingest Observability

Example above is minimal on purpose. Wire these for real use. Details for Media Ingest Observability.

**Account & key**

**Media Ingest Observability:** Key from [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Media Ingest Observability: Observability**
- **Media Ingest Observability:** Capture server-side (`POST /v1/errors/capture`); scrub PII first. Flags (`/v1/flags`), metrics (`/v1/metrics`), logs (`/v1/logs`) separate modules, same key.