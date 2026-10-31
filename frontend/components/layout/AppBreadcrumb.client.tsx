"use client";

import { usePathname } from "next/navigation";
import { CBreadcrumb, CBreadcrumbItem } from "@coreui/react";
import { routeNames } from "./nav";

export default function AppBreadcrumb() {
  const pathname = usePathname();

  // Build cumulative paths ("/invoices", "/invoices/new") that have a known name.
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments
    .map((_, i) => `/${segments.slice(0, i + 1).join("/")}`)
    .filter((path) => routeNames[path])
    .map((path) => ({ path, name: routeNames[path], active: path === pathname }));

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem href="/">Home</CBreadcrumbItem>
      {crumbs.map((crumb) => (
        <CBreadcrumbItem
          key={crumb.path}
          {...(crumb.active ? { active: true } : { href: crumb.path })}
        >
          {crumb.name}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  );
}
