import "server-only";
import { paymentOutputSchema, paymentPrompt, type PaymentSnapshot } from "./payment";

const baseUrl = "https://api.browser-use.com/api/v4";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BrowserUseError extends Error {
  constructor(message: string, readonly rejected = false) { super(message); }
}

export function browserUseConfigured() {
  return Boolean(process.env.BROWSER_USE_API_KEY?.trim());
}

async function request(path: string, body?: unknown) {
  const key = process.env.BROWSER_USE_API_KEY?.trim();
  if (!key) throw new BrowserUseError("Demo payments are not configured. Set BROWSER_USE_API_KEY on the server.", true);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "X-Browser-Use-API-Key": key, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new BrowserUseError("Could not reach Browser Use. A submitted task may still be running; do not start another payment.");
  }
  if (!response.ok) {
    // Do not expose upstream bodies: they may contain credentials or task data.
    const rejected = [400, 401, 402, 403, 404, 409, 422, 429].includes(response.status);
    throw new BrowserUseError(`Browser Use returned HTTP ${response.status}. Check the API key, credits, and task dashboard.`, rejected);
  }
  try { return await response.json(); }
  catch { throw new BrowserUseError("Browser Use returned an unreadable response. Check its task dashboard."); }
}

export async function startBrowserPayment(expected: PaymentSnapshot): Promise<string> {
  const result = await request("/runs", {
    task: paymentPrompt(expected),
    outputSchema: paymentOutputSchema,
    // No model override: use the project's default hosted agent.
    maxCostUsd: 0.50,
  });
  if (typeof result.id !== "string" || !uuid.test(result.id)) throw new BrowserUseError("The task ID could not be read. Check Browser Use before retrying.");
  return result.id;
}

export async function readBrowserPayment(runId: string): Promise<{ status: string; output?: unknown }> {
  if (!uuid.test(runId)) throw new BrowserUseError("Invalid saved task ID.");
  const status = await request(`/runs/${runId}/status`);
  if (!["queued", "dispatching", "running", "completed", "failed", "cancelled"].includes(status.status)) {
    throw new BrowserUseError("Browser Use returned an unknown task status.");
  }
  if (status.status !== "completed") return { status: status.status };
  const run = await request(`/runs/${runId}`);
  if (run.id !== runId || run.status !== "completed") throw new BrowserUseError("The completed task could not be verified.");
  return { status: run.status, output: run.output ?? run.result };
}
