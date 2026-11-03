const reasonLabels: Record<string, string> = {
  autopay_off: "Vendor autopay is off.",
  settings_incomplete: "Approval rules have not been fully configured.",
  amount_limit: "Amount exceeds the automatic approval limit.",
  short_history: "There are too few comparable prior bills.",
  no_comparable_average: "There is no comparable bill average yet.",
  unusual_amount: "Amount is above the permitted percentage of the prior-bill average.",
};

export function ruleReasonLabel(code: string) {
  return reasonLabels[code] ?? code.replaceAll("_", " ");
}
