import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add user",
  description: "Create a new user account",
};

export default function CreateUserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
