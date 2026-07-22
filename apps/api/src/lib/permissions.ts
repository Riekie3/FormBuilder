import { prisma } from "./prisma";

export interface FormPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const NO_ACCESS: FormPermissions = { canView: false, canEdit: false, canDelete: false };
const FULL_ACCESS: FormPermissions = { canView: true, canEdit: true, canDelete: true };

/**
 * A form's owner and super admins always have full access. Otherwise, access
 * comes from the user's Membership(s) in the form's department — department
 * access is additive (department-wide, not per-form grants), so a user with
 * several roles in the same department gets the union of their permissions.
 * A form with no department is private to its owner (Phase 1 behavior).
 */
export async function resolveFormPermissions(
  userId: string,
  form: { ownerId: string; departmentId: string | null },
): Promise<FormPermissions> {
  if (form.ownerId === userId) return FULL_ACCESS;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NO_ACCESS;
  if (user.isSuperAdmin) return FULL_ACCESS;
  if (!form.departmentId) return NO_ACCESS;

  const memberships = await prisma.membership.findMany({
    where: { userId, departmentId: form.departmentId },
    include: { role: true },
  });

  return {
    canView: memberships.some((m) => m.role.canView),
    canEdit: memberships.some((m) => m.role.canEdit),
    canDelete: memberships.some((m) => m.role.canDelete),
  };
}

/** Department ids (with role.canView) the user can see forms for, beyond their own. */
export async function viewableDepartmentIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { role: true },
  });
  return memberships.filter((m) => m.role.canView).map((m) => m.departmentId);
}

export async function canCreateInDepartment(userId: string, departmentId: string | null): Promise<boolean> {
  // A form with no department is private to its creator — anyone can make one.
  if (!departmentId) return true;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.isSuperAdmin) return true;

  const memberships = await prisma.membership.findMany({
    where: { userId, departmentId },
    include: { role: true },
  });
  return memberships.some((m) => m.role.canCreate);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isSuperAdmin ?? false;
}
