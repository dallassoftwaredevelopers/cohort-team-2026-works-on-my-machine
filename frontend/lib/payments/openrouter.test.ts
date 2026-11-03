import assert from "node:assert/strict";
import test from "node:test";
import { OpenRouterPlanner } from "./openrouter";

test("OpenRouter validates model tools and preserves the tool-call protocol", async () => {
  const original = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "test/tool-model", supported_parameters: ["tools"] }] });
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "browser_action", arguments: '{"type":"finish"}' } }] } }] });
  };
  try {
    const planner = new OpenRouterPlanner("test-key", "test/tool-model");
    await planner.checkModel();
    const next = await planner.next([{ role: "user", content: "Prepare" }], AbortSignal.timeout(5000));
    assert.equal(next.id, "call-1"); assert.equal(next.action.type, "finish");
    assert.equal(next.message.tool_calls?.[0].id, "call-1");
    assert.equal(bodies[0].parallel_tool_calls, false);
    assert.deepEqual(bodies[0].provider, { require_parameters: true });
    await assert.rejects(new OpenRouterPlanner("test-key", "missing-model").checkModel(), /must support tool/);
    for (const tool_calls of [[], [{ id: "a", type: "function", function: { name: "browser_action", arguments: '{"type":"evaluate"}' } }], ["a", "b"]]) {
      globalThis.fetch = async () => Response.json({ choices: [{ message: { tool_calls } }] });
      await assert.rejects(planner.next([], AbortSignal.timeout(5000)));
    }
  } finally { globalThis.fetch = original; }
});
