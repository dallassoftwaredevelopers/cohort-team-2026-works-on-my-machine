// Worker-only: never import this module into a client component.
import { z } from "zod";
import { actionSchema, type Planner, type AgentMessage } from "./types";

const tool = { type: "function", function: { name: "browser_action", description: "Request exactly one restricted browser action. Never submit a payment or check authorization. Use finish when the ACH form is populated and ready for human approval.", parameters: z.toJSONSchema(actionSchema) } };
const responseSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional(), tool_calls: z.array(z.object({ id: z.string(), type: z.literal("function"), function: z.object({ name: z.literal("browser_action"), arguments: z.string().max(8000) }) })).length(1) }) })).min(1) });
export class OpenRouterPlanner implements Planner {
  constructor(private key: string, private model: string) {
    if (!key || !model) throw new Error("Set OPENROUTER_API_KEY and OPENROUTER_MODEL in the worker environment");
  }
  async checkModel() {
    const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Could not verify OpenRouter model capabilities");
    const result = z.object({ data: z.array(z.object({ id: z.string(), supported_parameters: z.array(z.string()).optional() })) }).parse(await response.json());
    if (!result.data.some(m => m.id === this.model && m.supported_parameters?.includes("tools"))) throw new Error("OPENROUTER_MODEL must support tool calling");
  }
  async next(messages: AgentMessage[], signal: AbortSignal) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, tools: [tool], tool_choice: { type: "function", function: { name: "browser_action" } }, parallel_tool_calls: false, provider: { require_parameters: true }, max_tokens: 1000 }),
      signal,
    });
    if (!response.ok) throw new Error(`OpenRouter request failed (${response.status})`);
    const parsed = responseSchema.parse(await response.json()).choices[0].message;
    const call = parsed.tool_calls[0];
    const action = actionSchema.parse(JSON.parse(call.function.arguments));
    return { id: call.id, action, message: { role: "assistant" as const, content: parsed.content ?? null, tool_calls: parsed.tool_calls } };
  }
}
