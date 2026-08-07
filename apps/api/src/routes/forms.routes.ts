import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { slugify } from "../lib/slug";
import { toCsv } from "../lib/csv";
import {
  canCreateInDepartment,
  canDecideOnForm,
  isSuperAdmin,
  resolveFormPermissions,
  viewableDepartmentIds,
} from "../lib/permissions";
import { FIELD_TYPES } from "@sfb/shared";
import type { FieldDto, FormDetailDto, FormSummaryDto, ResponseDto } from "@sfb/shared";
import type { Field as PrismaField, Form as PrismaForm } from "@prisma/client";

export const formsRouter = Router();
formsRouter.use(requireAuth);

type FormWithRelations = PrismaForm & {
  department: { name: string } | null;
  approverRole: { name: string } | null;
};

const FORM_INCLUDE = {
  department: { select: { name: true } },
  approverRole: { select: { name: true } },
} as const;

/**
 * Loads a form and enforces the requested action against the caller's
 * resolved permissions. `view` failures 404 (hide existence from users with
 * no access at all); `edit`/`delete` failures on a form the caller *can* see
 * are a 403, since they already know it exists.
 */
async function loadAccessibleForm(
  formId: string,
  userId: string,
  requiredAction: "view" | "edit" | "delete",
): Promise<FormWithRelations> {
  const form = await prisma.form.findUnique({ where: { id: formId }, include: FORM_INCLUDE });
  if (!form) throw new HttpError(404, "Form not found");

  const perms = await resolveFormPermissions(userId, form);
  if (!perms.canView) throw new HttpError(404, "Form not found");
  if (requiredAction === "edit" && !perms.canEdit) throw new HttpError(403, "You don't have permission to edit this form");
  if (requiredAction === "delete" && !perms.canDelete) throw new HttpError(403, "You don't have permission to delete this form");

  return form;
}

function toFieldDto(field: PrismaField): FieldDto {
  return {
    id: field.id,
    type: field.type,
    label: field.label,
    required: field.required,
    order: field.order,
    config: (field.config as FieldDto["config"]) ?? {},
  };
}

async function toSummaryDto(
  form: FormWithRelations,
  responseCount: number,
  perms: { canEdit: boolean; canDelete: boolean },
  userId: string,
): Promise<FormSummaryDto> {
  const canApprove = form.requiresApproval ? await canDecideOnForm(userId, form) : false;
  const pendingCount = form.requiresApproval
    ? await prisma.response.count({ where: { formId: form.id, status: "PENDING" } })
    : 0;

  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status,
    responseCount,
    productCode: form.productCode,
    departmentId: form.departmentId,
    departmentName: form.department?.name ?? null,
    canEdit: perms.canEdit,
    canDelete: perms.canDelete,
    requiresApproval: form.requiresApproval,
    approverRoleId: form.approverRoleId,
    approverRoleName: form.approverRole?.name ?? null,
    canApprove,
    pendingCount,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

const createFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentId: z.string().nullable().optional(),
});

const updateFormSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  departmentId: z.string().nullable().optional(),
  requiresApproval: z.boolean().optional(),
  approverRoleId: z.string().nullable().optional(),
  productCode: z.string().trim().max(120).nullable().optional(),
});

const fieldOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
});

const fieldConfigSchema = z.object({
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(fieldOptionSchema).max(50).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxRating: z.number().int().min(1).max(10).optional(),
  htmlContent: z.string().max(20000).optional(),
  richText: z.string().max(5000).optional(),
  defaultValue: z.string().max(500).optional(),
  formula: z.string().max(1000).optional(),
  precision: z.number().int().min(0).max(6).optional(),
});

const fieldInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1).max(200),
  required: z.boolean(),
  order: z.number().int().min(0),
  config: fieldConfigSchema.default({}),
});

const fieldsPayloadSchema = z.object({
  fields: z.array(fieldInputSchema).max(200),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().max(1000).optional(),
});

// GET /api/forms/my-departments — departments the caller can create forms
// in, for the "create under a department" picker (not an admin endpoint —
// every user needs to see their own memberships).
formsRouter.get(
  "/my-departments",
  asyncHandler(async (req, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId! },
      include: { department: true, role: true },
    });
    const canCreateIn = memberships.filter((m) => m.role.canCreate);
    const unique = new Map(canCreateIn.map((m) => [m.departmentId, m.department.name]));
    res.json({ departments: [...unique.entries()].map(([id, name]) => ({ id, name })) });
  }),
);

// GET /api/forms/available-roles — every role, for the approver-role picker
// in form settings. Role names/permissions aren't sensitive; any
// authenticated user can see the list (only super admins can create/edit them).
formsRouter.get(
  "/available-roles",
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    res.json({ roles });
  }),
);

