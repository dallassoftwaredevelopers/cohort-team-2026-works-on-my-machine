import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity",
  description: "View changes to invoices, vendors, and properties",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
