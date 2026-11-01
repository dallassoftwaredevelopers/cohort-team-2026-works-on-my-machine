import type { ComponentType, ReactNode } from "react";
import { CNavItem, CNavTitle } from "@coreui/react";
import CIcon from "@coreui/icons-react";
import {
  cilBuilding,
  cilDescription,
  cilHome,
  cilHistory,
  cilUser,
} from "@coreui/icons";

export type NavEntry = {
  component: ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  name: string;
  to?: string;
  icon?: ReactNode;
  items?: NavEntry[];
};

// Sidebar config. Only routes that exist in app/ are listed.
const nav: NavEntry[] = [
  { component: CNavItem, name: "Home", to: "/", icon: <CIcon icon={cilHome} customClassName="nav-icon" /> },
  { component: CNavTitle, name: "Billing" },
  { component: CNavItem, name: "Invoices", to: "/invoices", icon: <CIcon icon={cilDescription} customClassName="nav-icon" /> },
  { component: CNavItem, name: "Activity", to: "/events", icon: <CIcon icon={cilHistory} customClassName="nav-icon" /> },
  { component: CNavTitle, name: "Manage" },
  { component: CNavItem, name: "Properties", to: "/properties", icon: <CIcon icon={cilBuilding} customClassName="nav-icon" /> },
  { component: CNavItem, name: "Vendors", to: "/vendors", icon: <CIcon icon={cilBuilding} customClassName="nav-icon" /> },
  { component: CNavItem, name: "Users", to: "/users", icon: <CIcon icon={cilUser} customClassName="nav-icon" /> },
];

export default nav;

// Path -> label, used by the breadcrumb.
export const routeNames: Record<string, string> = {
  "/invoices": "Invoices",
  "/invoices/new": "New Invoice",
  "/events": "Activity",
  "/properties": "Properties",
  "/vendors": "Vendors",
  "/vendors/new": "Add Vendor",
  "/users": "Users",
  "/users/new": "Add User",
  "/reset-password": "Reset Password",
};
