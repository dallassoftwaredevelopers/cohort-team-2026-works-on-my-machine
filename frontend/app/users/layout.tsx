import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users",
  description: "Manage user profiles",
};

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
