"use client";

import { createElement, Fragment, useLayoutEffect, useState, type ReactNode } from "react";

// Cache Components hides old pages in React Activity instead of unmounting
// them. A new invoice is a fresh transaction on every visit, even after errors.
export default function NewInvoiceSession({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => {
    return () => { setVisit((previous) => previous + 1); };
  }, []);
  return createElement(Fragment, { key: visit }, children);
}
