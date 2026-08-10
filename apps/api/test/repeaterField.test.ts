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

async function publishFormWithRepeater(required: boolean) {
  const createRes = await auth(request(app).post("/api/forms")).send({ title: "Repeater Test" });
  const formId = createRes.body.form.id as string;
  const slug = createRes.body.form.slug as string;

  const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
    fields: [
      {
        type: "REPEATER",
        label: "Line Items",
        required,
        order: 0,
        config: {
          repeaterColumns: [
            { id: "col-item", label: "Item", value: "item" },
            { id: "col-qty", label: "Quantity", value: "quantity" },
          ],
        },
      },
    ],
  });
  const fieldId = fieldsRes.body.fields[0].id as string;
  await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

  return { formId, slug, fieldId };
}

describe("Repeater (line items) field", () => {
  it("rejects a required Repeater with no rows and accepts one with at least one", async () => {
    const { slug, fieldId } = await publishFormWithRepeater(true);

    const emptyRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [{ fieldId, value: "[]" }] });
    expect(emptyRes.status).toBe(400);

    const filledRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [{ fieldId, value: JSON.stringify([{ "col-item": "Widget", "col-qty": "3" }]) }],
      });
    expect(filledRes.status).toBe(201);
  });

  it("doesn't require any rows when the field itself is optional", async () => {
    const { slug } = await publishFormWithRepeater(false);
    const res = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [] });
    expect(res.status).toBe(201);
  });

  it("stores and returns the row data as submitted, including multiple rows", async () => {
    const { formId, slug, fieldId } = await publishFormWithRepeater(true);
    const rows = [
      { "col-item": "Widget", "col-qty": "3" },
      { "col-item": "Gadget", "col-qty": "1" },
    ];

    const submitRes = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [{ fieldId, value: JSON.stringify(rows) }] });
    expect(submitRes.status).toBe(201);

    const responsesRes = await auth(request(app).get(`/api/forms/${formId}/responses`));
    const stored = JSON.parse(responsesRes.body.responses[0].answers[0].value);
    expect(stored).toEqual(rows);
  });
});
