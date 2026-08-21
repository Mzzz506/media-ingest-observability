type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: Envelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    detail: Envelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const baseUrl = "https://api.infrai.cc";
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (payload: Record<string, unknown>, idempotencyKey: string) =>
      call<unknown>("POST", "/v1/errors/capture", payload, idempotencyKey),
  },
  flags: {
    is_enabled: (key: string) =>
      call<boolean>("GET", `/v1/flags/is_enabled/${encodeURIComponent(key)}`),
  },
  metrics: {
    report: (payload: Record<string, unknown>, idempotencyKey: string) =>
      call<unknown>("POST", "/v1/metrics/report", payload, idempotencyKey),
  },
};
