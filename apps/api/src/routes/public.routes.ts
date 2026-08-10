import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { publicSubmissionRateLimit } from "../middleware/rateLimit";
import { sha256Hex } from "../lib/hash";
import { isComputedField, isFieldAnswerComplete, isFieldVisible, isLayoutField } from "@sfb/shared";
import type { FieldDto, PublicFormDto } from "@sfb/shared";
import type { Field as PrismaField } from "@prisma/client";

export const publicRouter = Router();

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

const submitSchema = z.object({
  answers: z.array(z.object({ fieldId: z.string(), value: z.string().max(10000) })).max(200),
  // Present when this submission finishes a previously-saved draft — lets
  // the server clean up the now-redundant DraftResponse in the same request.
  resumeToken: z.string().optional(),
});

const draftSaveSchema = z.object({
  // Absent on the first save (a new draft is created and its token
  // returned); present on every save after that to update in place instead
  // of accumulating a new row per autosave/click.
  token: z.string().optional(),
  answers: z.array(z.object({ fieldId: z.string(), value: z.string().max(10000) })).max(200),
});

publicRouter.get(
  "/forms/:slug",
  asyncHandler(async (req, res) => {
    const form = await prisma.form.findUnique({ where: { slug: req.params.slug } });
    if (!form || form.status !== "PUBLISHED") {
      throw new HttpError(404, "This form isn't available");
    }

    const fields = await prisma.field.findMany({ where: { formId: form.id }, orderBy: { order: "asc" } });
    const dto: PublicFormDto = {
      id: form.id,
      title: form.title,
      description: form.description,
      fields: fields.map(toFieldDto),
      requiresApproval: form.requiresApproval,
    };
    res.json({ form: dto });
  }),
);

publicRouter.post(
  "/forms/:slug/responses",
  publicSubmissionRateLimit,
  asyncHandler(async (req, res) => {
    const form = await prisma.form.findUnique({ where: { slug: req.params.slug } });
    if (!form || form.status !== "PUBLISHED") {
      throw new HttpError(404, "This form isn't available");
    }

    const body = submitSchema.parse(req.body);
    const fields = await prisma.field.findMany({ where: { formId: form.id } });
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    const valueByFieldId = new Map(body.answers.map((a) => [a.fieldId, a.value]));
    const answersByFieldId = Object.fromEntries(valueByFieldId);

    for (const field of fields) {
      if (isLayoutField(field.type) || isComputedField(field.type)) continue;
      // A condition that hid this field from the visitor also excuses it
      // from required-ness — the server must agree with what the client
      // actually showed, evaluated against the same submitted answers.
      if (!isFieldVisible(toFieldDto(field), answersByFieldId)) continue;
      if (field.required && !isFieldAnswerComplete(toFieldDto(field), valueByFieldId.get(field.id))) {
        throw new HttpError(400, `"${field.label}" is required`);
      }
    }

    const validAnswers = body.answers.filter((a) => fieldById.has(a.fieldId) && a.value.trim() !== "");
    const ipHash = req.ip ? sha256Hex(req.ip) : undefined;

    await prisma.response.create({
      data: {
        formId: form.id,
        ipHash,
        status: form.requiresApproval ? "PENDING" : null,
        answers: { create: validAnswers.map((a) => ({ fieldId: a.fieldId, value: a.value })) },
      },
    });

    if (body.resumeToken) {
      // Best-effort: a missing/mismatched token just means there was nothing
      // to clean up, not a failed submission.
      await prisma.draftResponse.deleteMany({ where: { token: body.resumeToken, formId: form.id } });
    }

    res.status(201).json({ ok: true });
  }),
);

publicRouter.post(
  "/forms/:slug/draft",
  publicSubmissionRateLimit,
  asyncHandler(async (req, res) => {
    const form = await prisma.form.findUnique({ where: { slug: req.params.slug } });
    if (!form || form.status !== "PUBLISHED") {
      throw new HttpError(404, "This form isn't available");
    }

    const body = draftSaveSchema.parse(req.body);
    const answers = Object.fromEntries(body.answers.map((a) => [a.fieldId, a.value]));

    if (body.token) {
      const existing = await prisma.draftResponse.findUnique({ where: { token: body.token } });
      if (existing && existing.formId === form.id) {
        await prisma.draftResponse.update({ where: { token: body.token }, data: { answers } });
        res.json({ token: body.token });
        return;
      }
    }

    const draft = await prisma.draftResponse.create({ data: { formId: form.id, answers } });
    res.status(201).json({ token: draft.token });
  }),
);

publicRouter.get(
  "/forms/:slug/draft/:token",
  asyncHandler(async (req, res) => {
    const form = await prisma.form.findUnique({ where: { slug: req.params.slug } });
    if (!form || form.status !== "PUBLISHED") {
      throw new HttpError(404, "This form isn't available");
    }

    const draft = await prisma.draftResponse.findUnique({ where: { token: req.params.token } });
    if (!draft || draft.formId !== form.id) {
      throw new HttpError(404, "This saved draft isn't available");
    }

    res.json({ answers: draft.answers as Record<string, string> });
  }),
);
