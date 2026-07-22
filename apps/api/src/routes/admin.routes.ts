import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import type { AdminUserDto, DepartmentDto, MembershipDto, RoleDto } from "@sfb/shared";
import type { Department as PrismaDepartment, Role as PrismaRole } from "@prisma/client";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireSuperAdmin);

function toDepartmentDto(d: PrismaDepartment): DepartmentDto {
  return { id: d.id, name: d.name, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() };
}

function toRoleDto(r: PrismaRole): RoleDto {
  return {
    id: r.id,
    name: r.name,
    canView: r.canView,
    canCreate: r.canCreate,
    canEdit: r.canEdit,
    canDelete: r.canDelete,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// --- Departments -----------------------------------------------------------

const departmentSchema = z.object({ name: z.string().trim().min(1).max(120) });

adminRouter.get(
  "/departments",
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    res.json({ departments: departments.map(toDepartmentDto) });
  }),
);

adminRouter.post(
  "/departments",
  asyncHandler(async (req, res) => {
    const body = departmentSchema.parse(req.body);
    const existing = await prisma.department.findUnique({ where: { name: body.name } });
    if (existing) throw new HttpError(409, "A department with that name already exists");
    const department = await prisma.department.create({ data: { name: body.name } });
    res.status(201).json({ department: toDepartmentDto(department) });
  }),
);

adminRouter.patch(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const body = departmentSchema.parse(req.body);
    const department = await prisma.department.update({ where: { id: req.params.id }, data: { name: body.name } });
    res.json({ department: toDepartmentDto(department) });
  }),
);

adminRouter.delete(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// --- Roles -------------------------------------------------------------------

const roleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

adminRouter.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    res.json({ roles: roles.map(toRoleDto) });
  }),
);

adminRouter.post(
  "/roles",
  asyncHandler(async (req, res) => {
    const body = roleSchema.parse(req.body);
    const existing = await prisma.role.findUnique({ where: { name: body.name } });
    if (existing) throw new HttpError(409, "A role with that name already exists");
    const role = await prisma.role.create({ data: body });
    res.status(201).json({ role: toRoleDto(role) });
  }),
);

adminRouter.patch(
  "/roles/:id",
  asyncHandler(async (req, res) => {
    const body = roleSchema.partial().parse(req.body);
    const role = await prisma.role.update({ where: { id: req.params.id }, data: body });
    res.json({ role: toRoleDto(role) });
  }),
);

adminRouter.delete(
  "/roles/:id",
  asyncHandler(async (req, res) => {
    await prisma.role.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// --- Users (read-only list, for assigning memberships) -----------------------

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    const dtos: AdminUserDto[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, isSuperAdmin: u.isSuperAdmin }));
    res.json({ users: dtos });
  }),
);

// --- Memberships (assign a user to a department with a role) ----------------

const membershipSchema = z.object({
  userId: z.string(),
  departmentId: z.string(),
  roleId: z.string(),
});

adminRouter.get(
  "/memberships",
  asyncHandler(async (_req, res) => {
    const memberships = await prisma.membership.findMany({
      include: { user: true, department: true, role: true },
      orderBy: { createdAt: "desc" },
    });
    const dtos: MembershipDto[] = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      departmentId: m.departmentId,
      departmentName: m.department.name,
      roleId: m.roleId,
      roleName: m.role.name,
      createdAt: m.createdAt.toISOString(),
    }));
    res.json({ memberships: dtos });
  }),
);

adminRouter.post(
  "/memberships",
  asyncHandler(async (req, res) => {
    const body = membershipSchema.parse(req.body);
    const [user, department, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: body.userId } }),
      prisma.department.findUnique({ where: { id: body.departmentId } }),
      prisma.role.findUnique({ where: { id: body.roleId } }),
    ]);
    if (!user || !department || !role) throw new HttpError(404, "User, department, or role not found");

    const existing = await prisma.membership.findUnique({
      where: { userId_departmentId_roleId: { userId: body.userId, departmentId: body.departmentId, roleId: body.roleId } },
    });
    if (existing) throw new HttpError(409, "That user already holds this role in this department");

    const membership = await prisma.membership.create({
      data: body,
      include: { user: true, department: true, role: true },
    });
    const dto: MembershipDto = {
      id: membership.id,
      userId: membership.userId,
      userName: membership.user.name,
      userEmail: membership.user.email,
      departmentId: membership.departmentId,
      departmentName: membership.department.name,
      roleId: membership.roleId,
      roleName: membership.role.name,
      createdAt: membership.createdAt.toISOString(),
    };
    res.status(201).json({ membership: dto });
  }),
);

adminRouter.delete(
  "/memberships/:id",
  asyncHandler(async (req, res) => {
    await prisma.membership.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
