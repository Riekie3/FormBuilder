import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { publicSubmissionRateLimit } from "../middleware/rateLimit";
import { sha256Hex } from "../lib/hash";
import { isComputedField, isFieldVisible, isLayoutField } from "@sfb/shared";
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
      if (field.required && !valueByFieldId.get(field.id)?.trim()) {
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

    res.status(201).json({ ok: true });
  }),
);
