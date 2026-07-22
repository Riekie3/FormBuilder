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

async function setupApprovalForm() {
  const admin = await registerUser("admin@example.com");
  await makeSuperAdmin(admin.userId);
  const approver = await registerUser("approver@example.com");
  const viewer = await registerUser("viewer@example.com");
  const outsider = await registerUser("outsider@example.com");

  const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
  const departmentId = dept.body.department.id as string;

  const approverRole = await auth(request(app).post("/api/admin/roles"), admin.token).send({
    name: "Approver",
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  });
  const roleId = approverRole.body.role.id as string;

  const viewerRole = await auth(request(app).post("/api/admin/roles"), admin.token).send({
    name: "Viewer",
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  });

  await auth(request(app).post("/api/admin/memberships"), admin.token).send({
    userId: approver.userId,
    departmentId,
    roleId,
  });
  // In the same department, but holding a different role than the one
  // assigned as this form's approver — can view, cannot decide.
  await auth(request(app).post("/api/admin/memberships"), admin.token).send({
    userId: viewer.userId,
    departmentId,
    roleId: viewerRole.body.role.id,
  });

  const formRes = await auth(request(app).post("/api/forms"), admin.token).send({ title: "Expense Request", departmentId });
  const formId = formRes.body.form.id as string;
  const slug = formRes.body.form.slug as string;

  await auth(request(app).put(`/api/forms/${formId}/fields`), admin.token).send({
    fields: [{ type: "TEXT", label: "Amount", required: true, order: 0, config: {} }],
  });
  const fieldsRes = await auth(request(app).get(`/api/forms/${formId}`), admin.token);
  const fieldId = fieldsRes.body.form.fields[0].id as string;

  await auth(request(app).patch(`/api/forms/${formId}`), admin.token).send({
    status: "PUBLISHED",
    requiresApproval: true,
    approverRoleId: roleId,
  });

  return { admin, approver, viewer, outsider, departmentId, roleId, formId, slug, fieldId };
}

describe("approval configuration", () => {
  it("rejects enabling approval on a form without a department", async () => {
    const { token } = await registerUser("solo@example.com");
    const formRes = await auth(request(app).post("/api/forms"), token).send({ title: "Private Form" });
    const formId = formRes.body.form.id as string;

    const res = await auth(request(app).patch(`/api/forms/${formId}`), token).send({ requiresApproval: true });
    expect(res.status).toBe(400);
  });

  it("rejects enabling approval without an approver role", async () => {
    const admin = await registerUser("admin2@example.com");
    await makeSuperAdmin(admin.userId);
    const dept = await auth(request(app).post("/api/admin/departments"), admin.token).send({ name: "Ops" });
    const formRes = await auth(request(app).post("/api/forms"), admin.token).send({
      title: "Dept Form",
      departmentId: dept.body.department.id,
    });

    const res = await auth(request(app).patch(`/api/forms/${formRes.body.form.id}`), admin.token).send({ requiresApproval: true });
    expect(res.status).toBe(400);
  });

  it("enables approval when department and role are both present", async () => {
    const { formId, admin, roleId } = await setupApprovalForm();
    const res = await auth(request(app).get(`/api/forms/${formId}`), admin.token);
    expect(res.body.form.requiresApproval).toBe(true);
    expect(res.body.form.approverRoleId).toBe(roleId);
  });
});

describe("submission status", () => {
  it("leaves status null for forms that don't require approval", async () => {
    const { token } = await registerUser("solo2@example.com");
    const formRes = await auth(request(app).post("/api/forms"), token).send({ title: "No Approval" });
    const formId = formRes.body.form.id as string;
    await auth(request(app).put(`/api/forms/${formId}/fields`), token).send({
      fields: [{ type: "TEXT", label: "Name", required: true, order: 0, config: {} }],
    });
    const fieldsRes = await auth(request(app).get(`/api/forms/${formId}`), token);
    const fieldId = fieldsRes.body.form.fields[0].id as string;
    await auth(request(app).patch(`/api/forms/${formId}`), token).send({ status: "PUBLISHED" });
    const slug = fieldsRes.body.form.slug as string;

    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "Ada" }] });

    const responsesRes = await auth(request(app).get(`/api/forms/${formId}/responses`), token);
    expect(responsesRes.body.responses[0].status).toBeNull();
  });

  it("sets status to PENDING for forms that require approval", async () => {
    const { admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });

    const responsesRes = await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token);
    expect(responsesRes.body.responses[0].status).toBe("PENDING");
  });
});

describe("deciding on a response", () => {
  it("lets the assigned approver role approve a pending response", async () => {
    const { approver, admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    const res = await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), approver.token).send({
      decision: "APPROVED",
      comment: "Looks good",
    });
    expect(res.status).toBe(200);
    expect(res.body.response.status).toBe("APPROVED");
    expect(res.body.response.decidedByName).toBe("approver");
    expect(res.body.response.decisionComment).toBe("Looks good");
  });

  it("hides the decision endpoint (404) from a user with no access to the form at all", async () => {
    const { outsider, admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    const res = await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), outsider.token).send({
      decision: "APPROVED",
    });
    expect(res.status).toBe(404);
  });

  it("rejects (403) a department member who can view the form but doesn't hold the approver role", async () => {
    const { viewer, admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    const res = await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), viewer.token).send({
      decision: "APPROVED",
    });
    expect(res.status).toBe(403);
  });

  it("lets the form owner decide even without holding the approver role", async () => {
    const { admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    const res = await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), admin.token).send({
      decision: "REJECTED",
    });
    expect(res.status).toBe(200);
    expect(res.body.response.status).toBe("REJECTED");
  });

  it("rejects deciding on a response that was already decided", async () => {
    const { approver, admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), approver.token).send({ decision: "APPROVED" });
    const secondRes = await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), approver.token).send({
      decision: "REJECTED",
    });
    expect(secondRes.status).toBe(409);
  });
});

describe("pending approvals dashboard", () => {
  it("lists pending responses only for forms the caller can decide on", async () => {
    const { approver, outsider, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });

    const approverRes = await auth(request(app).get("/api/forms/pending-approvals"), approver.token);
    expect(approverRes.body.pending).toHaveLength(1);
    expect(approverRes.body.pending[0].formId).toBe(formId);

    const outsiderRes = await auth(request(app).get("/api/forms/pending-approvals"), outsider.token);
    expect(outsiderRes.body.pending).toHaveLength(0);
  });

  it("removes a response from the pending list once decided", async () => {
    const { approver, admin, formId, slug, fieldId } = await setupApprovalForm();
    await request(app).post(`/api/public/forms/${slug}/responses`).send({ answers: [{ fieldId, value: "100" }] });
    const responseId = (await auth(request(app).get(`/api/forms/${formId}/responses`), admin.token)).body.responses[0].id;

    await auth(request(app).patch(`/api/forms/${formId}/responses/${responseId}/decision`), approver.token).send({ decision: "APPROVED" });

    const pendingRes = await auth(request(app).get("/api/forms/pending-approvals"), approver.token);
    expect(pendingRes.body.pending).toHaveLength(0);
  });
});
