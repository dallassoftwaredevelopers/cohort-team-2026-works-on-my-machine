export const userRoles = ["clerk", "approver", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const userRoleLabels: Record<UserRole, string> = {
  clerk: "Clerk",
  approver: "Approver",
  admin: "Admin",
};

export function isUserRole(value: string): value is UserRole {
  return userRoles.some((role) => role === value);
}
