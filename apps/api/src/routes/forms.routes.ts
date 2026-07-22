import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { slugify } from "../lib/slug";
import { toCsv } from "../lib/csv";
import { FIELD_TYPES } from "@sfb/shared";
import type { FieldDto, FormDetailDto, FormSummaryDto } from "@sfb/shared";
import type { Field as PrismaField, Form as PrismaForm } from "@prisma/client";

export const formsRouter = Router();
formsRouter.use(requireAuth);

async function loadOwnedForm(formId: string, ownerId: string) {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form || form.ownerId !== ownerId) {
    throw new HttpError(404, "Form not found");
  }
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

function toSummaryDto(form: PrismaForm, responseCount: number): FormSummaryDto {
  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status,
    responseCount,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

const createFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

const updateFormSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
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

// GET /api/forms — list the caller's forms
formsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const forms = await prisma.form.findMany({
      where: { ownerId: req.userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { responses: true } } },
    });

    const dtos: FormSummaryDto[] = forms.map((f) => toSummaryDto(f, f._count.responses));
    res.json({ forms: dtos });
  }),
);

// POST /api/forms — create a new draft form
formsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createFormSchema.parse(req.body);
    const form = await prisma.form.create({
      data: {
        title: body.title,
        slug: slugify(body.title),
        ownerId: req.userId!,
      },
    });
    res.status(201).json({ form: toSummaryDto(form, 0) });
  }),
);

// GET /api/forms/:id — full detail including fields, for the builder
formsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadOwnedForm(req.params.id, req.userId!);
    const [fields, responseCount] = await Promise.all([
      prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } }),
      prisma.response.count({ where: { formId: form.id } }),
    ]);

    const dto: FormDetailDto = {
      ...toSummaryDto(form, responseCount),
      description: form.description,
      fields: fields.map(toFieldDto),
    };
    res.json({ form: dto });
  }),
);

// PATCH /api/forms/:id — update title/description/publish state
formsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadOwnedForm(req.params.id, req.userId!);
    const body = updateFormSchema.parse(req.body);

    const updated = await prisma.form.update({
      where: { id: form.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    const responseCount = await prisma.response.count({ where: { formId: form.id } });
    res.json({ form: toSummaryDto(updated, responseCount) });
  }),
);

// DELETE /api/forms/:id
formsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const form = await loadOwnedForm(req.params.id, req.userId!);
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
    const form = await loadOwnedForm(req.params.id, req.userId!);
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
    const form = await loadOwnedForm(req.params.id, req.userId!);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const responses = await prisma.response.findMany({
      where: {
        formId: form.id,
        ...(search
          ? { answers: { some: { value: { contains: search, mode: "insensitive" } } } }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: { answers: true },
      take: 500,
    });

    res.json({
      responses: responses.map((r) => ({
        id: r.id,
        submittedAt: r.submittedAt.toISOString(),
        answers: r.answers.map((a) => ({ fieldId: a.fieldId, value: a.value })),
      })),
    });
  }),
);

// GET /api/forms/:id/responses/export — CSV
formsRouter.get(
  "/:id/responses/export",
  asyncHandler(async (req, res) => {
    const form = await loadOwnedForm(req.params.id, req.userId!);
    const fields = await prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } });
    const responses = await prisma.response.findMany({
      where: { formId: form.id },
      orderBy: { submittedAt: "asc" },
      include: { answers: true },
    });

    const headers = ["Submitted At", ...fields.map((f) => f.label)];
    const rows = responses.map((r) => {
      const byField = new Map(r.answers.map((a) => [a.fieldId, a.value]));
      return [r.submittedAt.toISOString(), ...fields.map((f) => byField.get(f.id) ?? "")];
    });

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${form.slug}-responses.csv"`);
    res.send(csv);
  }),
);

// DELETE /api/forms/:id/responses/:responseId
formsRouter.delete(
  "/:id/responses/:responseId",
  asyncHandler(async (req, res) => {
    const form = await loadOwnedForm(req.params.id, req.userId!);
    const response = await prisma.response.findUnique({ where: { id: req.params.responseId } });
    if (!response || response.formId !== form.id) {
      throw new HttpError(404, "Response not found");
    }
    await prisma.response.delete({ where: { id: response.id } });
    res.status(204).send();
  }),
);
