export function mockPaymentEnabled(env: Record<string, string | undefined> = process.env) {
  return env.MOCK_PAYMENT_AGENT_ENABLED === "true" && env.VERCEL_ENV !== "production";
}
