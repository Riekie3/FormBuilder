import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeSuperAdmin, resetDb } from "./helpers";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: email.split("@")[0], email, password: "correcthorse123" });
  return { userId: res.body.user.id as string, token: res.body.accessToken as string };
}

function auth(req: request.Test, token: string) {
  return req.set("Authorization", `Bearer ${token}`);
}

beforeEach(async () => {
  await resetDb();
});

describe("exporting a form", () => {
  it("returns a portable JSON snapshot excluding instance-specific data", async () => {
    const owner = await registerUser("owner@example.com");
    const createRes = await auth(request(app).post("/api/forms"), owner.token).send({ title: "Feedback" });
    const formId = createRes.body.form.id as string;

    await auth(request(app).put(`/api/forms/${formId}/fields`), owner.token).send({
      fields: [
        { type: "TEXT", label: "Name", required: true, order: 0, config: { placeholder: "Jane" } },
        { type: "RATING", label: "Score", required: false, order: 1, config: { maxRating: 10 } },
      ],
    });

    const res = await auth(request(app).get(`/api/forms/${formId}/export`), owner.token);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toMatch(/\.json"?$/);

    const body = JSON.parse(res.text);
    expect(body.kind).toBe("smart-form-builder-export");
    expect(body.title).toBe("Feedback");
    expect(body.fields).toHaveLength(2);
    expect(body.fields[0]).toMatchObject({ type: "TEXT", label: "Name", required: true, config: { placeholder: "Jane" } });
    expect(body.fields[1]).toMatchObject({ type: "RATING", label: "Score", config: { maxRating: 10 } });

    // Nothing instance-specific leaks into a portable export.
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("slug");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("departmentId");
    expect(body).not.toHaveProperty("requiresApproval");
    expect(body).not.toHaveProperty("approverRoleId");
    expect(body.fields[0]).not.toHaveProperty("id");
  });

  it("404s for a user with no access to the form", async () => {
    const owner = await registerUser("owner2@example.com");
    const outsider = await registerUser("outsider@example.com");
    const createRes = await auth(request(app).post("/api/forms"), owner.token).send({ title: "Private" });
    const formId = createRes.body.form.id as string;

    const res = await auth(request(app).get(`/api/forms/${formId}/export`), outsider.token);
    expect(res.status).toBe(404);
  });
});

describe("importing a form", () => {
  it("round-trips an exported form's fields into a new, always-private Draft", async () => {
    const admin = await registerUser("admin@example.com");
    await makeSuperAdmin(admin.userId);

    const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
    const departmentId = dept.body.department.id as string;
    const createRes = await auth(request(app).post("/api/forms"), admin.token).send({ title: "Survey", departmentId });
    const formId = createRes.body.form.id as string;

    await auth(request(app).put(`/api/forms/${formId}/fields`), admin.token).send({
      fields: [
        { type: "TEXT", label: "Name", required: true, order: 0, config: {} },
        { type: "DROPDOWN", label: "Team", required: true, order: 1, config: { options: [{ id: "a", label: "A", value: "a" }] } },
      ],
    });
    await auth(request(app).patch(`/api/forms/${formId}`), admin.token).send({ status: "PUBLISHED" });

    const exportRes = await auth(request(app).get(`/api/forms/${formId}/export`), admin.token);
    const exported = JSON.parse(exportRes.text);

    const importer = await registerUser("importer@example.com");
    const importRes = await auth(request(app).post("/api/forms/import"), importer.token).send(exported);
    expect(importRes.status).toBe(201);
    expect(importRes.body.form.title).toBe("Survey");
    // Always private and a draft — a department/role id from the exporting
    // account means nothing here, and the importer never published anything.
    expect(importRes.body.form.status).toBe("DRAFT");
    expect(importRes.body.form.departmentId).toBeNull();
    expect(importRes.body.form.requiresApproval).toBe(false);

    const detail = await auth(request(app).get(`/api/forms/${importRes.body.form.id}`), importer.token);
    expect(detail.body.form.fields).toHaveLength(2);
    expect(detail.body.form.fields[0]).toMatchObject({ type: "TEXT", label: "Name", required: true });
    expect(detail.body.form.fields[1]).toMatchObject({ type: "DROPDOWN", label: "Team" });
    expect(detail.body.form.fields[1].config.options[0]).toMatchObject({ label: "A", value: "a" });
  });

  it("rejects a file that isn't a valid export", async () => {
    const user = await registerUser("user@example.com");

    const missingKind = await auth(request(app).post("/api/forms/import"), user.token).send({
      title: "Whatever",
      fields: [],
    });
    expect(missingKind.status).toBe(400);

    const wrongKind = await auth(request(app).post("/api/forms/import"), user.token).send({
      kind: "some-other-format",
      version: 1,
      title: "Whatever",
      fields: [],
    });
    expect(wrongKind.status).toBe(400);

    const randomJson = await auth(request(app).post("/api/forms/import"), user.token).send({ hello: "world" });
    expect(randomJson.status).toBe(400);
  });
});
