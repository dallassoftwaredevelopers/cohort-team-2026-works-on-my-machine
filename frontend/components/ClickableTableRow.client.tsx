"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function ClickableTableRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <tr style={{ cursor: "pointer" }} onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) return;
      if (window.getSelection()?.toString()) return;
      if (event.ctrlKey || event.metaKey) window.open(href, "_blank", "noopener,noreferrer");
      else router.push(href);
    }}>
      {children}
    </tr>
  );
}
