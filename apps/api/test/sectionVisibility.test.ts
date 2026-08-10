import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb } from "./helpers";

let accessToken: string;

beforeEach(async () => {
  await resetDb();
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Ada Lovelace", email: "ada@example.com", password: "correcthorse123" });
  accessToken = res.body.accessToken;
});

function auth(req: request.Test) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

// Builds: a Dropdown trigger -> a Section conditioned on it ("employed" =
// "yes") -> a required Employer field inside the section -> a Page Break ->
// a required field after the break, outside the section's scope entirely.
// Field ids aren't known until creation, so the section's condition is
// attached in a second PUT once the trigger field's real id exists.
async function buildForm() {
  const createRes = await auth(request(app).post("/api/forms")).send({ title: "Section Test" });
  const formId = createRes.body.form.id as string;
  const slug = createRes.body.form.slug as string;

  const firstPass = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
    fields: [
      {
        type: "DROPDOWN",
        label: "Are you employed?",
        required: true,
        order: 0,
        config: { options: [{ id: "yes", label: "Yes", value: "yes" }, { id: "no", label: "No", value: "no" }] },
      },
      { type: "SECTION", label: "Employment details", required: false, order: 1, config: {} },
      { type: "TEXT", label: "Employer name", required: true, order: 2, config: {} },
      { type: "PAGE_BREAK", label: "", required: false, order: 3, config: {} },
      { type: "TEXT", label: "Additional comments", required: true, order: 4, config: {} },
    ],
  });
  const [trigger, section, employer, pageBreak, afterBreak] = firstPass.body.fields;

  const secondPass = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
    fields: [
      { id: trigger.id, type: trigger.type, label: trigger.label, required: trigger.required, order: 0, config: trigger.config },
      {
        id: section.id,
        type: "SECTION",
        label: "Employment details",
        required: false,
        order: 1,
        config: { conditions: [{ fieldId: trigger.id, operator: "equals", value: "yes" }] },
      },
      { id: employer.id, type: "TEXT", label: "Employer name", required: true, order: 2, config: {} },
      { id: pageBreak.id, type: "PAGE_BREAK", label: "", required: false, order: 3, config: {} },
      { id: afterBreak.id, type: "TEXT", label: "Additional comments", required: true, order: 4, config: {} },
    ],
  });
  const fields = secondPass.body.fields;

  await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

  return {
    slug,
    triggerFieldId: trigger.id as string,
    employerFieldId: employer.id as string,
    afterBreakFieldId: fields[4].id as string,
  };
}

// A Section field's own `config.conditions` gates every field that follows
// it, up to the next Section or Page Break — this lets a form builder hide
// a whole group of questions behind one condition instead of repeating it
// on each field. Verified directly against the public submission endpoint
// (bypassing the client entirely), same approach used for Phase 4b's plain
// per-field conditional logic and Phase 4g's validation rules.
describe("section-level conditional visibility", () => {
  it("exempts every field inside a hidden section from required-validation", async () => {
    const { slug, triggerFieldId, afterBreakFieldId } = await buildForm();

    // Section's condition ("employed" equals "yes") is false — the visitor
    // answered "no" — so Employer name is exempted even though it's marked
    // required. The field after the page break is still required and provided.
    const res = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [
          { fieldId: triggerFieldId, value: "no" },
          { fieldId: afterBreakFieldId, value: "n/a" },
        ],
      });

    expect(res.status).toBe(201);
  });

  it("still requires fields inside a section whose condition is met", async () => {
    const { slug, triggerFieldId, employerFieldId, afterBreakFieldId } = await buildForm();

    // Section's condition is met ("yes") — Employer name is required and missing.
    const rejected = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [
          { fieldId: triggerFieldId, value: "yes" },
          { fieldId: afterBreakFieldId, value: "n/a" },
        ],
      });
    expect(rejected.status).toBe(400);

    // Filling it in succeeds.
    const accepted = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({
        answers: [
          { fieldId: triggerFieldId, value: "yes" },
          { fieldId: employerFieldId, value: "Acme Corp" },
          { fieldId: afterBreakFieldId, value: "n/a" },
        ],
      });
    expect(accepted.status).toBe(201);
  });

  it("resets a section's scope at a Page Break — fields after it are unaffected", async () => {
    // A dedicated, minimal form: a Section that's always hidden (its
    // condition references a field id that doesn't exist, so it can never
    // match) containing a required field, then a Page Break, then another
    // required field that is NOT inside any section. If the "section open"
    // state leaked past the Page Break instead of resetting there, this
    // second field would be wrongly exempted too.
    const createRes = await auth(request(app).post("/api/forms")).send({ title: "Section Reset Test" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;

    const fieldsRes = await auth(request(app).put(`/api/forms/${formId}/fields`)).send({
      fields: [
        {
          type: "SECTION",
          label: "Hidden section",
          required: false,
          order: 0,
          config: { conditions: [{ fieldId: "does-not-exist", operator: "equals", value: "never-matches" }] },
        },
        { type: "TEXT", label: "Inside hidden section", required: true, order: 1, config: {} },
        { type: "PAGE_BREAK", label: "", required: false, order: 2, config: {} },
        { type: "TEXT", label: "After the page break", required: true, order: 3, config: {} },
      ],
    });
    const afterBreakField = fieldsRes.body.fields[3];
    await auth(request(app).patch(`/api/forms/${formId}`)).send({ status: "PUBLISHED" });

    // The field outside the section is still required and missing.
    const rejected = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [] });
    expect(rejected.status).toBe(400);

    // Providing it succeeds — the hidden section's own required field never
    // blocks submission, and the field after the break was correctly
    // treated as its own, unexempted question.
    const accepted = await request(app)
      .post(`/api/public/forms/${slug}/responses`)
      .send({ answers: [{ fieldId: afterBreakField.id, value: "hello" }] });
    expect(accepted.status).toBe(201);
  });
});
