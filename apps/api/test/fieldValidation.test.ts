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

async function publishFormWithField(config: Record<string, unknown>, type = "TEXT", required = false) {
  const createRes = await auth(request(app).post("/api/forms")).send({ title: "Validation Test" });
  const formId = createRes.body.form.id as string;
  const slug = createRes.body.form.slug as string;

  const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
    fields: [{ type, label: "Field", required, order: 0, config }],
  });
  const fieldId = fieldsRes.body.fields[0].id as string;
  await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

  return { formId, slug, fieldId };
}

async function submit(slug: string, fieldId: string, value: string) {
  return request(app)
    .post(`/api/public/forms/${slug}/responses`)
    .send({ answers: [{ fieldId, value }] });
}

describe("field-level validation rules", () => {
  it("enforces a Number field's configured min/max", async () => {
    const { slug, fieldId } = await publishFormWithField({ min: 1, max: 5 }, "NUMBER");

    expect((await submit(slug, fieldId, "0")).status).toBe(400);
    expect((await submit(slug, fieldId, "6")).status).toBe(400);
    expect((await submit(slug, fieldId, "3")).status).toBe(201);
  });

  it("rejects a non-numeric value for a Number field", async () => {
    const { slug, fieldId } = await publishFormWithField({}, "NUMBER");
    expect((await submit(slug, fieldId, "not-a-number")).status).toBe(400);
  });

  it("enforces a Text field's min/max length", async () => {
    const { slug, fieldId } = await publishFormWithField({ minLength: 3, maxLength: 6 }, "TEXT");

    expect((await submit(slug, fieldId, "ab")).status).toBe(400);
    expect((await submit(slug, fieldId, "abcdefg")).status).toBe(400);
    expect((await submit(slug, fieldId, "abcd")).status).toBe(201);
  });

  it("enforces a Text field's allowed-character format", async () => {
    const { slug, fieldId } = await publishFormWithField({ format: "letters" }, "TEXT");

    expect((await submit(slug, fieldId, "abc123")).status).toBe(400);
    expect((await submit(slug, fieldId, "abc")).status).toBe(201);
  });

  it("rejects a malformed Email address", async () => {
    const { slug, fieldId } = await publishFormWithField({}, "EMAIL");

    expect((await submit(slug, fieldId, "not-an-email")).status).toBe(400);
    expect((await submit(slug, fieldId, "ada@example.com")).status).toBe(201);
  });

  it("still validates format on an optional field when a value is actually submitted", async () => {
    const { slug, fieldId } = await publishFormWithField({}, "EMAIL", false);
    expect((await submit(slug, fieldId, "garbage")).status).toBe(400);
  });

  it("doesn't validate format on an optional field left blank", async () => {
    const { slug } = await publishFormWithField({ minLength: 5 }, "TEXT", false);
    const res = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [] });
    expect(res.status).toBe(201);
  });
});
