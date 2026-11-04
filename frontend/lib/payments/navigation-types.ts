export const invoiceSearchOutcomes = [
    'UNPAID', // We found the correct invoice, verifed its identify details, and confimed it is unpaid
    'PAID', // We found the correct invoice, verifed its identify details, and confimed it is paid
    'NOT_FOUND', // We completed the search but donlt find an invoice that reliable match the expeeted detials
    'NEEDS_REVIEW',  // We found possible match, but cannot safely choose one.
    'SEARCH_ERROR' // We cound complete the check because of a tehnical problem.
] as const;

export type InvoiceSearchOutcome = (typeof invoiceSearchOutcomes)[number];

export type InvoiceSearchResult = {
    outcome: InvoiceSearchOutcome;
    evidence: string[];

};


export type InvoiceSearchInput = {
    vendorName: string;
    paymentUrl: string;
    accountNumber: string;
    invoiceNumber: string; // "Invoice refference"
    amountDue: string; // "186.42"
    dueDate: string; // YYYY-MM-DD
};
