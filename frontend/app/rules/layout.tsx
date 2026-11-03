import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Approval rules",
  description: "Configure thresholds for automatic invoice approval",
};

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
