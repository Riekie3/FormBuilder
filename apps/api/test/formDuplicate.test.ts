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

describe("duplicating a form", () => {
  it("clones fields and settings into a new, always-DRAFT form owned by the caller", async () => {
    const owner = await registerUser("owner@example.com");

    const createRes = await auth(request(app).post("/api/forms"), owner.token).send({ title: "Original" });
    const formId = createRes.body.form.id as string;

    await auth(request(app).put(`/api/forms/${formId}/fields`), owner.token).send({
      fields: [
        { type: "TEXT", label: "Name", required: true, order: 0, config: { placeholder: "Jane" } },
        { type: "EMAIL", label: "Email", required: true, order: 1, config: {} },
      ],
    });
    await auth(request(app).patch(`/api/forms/${formId}`), owner.token).send({ status: "PUBLISHED" });

    const dupRes = await auth(request(app).post(`/api/forms/${formId}/duplicate`), owner.token);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.form.title).toBe("Original (copy)");
    // Cloning a published form never publishes the copy too.
    expect(dupRes.body.form.status).toBe("DRAFT");
    expect(dupRes.body.form.responseCount).toBe(0);

    const dupId = dupRes.body.form.id as string;
    const dupDetail = await auth(request(app).get(`/api/forms/${dupId}`), owner.token);
    const dupFields = dupDetail.body.form.fields;
    expect(dupFields).toHaveLength(2);
    expect(dupFields[0]).toMatchObject({ type: "TEXT", label: "Name", required: true, config: { placeholder: "Jane" } });
    expect(dupFields[1]).toMatchObject({ type: "EMAIL", label: "Email", required: true });
    // A real field id, distinct from the source's — not a shared reference.
    const sourceDetail = await auth(request(app).get(`/api/forms/${formId}`), owner.token);
    expect(dupFields[0].id).not.toBe(sourceDetail.body.form.fields[0].id);
  });

  it("doesn't copy the source form's responses", async () => {
    const owner = await registerUser("owner2@example.com");
    const createRes = await auth(request(app).post("/api/forms"), owner.token).send({ title: "Has responses" });
    const formId = createRes.body.form.id as string;
    const slug = createRes.body.form.slug as string;

    await auth(request(app).put(`/api/forms/${formId}/fields`), owner.token).send({
      fields: [{ type: "TEXT", label: "Name", required: false, order: 0, config: {} }],
    });
    await auth(request(app).patch(`/api/forms/${formId}`), owner.token).send({ status: "PUBLISHED" });
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [] });

    const dupRes = await auth(request(app).post(`/api/forms/${formId}/duplicate`), owner.token);
    expect(dupRes.body.form.responseCount).toBe(0);
  });

  it("keeps department and approval config when the caller can still create there", async () => {
    const admin = await registerUser("admin3@example.com");
    await makeSuperAdmin(admin.userId);

    const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
    const departmentId = dept.body.department.id as string;
    const role = await auth(request(app).post("/api/admin/roles"), admin.token).send({
      name: "Approver",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
    const roleId = role.body.role.id as string;

    const formRes = await auth(request(app).post("/api/forms"), admin.token).send({ title: "Dept form", departmentId });
    const formId = formRes.body.form.id as string;
    await auth(request(app).patch(`/api/forms/${formId}`), admin.token).send({
      requiresApproval: true,
      approverRoleId: roleId,
    });

    // The super admin can create anywhere, so the duplicate keeps the department and approval config.
    const dupRes = await auth(request(app).post(`/api/forms/${formId}/duplicate`), admin.token);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.form.departmentId).toBe(departmentId);
    expect(dupRes.body.form.requiresApproval).toBe(true);
    expect(dupRes.body.form.approverRoleId).toBe(roleId);
  });

  it("falls back to a private draft when the caller can view but can't create in that department", async () => {
    const admin = await registerUser("admin4@example.com");
    await makeSuperAdmin(admin.userId);
    const viewer = await registerUser("viewer@example.com");

    const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
    const departmentId = dept.body.department.id as string;
    const viewerRole = await auth(request(app).post("/api/admin/roles"), admin.token).send({
      name: "Viewer",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
    await auth(request(app).post("/api/admin/memberships"), admin.token).send({
      userId: viewer.userId,
      departmentId,
      roleId: viewerRole.body.role.id,
    });

    const formRes = await auth(request(app).post("/api/forms"), admin.token).send({ title: "Dept form", departmentId });
    const formId = formRes.body.form.id as string;

    // A view-only member can still duplicate the form (it doesn't touch the
    // original) — but the clone can't carry a department they can't create in.
    const dupRes = await auth(request(app).post(`/api/forms/${formId}/duplicate`), viewer.token);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.form.departmentId).toBeNull();
    expect(dupRes.body.form.requiresApproval).toBe(false);
  });

  it("404s for a user with no access to the source form at all", async () => {
    const owner = await registerUser("owner3@example.com");
    const outsider = await registerUser("outsider2@example.com");
    const createRes = await auth(request(app).post("/api/forms"), owner.token).send({ title: "Private" });
    const formId = createRes.body.form.id as string;

    const res = await auth(request(app).post(`/api/forms/${formId}/duplicate`), outsider.token);
    expect(res.status).toBe(404);
  });
});
