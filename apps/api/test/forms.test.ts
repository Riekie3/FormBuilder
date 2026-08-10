import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb } from "./helpers";

let accessToken: string;

beforeEach(async () => {
  await resetDb();
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Grace Hopper", email: "grace@example.com", password: "correcthorse123" });
  accessToken = res.body.accessToken;
});

function auth(req: request.Test) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("forms", () => {
  it("creates, lists, and fetches a form", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Feedback Survey" });
    expect(createRes.status).toBe(201);
    const formId = createRes.body.form.id as string;

    const listRes = await auth(request(app).get("/api/forms"));
    expect(listRes.status).toBe(200);
    expect(listRes.body.forms).toHaveLength(1);

    const detailRes = await auth(request(app).get(`/api/forms/${formId}`));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.form.title).toBe("Feedback Survey");
    expect(detailRes.body.form.fields).toEqual([]);
  });

  it("saves fields in bulk and preserves ids across a second save", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Contact" });
    const formId = createRes.body.form.id as string;

    const firstSave = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [
        { type: "TEXT", label: "Name", required: true, order: 0, config: {} },
        { type: "EMAIL", label: "Email", required: true, order: 1, config: {} },
      ],
    });
    expect(firstSave.status).toBe(200);
    expect(firstSave.body.fields).toHaveLength(2);
    const nameFieldId = firstSave.body.fields.find((f: { label: string }) => f.label === "Name").id;

    const secondSave = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [
        { id: nameFieldId, type: "TEXT", label: "Full Name", required: true, order: 0, config: {} },
      ],
    });
    expect(secondSave.status).toBe(200);
    expect(secondSave.body.fields).toHaveLength(1);
    expect(secondSave.body.fields[0].id).toBe(nameFieldId);
    expect(secondSave.body.fields[0].label).toBe("Full Name");
  });

  it("rejects access to another user's form", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Mine" });
    const formId = createRes.body.form.id as string;

    const otherRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "other@example.com", password: "correcthorse123" });
    const otherToken = otherRes.body.accessToken as string;

    const res = await request(app).get(`/api/forms/${formId}`).set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it("publishes a form and exposes it on the public endpoint", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Public Test" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;

    await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [{ type: "TEXT", label: "Name", required: true, order: 0, config: {} }],
    });

    const draftPublicRes = await request(app).get(`/api/public/forms/${slug}`);
    expect(draftPublicRes.status).toBe(404);

    await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

    const publishedPublicRes = await request(app).get(`/api/public/forms/${slug}`);
    expect(publishedPublicRes.status).toBe(200);
    expect(publishedPublicRes.body.form.fields).toHaveLength(1);
  });

  it("defaults oneQuestionPerPage to false and toggles it via PATCH", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Layout Test" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;
    expect(createRes.body.form.oneQuestionPerPage).toBe(false);

    const patchRes = await auth(request(app).patch(`/api/forms/${formId}`)).send({
      status: "PUBLISHED",
      oneQuestionPerPage: true,
    });
    expect(patchRes.body.form.oneQuestionPerPage).toBe(true);

    const publicRes = await request(app).get(`/api/public/forms/${slug}`);
    expect(publicRes.body.form.oneQuestionPerPage).toBe(true);
  });

  it("accepts a valid public submission and rejects one missing a required field", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Submission Test" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;

    const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [{ type: "TEXT", label: "Name", required: true, order: 0, config: {} }],
    });
    const fieldId = fieldsRes.body.fields[0].id as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

    const missingRes = await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [] });
    expect(missingRes.status).toBe(400);

    const okRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [{ fieldId, value: "Ada" }] });
    expect(okRes.status).toBe(201);

    const responsesRes = await auth(request(app).get(`/api/forms/${formId}/responses`));
    expect(responsesRes.body.responses).toHaveLength(1);
    expect(responsesRes.body.responses[0].answers[0]).toEqual({ fieldId, value: "Ada" });

    const exportRes = await auth(request(app).get(`/api/forms/${formId}/responses/export`));
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain("Ada");
    expect(exportRes.text).toContain("Name");
  });

  it("deletes a form", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Delete Me" });
    const formId = createRes.body.form.id as string;

    const deleteRes = await auth(request(app).delete(`/api/forms/${formId}`));
    expect(deleteRes.status).toBe(204);

    const getRes = await auth(request(app).get(`/api/forms/${formId}`));
    expect(getRes.status).toBe(404);
  });
});