// GET /api/forms/pending-approvals — every PENDING response across forms the
// caller can decide on (their own forms, or forms where they hold the
// designated approver role in that department; super admins see all).
formsRouter.get(
  "/pending-approvals",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const admin = await isSuperAdmin(userId);

    const candidateForms = await prisma.form.findMany({
      where: { requiresApproval: true },
      include: FORM_INCLUDE,
    });

    const decidable = admin
      ? candidateForms
      : (
          await Promise.all(candidateForms.map(async (f) => ((await canDecideOnForm(userId, f)) ? f : null)))
        ).filter((f): f is FormWithRelations => f !== null);

    const results = await Promise.all(
      decidable.map(async (form) => {
        const [responses, fields] = await Promise.all([
          prisma.response.findMany({
            where: { formId: form.id, status: "PENDING" },
            orderBy: { submittedAt: "asc" },
            include: { answers: true },
          }),
          prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } }),
        ]);
        return responses.map((r) => ({
          responseId: r.id,
          formId: form.id,
          formTitle: form.title,
          submittedAt: r.submittedAt.toISOString(),
          answers: r.answers.map((a) => ({ fieldId: a.fieldId, value: a.value })),
          fields: fields.map(toFieldDto),
        }));
      }),
    );

    res.json({ pending: results.flat() });
  }),
);

// GET /api/forms — forms the caller owns, plus forms in departments they
// belong to (super admins see everything).
formsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const admin = await isSuperAdmin(userId);
    const departmentIds = admin ? [] : await viewableDepartmentIds(userId);

    const forms = await prisma.form.findMany({
      where: admin ? {} : { OR: [{ ownerId: userId }, { departmentId: { in: departmentIds } }] },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { responses: true } }, ...FORM_INCLUDE },
    });

    const dtos: FormSummaryDto[] = await Promise.all(
      forms.map(async (f) => {
        const perms = await resolveFormPermissions(userId, f);
        return toSummaryDto(f, f._count.responses, perms, userId);
      }),
    );
    res.json({ forms: dtos });
  }),
);

// POST /api/forms — create a new draft form, optionally under a department
formsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createFormSchema.parse(req.body);
    const departmentId = body.departmentId ?? null;

    const allowed = await canCreateInDepartment(req.userId!, departmentId);
    if (!allowed) throw new HttpError(403, "You don't have permission to create forms in this department");

    const form = await prisma.form.create({
      data: {
        title: body.title,
        slug: slugify(body.title),
        ownerId: req.userId!,
        departmentId,
      },
      include: FORM_INCLUDE,
    });
    const dto = await toSummaryDto(form, 0, { canEdit: true, canDelete: true }, req.userId!);
    res.status(201).json({ form: dto });
  }),
);

// GET /api/forms/:id — full detail including fields, for the builder
formsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "view");
    const perms = await resolveFormPermissions(req.userId!, form);
    const [fields, responseCount] = await Promise.all([
      prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } }),
      prisma.response.count({ where: { formId: form.id } }),
    ]);

    const summary = await toSummaryDto(form, responseCount, perms, req.userId!);
    const dto: FormDetailDto = {
      ...summary,
      description: form.description,
      fields: fields.map(toFieldDto),
    };
    res.json({ form: dto });
  }),
);

// PATCH /api/forms/:id — update title/description/publish state/approval config
formsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "edit");
    const body = updateFormSchema.parse(req.body);

    if (body.departmentId !== undefined && body.departmentId !== form.departmentId) {
      const allowed = await canCreateInDepartment(req.userId!, body.departmentId);
      if (!allowed) throw new HttpError(403, "You don't have permission to move this form into that department");
    }

    const nextDepartmentId = body.departmentId !== undefined ? body.departmentId : form.departmentId;
    const nextRequiresApproval = body.requiresApproval ?? form.requiresApproval;
    const nextApproverRoleId = body.requiresApproval === false ? null : (body.approverRoleId ?? form.approverRoleId);

    if (nextRequiresApproval) {
      if (!nextDepartmentId) {
        throw new HttpError(400, "A form must belong to a department before it can require approval");
      }
      if (!nextApproverRoleId) {
        throw new HttpError(400, "Choose an approver role before enabling approval");
      }
      const role = await prisma.role.findUnique({ where: { id: nextApproverRoleId } });
      if (!role) throw new HttpError(400, "That role no longer exists");
    }

    const updated = await prisma.form.update({
      where: { id: form.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        ...(body.requiresApproval !== undefined ? { requiresApproval: body.requiresApproval } : {}),
        approverRoleId: nextRequiresApproval ? nextApproverRoleId : null,
        ...(body.productCode !== undefined ? { productCode: body.productCode || null } : {}),
      },
      include: FORM_INCLUDE,
    });

    const [responseCount, perms] = await Promise.all([
      prisma.response.count({ where: { formId: form.id } }),
      resolveFormPermissions(req.userId!, updated),
    ]);
    const dto = await toSummaryDto(updated, responseCount, perms, req.userId!);
    res.json({ form: dto });
  }),
);

// DELETE /api/forms/:id
formsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "delete");
    await prisma.form.delete({ where: { id: form.id } });
    res.status(204).send();
  }),
);

