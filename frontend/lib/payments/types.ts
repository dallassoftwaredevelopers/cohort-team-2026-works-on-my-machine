import { z } from "zod";

export const invoiceSchema = z.object({
  id: z.string().uuid(), vendorId: z.string().uuid(), propertyId: z.string().uuid(),
  vendorName: z.string().min(1), accountNumber: z.string().min(1),
  reference: z.string().min(1), amount: z.string(), propertyName: z.string().min(1),
  paymentUrl: z.string().url(), status: z.literal("approved"),
}).strict();
export type PaymentInvoice = z.infer<typeof invoiceSchema>;

export const fields = ["email", "password", "holder", "routing", "fundingAccount", "confirmFundingAccount", "invoiceReference", "customerAccount", "amount"] as const;
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("inspect_page") }).strict(),
  z.object({ type: z.literal("navigate"), url: z.string().max(2048) }).strict(),
  z.object({ type: z.literal("fill_field"), controlId: z.string(), field: z.enum(fields) }).strict(),
  z.object({ type: z.literal("select_option"), controlId: z.string(), value: z.string().max(200) }).strict(),
  z.object({ type: z.literal("click_element"), controlId: z.string() }).strict(),
  z.object({ type: z.literal("finish") }).strict(),
  z.object({ type: z.literal("request_human_help"), reason: z.string().max(500) }).strict(),
]);
export type AgentAction = z.infer<typeof actionSchema>;
export type Observation = { url: string; text: string; controls: { id: string; label: string; kind: string; options?: { value: string; label: string }[] }[] };
export type VerifiedPayment = { confirmation: string; billId: string; serviceAccountId: string; accountNumber: string; amountCents: number; status: "succeeded"; portalOrigin: string };
export interface BrowserExecutor {
  observe(): Promise<Observation>;
  execute(action: AgentAction): Promise<void>;
  ready(): Promise<void>;
  submit(intentId: string): Promise<VerifiedPayment>;
  close(): Promise<void>;
}
export type AgentMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] };
export interface Planner { next(messages: AgentMessage[], signal: AbortSignal): Promise<{ id: string; action: AgentAction; message: AgentMessage }> }
