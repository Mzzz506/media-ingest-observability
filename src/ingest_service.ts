import { createServer } from "node:http";
import { ZodError } from "zod";
import { assetRequest, acceptAsset, captureIngestError } from "./asset_workflow.js";
import { InfraiError } from "./infrai_client.js";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/assets") {
    send(response, 404, { error: "route_not_found" });
    return;
  }

  let input;
  try {
    input = assetRequest.parse(await readJson(request));
  } catch (error) {
    const details = error instanceof ZodError ? error.flatten() : { formErrors: ["Invalid JSON body"] };
    send(response, 400, { error: "invalid_request", details });
    return;
  }

  try {
    send(response, 202, await acceptAsset(input));
  } catch (error) {
    try {
      await captureIngestError(input, error);
    } catch {
      // Preserve the original request outcome; capture is a side effect.
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.code, message: error.message });
      return;
    }
    send(response, 503, { error: "ingestion_unavailable" });
  }
}).listen(port, () => {
  console.log(`Media ingest listening on http://localhost:${port}`);
});
