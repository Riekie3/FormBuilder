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

async function createPublishedForm(title: string) {
  const createRes = await auth(request(app).post("/api/forms")).send({ title });
  const formId = createRes.body.form.id as string;
  const slug = createRes.body.form.slug as string;

  const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
    fields: [
      { type: "TEXT", label: "Name", required: true, order: 0, config: {} },
      { type: "EMAIL", label: "Email", required: true, order: 1, config: {} },
    ],
  });
  const [nameFieldId, emailFieldId] = fieldsRes.body.fields.map((f: { id: string }) => f.id);

  await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

  return { formId, slug, nameFieldId, emailFieldId };
}

describe("save-and-resume drafts", () => {
  it("saves a new draft and reads it back by token", async () => {
    const { slug, nameFieldId } = await createPublishedForm("Draft Test");

    const saveRes = await request(app)
      .post(`/api/public/forms/${slug}/draft`)
      .send({ answers: [{ fieldId: nameFieldId, value: "Taylor" }] });
    expect(saveRes.status).toBe(201);
    const token = saveRes.body.token as string;
    expect(token).toBeTruthy();

    const fetchRes = await request(app).get(`/api/public/forms/${slug}/draft/${token}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.answers).toEqual({ [nameFieldId]: "Taylor" });
  });

  it("updates the same draft in place when a token is supplied, instead of creating a new one", async () => {
    const { slug, nameFieldId } = await createPublishedForm("Draft Update Test");

    const firstSave = await request(app)
      .post(`/api/public/forms/${slug}/draft`)
      .send({ answers: [{ fieldId: nameFieldId, value: "Taylor" }] });
    const token = firstSave.body.token as string;

    const secondSave = await request(app)
      .post(`/api/public/forms/${slug}/draft`)
      .send({ token, answers: [{ fieldId: nameFieldId, value: "Taylor Reed" }] });
    expect(secondSave.status).toBe(200);
    expect(secondSave.body.token).toBe(token);

    const fetchRes = await request(app).get(`/api/public/forms/${slug}/draft/${token}`);
    expect(fetchRes.body.answers).toEqual({ [nameFieldId]: "Taylor Reed" });
  });

  it("404s when fetching a draft that doesn't exist or belongs to a different form", async () => {
    const { slug: slugA, nameFieldId } = await createPublishedForm("Form A");
    const { slug: slugB } = await createPublishedForm("Form B");

    const missingRes = await request(app).get(`/api/public/forms/${slugA}/draft/not-a-real-token`);
    expect(missingRes.status).toBe(404);

    const saveRes = await request(app)
      .post(`/api/public/forms/${slugA}/draft`)
      .send({ answers: [{ fieldId: nameFieldId, value: "Taylor" }] });
    const token = saveRes.body.token as string;

    const crossFormRes = await request(app).get(`/api/public/forms/${slugB}/draft/${token}`);
    expect(crossFormRes.status).toBe(404);
  });

  it("deletes the draft once the real submission completes with a matching resumeToken", async () => {
    const { slug, nameFieldId, emailFieldId } = await createPublishedForm("Draft Cleanup Test");

    const saveRes = await request(app)
      .post(`/api/public/forms/${slug}/draft`)
      .send({ answers: [{ fieldId: nameFieldId, value: "Taylor" }] });
    const token = saveRes.body.token as string;

    const submitRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [
          { fieldId: nameFieldId, value: "Taylor" },
          { fieldId: emailFieldId, value: "taylor@example.com" },
        ],
        resumeToken: token,
      });
    expect(submitRes.status).toBe(201);

    const fetchRes = await request(app).get(`/api/public/forms/${slug}/draft/${token}`);
    expect(fetchRes.status).toBe(404);
  });

  it("submitting without a resumeToken doesn't touch unrelated drafts", async () => {
    const { slug, nameFieldId, emailFieldId } = await createPublishedForm("No Resume Token Test");

    const saveRes = await request(app)
      .post(`/api/public/forms/${slug}/draft`)
      .send({ answers: [{ fieldId: nameFieldId, value: "Taylor" }] });
    const token = saveRes.body.token as string;

    const submitRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [
          { fieldId: nameFieldId, value: "Someone Else" },
          { fieldId: emailFieldId, value: "someone@example.com" },
        ],
      });
    expect(submitRes.status).toBe(201);

    const fetchRes = await request(app).get(`/api/public/forms/${slug}/draft/${token}`);
    expect(fetchRes.status).toBe(200);
  });

  it("404s for draft endpoints on an unpublished form", async () => {
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Unpublished Draft Test" });
    const slug = createRes.body.form.slug as string;

    const saveRes = await request(app).post(`/api/public/forms/${slug}/draft`).send({ answers: [] });
    expect(saveRes.status).toBe(404);
  });
});