// PUT /api/forms/:id/fields — bulk save from the builder (autosave).
// Existing field ids are updated in place so Answers keep a stable foreign key;
// ids missing from the payload are deleted (cascading their Answers); ids not
// yet known to the server are created and returned with their new id.
formsRouter.put(
  "/:id/fields",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "edit");
    const body = fieldsPayloadSchema.parse(req.body);

    const existing = await prisma.field.findMany({ where: { formId: form.id }, select: { id: true } });
    const existingIds = new Set(existing.map((f) => f.id));
    const incomingIds = new Set(body.fields.filter((f) => f.id).map((f) => f.id!));
    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));

    await prisma.$transaction([
      ...(idsToDelete.length ? [prisma.field.deleteMany({ where: { id: { in: idsToDelete } } })] : []),
      ...body.fields.map((f) =>
        f.id && existingIds.has(f.id)
          ? prisma.field.update({
              where: { id: f.id },
              data: { type: f.type, label: f.label, required: f.required, order: f.order, config: f.config },
            })
          : prisma.field.create({
              data: {
                formId: form.id,
                type: f.type,
                label: f.label,
                required: f.required,
                order: f.order,
                config: f.config,
              },
            }),
      ),
    ]);

    const fields = await prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } });
    res.json({ fields: fields.map(toFieldDto) });
  }),
);

// GET /api/forms/:id/responses?search=
formsRouter.get(
  "/:id/responses",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "view");
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const responses = await prisma.response.findMany({
      where: {
        formId: form.id,
        ...(search
          ? { answers: { some: { value: { contains: search, mode: "insensitive" } } } }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: { answers: true, decidedBy: { select: { name: true } } },
      take: 500,
    });

    const dtos: ResponseDto[] = responses.map((r) => ({
      id: r.id,
      submittedAt: r.submittedAt.toISOString(),
      answers: r.answers.map((a) => ({ fieldId: a.fieldId, value: a.value })),
      status: r.status,
      decidedByName: r.decidedBy?.name ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionComment: r.decisionComment,
    }));
    res.json({ responses: dtos });
  }),
);

// GET /api/forms/:id/responses/export — CSV
formsRouter.get(
  "/:id/responses/export",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "view");
    const fields = await prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } });
    const responses = await prisma.response.findMany({
      where: { formId: form.id },
      orderBy: { submittedAt: "asc" },
      include: { answers: true },
    });

    const headers = ["Submitted At", ...(form.requiresApproval ? ["Status"] : []), ...fields.map((f) => f.label)];
    const rows = responses.map((r) => {
      const byField = new Map(r.answers.map((a) => [a.fieldId, a.value]));
      return [
        r.submittedAt.toISOString(),
        ...(form.requiresApproval ? [r.status ?? ""] : []),
        ...fields.map((f) => byField.get(f.id) ?? ""),
      ];
    });

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${form.slug}-responses.csv"`);
    res.send(csv);
  }),
);

// DELETE /api/forms/:id/responses/:responseId — tied to the form's edit permission
formsRouter.delete(
  "/:id/responses/:responseId",
  asyncHandler(async (req, res) => {
    const form = await loadAccessibleForm(req.params.id, req.userId!, "edit");
    const response = await prisma.response.findUnique({ where: { id: req.params.responseId } });
    if (!response || response.formId !== form.id) {
      throw new HttpError(404, "Response not found");
    }
    await prisma.response.delete({ where: { id: response.id } });
    res.status(204).send();
  }),
);

// PATCH /api/forms/:id/responses/:responseId/decision — Approve/Reject a
// pending response. Gated on canDecideOnForm, not the general edit permission.
formsRouter.patch(
  "/:id/responses/:responseId/decision",
  asyncHandler(async (req, res) => {
    const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: FORM_INCLUDE });
    if (!form) throw new HttpError(404, "Form not found");

    const perms = await resolveFormPermissions(req.userId!, form);
    if (!perms.canView) throw new HttpError(404, "Form not found");
    if (!form.requiresApproval) throw new HttpError(400, "This form doesn't use an approval workflow");

    const allowed = await canDecideOnForm(req.userId!, form);
    if (!allowed) throw new HttpError(403, "You don't have permission to decide on this form's submissions");

    const response = await prisma.response.findUnique({ where: { id: req.params.responseId } });
    if (!response || response.formId !== form.id) throw new HttpError(404, "Response not found");
    if (response.status !== "PENDING") throw new HttpError(409, "This response has already been decided");

    const body = decisionSchema.parse(req.body);
    const updated = await prisma.response.update({
      where: { id: response.id },
      data: {
        status: body.decision,
        decidedByUserId: req.userId!,
        decidedAt: new Date(),
        decisionComment: body.comment ?? null,
      },
      include: { answers: true, decidedBy: { select: { name: true } } },
    });

    const dto: ResponseDto = {
      id: updated.id,
      submittedAt: updated.submittedAt.toISOString(),
      answers: updated.answers.map((a) => ({ fieldId: a.fieldId, value: a.value })),
      status: updated.status,
      decidedByName: updated.decidedBy?.name ?? null,
      decidedAt: updated.decidedAt?.toISOString() ?? null,
      decisionComment: updated.decisionComment,
    };
    res.json({ response: dto });
  }),
);
