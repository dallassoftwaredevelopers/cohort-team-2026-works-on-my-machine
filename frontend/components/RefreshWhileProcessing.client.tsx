"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Server components still own all queries. Refresh only while a visible page
// contains processing invoices, so paid rows disappear without manual reload.
export default function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [active, router]);
  return null;
}
