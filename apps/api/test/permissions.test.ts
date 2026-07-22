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

describe("admin routes", () => {
  it("rejects a non-admin from managing departments and roles", async () => {
    const { token } = await registerUser("regular@example.com");
    const res = await auth(request(app).get("/api/admin/departments"), token);
    expect(res.status).toBe(403);
  });

  it("lets a super admin create departments and roles", async () => {
    const { userId, token } = await registerUser("admin@example.com");
    await makeSuperAdmin(userId);

    const deptRes = await auth(request(app).post("/api/admin/departments"), token).send({ name: "Ops" });
    expect(deptRes.status).toBe(201);

    const roleRes = await auth(request(app).post("/api/admin/roles"), token).send({
      name: "Editor",
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });
    expect(roleRes.status).toBe(201);
  });
});

describe("department-wide form access", () => {
  async function setupDeptWithMember(editorPerms: { canCreate: boolean; canEdit: boolean; canDelete: boolean }) {
    const admin = await registerUser("admin2@example.com");
    await makeSuperAdmin(admin.userId);
    const member = await registerUser("member@example.com");

    const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
    const departmentId = dept.body.department.id as string;

    const role = await auth(request(app).post("/api/admin/roles"), admin.token).send({
      name: "Editor",
      canView: true,
      ...editorPerms,
    });
    const roleId = role.body.role.id as string;

    await auth(request(app).post("/api/admin/memberships"), admin.token).send({
      userId: member.userId,
      departmentId,
      roleId,
    });

    const formRes = await auth(request(app).post("/api/forms"), admin.token).send({ title: "Dept Form", departmentId });
    const formId = formRes.body.form.id as string;

    return { admin, member, departmentId, formId };
  }

  it("lets a department member view and edit, per their role's permissions", async () => {
    const { member, formId } = await setupDeptWithMember({ canCreate: true, canEdit: true, canDelete: false });

    const viewRes = await auth(request(app).get(`/api/forms/${formId}`), member.token);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.form.canEdit).toBe(true);
    expect(viewRes.body.form.canDelete).toBe(false);

    const editRes = await auth(request(app).patch(`/api/forms/${formId}`), member.token).send({ title: "Renamed" });
    expect(editRes.status).toBe(200);

    const deleteRes = await auth(request(app).delete(`/api/forms/${formId}`), member.token);
    expect(deleteRes.status).toBe(403);
  });

  it("includes department forms in the member's form list", async () => {
    const { member, formId } = await setupDeptWithMember({ canCreate: false, canEdit: false, canDelete: false });

    const listRes = await auth(request(app).get("/api/forms"), member.token);
    expect(listRes.status).toBe(200);
    expect(listRes.body.forms.map((f: { id: string }) => f.id)).toContain(formId);
  });

  it("hides the form entirely from a user with no membership in that department", async () => {
    const { formId } = await setupDeptWithMember({ canCreate: false, canEdit: false, canDelete: false });
    const outsider = await registerUser("outsider@example.com");

    const viewRes = await auth(request(app).get(`/api/forms/${formId}`), outsider.token);
    expect(viewRes.status).toBe(404);

    const listRes = await auth(request(app).get("/api/forms"), outsider.token);
    expect(listRes.body.forms.map((f: { id: string }) => f.id)).not.toContain(formId);
  });

  it("rejects creating a form in a department without canCreate", async () => {
    const { member, departmentId } = await setupDeptWithMember({ canCreate: false, canEdit: false, canDelete: false });

    const res = await auth(request(app).post("/api/forms"), member.token).send({ title: "Nope", departmentId });
    expect(res.status).toBe(403);
  });

  it("still lets anyone create a private (no-department) form", async () => {
    const { member } = await setupDeptWithMember({ canCreate: false, canEdit: false, canDelete: false });

    const res = await auth(request(app).post("/api/forms"), member.token).send({ title: "My private form" });
    expect(res.status).toBe(201);
    expect(res.body.form.departmentId).toBeNull();
  });
});
