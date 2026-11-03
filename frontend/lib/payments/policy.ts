import { invoiceSchema, type PaymentInvoice } from "./types";

const vendors = [
  ["alder-creek", "Alder Creek Landscaping"], ["brightwater", "Brightwater Water & Sewer"],
  ["copper-ridge", "Copper Ridge Waste Services"], ["northline", "Northline Business Internet"],
  ["sunmeadow", "Sunmeadow Cleaning"], ["cedar-valley", "Cedar Valley Pest Control"],
  ["harborlight", "Harborlight Security"], ["prairie-grid", "Prairie Grid HVAC Services"],
  ["maple-junction", "Maple Junction Storage"], ["summit-trail", "Summit Trail Equipment Rental"],
] as const;
export const mockVendors = vendors.map(([slug, name]) => ({ name, origin: `https://${slug}-utility-demo.vercel.app` }));
export function cents(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) throw new Error("Invalid USD amount");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Invalid USD amount");
  return result;
}
export function portalFor(input: PaymentInvoice) {
  const invoice = invoiceSchema.parse(input);
  cents(invoice.amount);
  const portal = mockVendors.find(v => v.name.toLowerCase() === invoice.vendorName.trim().toLowerCase());
  if (!portal) throw new Error("Vendor is not registered for mock payments");
  const url = new URL(invoice.paymentUrl);
  if (url.origin !== portal.origin || url.username || url.password || url.pathname !== "/" || url.search) throw new Error("Payment URL is not an allowlisted mock portal");
  return portal;
}
export function navigationAllowed(url: string, origin: string) {
  try {
    const u = new URL(url);
    return u.origin === origin && !u.username && !u.password && u.pathname === "/" && !u.search
      && /^#?(?:|home|account|billing|portal|services|support|signin(?:\/[\w-]+)?|pay\/[\w-]+|statement\/[\w-]+|history|receipt\/[\w-]+)$/.test(u.hash);
  } catch { return false; }
}
export const demoValues = {
  email: "demo@acme.com", password: "demo123", holder: "Demo Business",
  routing: "110000000", fundingAccount: "000123456789", confirmFundingAccount: "000123456789",
};
