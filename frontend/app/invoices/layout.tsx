import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage invoices",
};

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
