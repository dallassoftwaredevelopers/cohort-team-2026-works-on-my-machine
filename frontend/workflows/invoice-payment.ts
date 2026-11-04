import { sleep } from "workflow";
import { checkPaymentStep, expirePaymentStep } from "./invoice-payment-steps";

// Only checks an already-reserved attempt. Browser Use POST /runs is deliberately
// outside the workflow: replay/retry must never submit an external payment twice.
export async function completeInvoicePayment(attemptId: string) {
  "use workflow";
  for (let check = 0; check < 180; check++) {
    try {
      const done = await checkPaymentStep(attemptId);
      if (done) return;
    } catch {
      // Exhausted transient step retries: preserve the reservation and surface
      // an uncertain outcome rather than leaving an invisible failed worker.
      await expirePaymentStep(attemptId, "Background checks could not complete. Check Browser Use and payment history before resolving this payment.");
      return;
    }
    await sleep("15s");
  }
  await expirePaymentStep(attemptId, "The payment has not completed within 45 minutes. Check Browser Use and payment history before resolving it.");
}
