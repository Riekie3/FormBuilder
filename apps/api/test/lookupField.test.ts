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

describe("Lookup field reference lists", () => {
  it("round-trips a named dataset through PATCH /forms/:id and GET /forms/:id", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test" });
    const formId = createRes.body.form.id as string;

    const patchRes = await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "companies", name: "Companies", values: ["Acme Corp", "Globex", "Initech"] }],
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.form.lookupDatasets).toEqual([
      { id: "companies", name: "Companies", values: ["Acme Corp", "Globex", "Initech"] },
    ]);

    const getRes = await auth(request(app).get(`/api/forms/${formId}`));
    expect(getRes.body.form.lookupDatasets).toEqual([
      { id: "companies", name: "Companies", values: ["Acme Corp", "Globex", "Initech"] },
    ]);
  });

  it("leaves lookupDatasets untouched when a PATCH doesn't mention it", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test 2" });
    const formId = createRes.body.form.id as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "companies", name: "Companies", values: ["Acme Corp"] }],
    });

    const unrelatedPatch = await auth(request(app).patch(`/api/forms/${formId}`)).send({ title: "Renamed" });
    expect(unrelatedPatch.status).toBe(200);
    expect(unrelatedPatch.body.form).not.toHaveProperty("lookupDatasets");

    const getRes = await auth(request(app).get(`/api/forms/${formId}`));
    expect(getRes.body.form.lookupDatasets).toEqual([{ id: "companies", name: "Companies", values: ["Acme Corp"] }]);
  });

  it("a field's config.lookupDatasetId round-trips through PUT /forms/:id/fields", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test 3" });
    const formId = createRes.body.form.id as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "companies", name: "Companies", values: ["Acme Corp"] }],
    });

    const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [{ type: "LOOKUP", label: "Employer", required: true, order: 0, config: { lookupDatasetId: "companies" } }],
    });
    expect(fieldsRes.body.fields[0].config.lookupDatasetId).toBe("companies");
  });

  it("behaves like a plain Text field for required-validation, accepting free text not on the list", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test 4" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "companies", name: "Companies", values: ["Acme Corp"] }],
    });
    const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [{ type: "LOOKUP", label: "Employer", required: true, order: 0, config: { lookupDatasetId: "companies" } }],
    });
    const fieldId = fieldsRes.body.fields[0].id as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

    // Required and missing — rejected, same as any other required field.
    const missing = await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [] });
    expect(missing.status).toBe(400);

    // A value that isn't in the dataset at all is still accepted — the list
    // is a suggestion aid, not a constraint on what can be submitted.
    const freeText = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [{ fieldId, value: "Some Other Company LLC" }] });
    expect(freeText.status).toBe(201);
  });

  it("carries datasets through duplicate, export, and import", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test 5" });
    const formId = createRes.body.form.id as string;
    await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "companies", name: "Companies", values: ["Acme Corp"] }],
    });
    await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [{ type: "LOOKUP", label: "Employer", required: false, order: 0, config: { lookupDatasetId: "companies" } }],
    });

    const dupRes = await auth(request(app).post(`/api/forms/${formId}/duplicate`));
    expect(dupRes.body.form.lookupDatasets).toEqual([{ id: "companies", name: "Companies", values: ["Acme Corp"] }]);
    const dupFields = await auth(request(app).get(`/api/forms/${dupRes.body.form.id}`));
    expect(dupFields.body.form.fields[0].config.lookupDatasetId).toBe("companies");

    const exportRes = await auth(request(app).get(`/api/forms/${formId}/export`));
    const exported = JSON.parse(exportRes.text);
    expect(exported.lookupDatasets).toEqual([{ id: "companies", name: "Companies", values: ["Acme Corp"] }]);

    const importRes = await auth(request(app).post("/api/forms/import")).send(exported);
    expect(importRes.body.form.lookupDatasets).toEqual([{ id: "companies", name: "Companies", values: ["Acme Corp"] }]);
    const importedDetail = await auth(request(app).get(`/api/forms/${importRes.body.form.id}`));
    expect(importedDetail.body.form.fields[0].config.lookupDatasetId).toBe("companies");
  });

  it("rejects an oversized dataset list", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Lookup Test 6" });
    const formId = createRes.body.form.id as string;

    const tooManyValues = Array.from({ length: 2001 }, (_, i) => `value-${i}`);
    const res = await auth(request(app).patch(`/api/forms/${formId}`)).send({
      lookupDatasets: [{ id: "big", name: "Too Big", values: tooManyValues }],
    });
    expect(res.status).toBe(400);
  });
});
