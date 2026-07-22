import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo1234!", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@smartformbuilder.dev" },
    update: { isSuperAdmin: true },
    create: {
      name: "Demo User",
      email: "demo@smartformbuilder.dev",
      passwordHash,
      isSuperAdmin: true,
    },
  });

  const colleague = await prisma.user.upsert({
    where: { email: "colleague@smartformbuilder.dev" },
    update: {},
    create: {
      name: "Colleague User",
      email: "colleague@smartformbuilder.dev",
      passwordHash,
    },
  });

  const operations = await prisma.department.upsert({
    where: { name: "Operations" },
    update: {},
    create: { name: "Operations" },
  });

  await prisma.role.upsert({
    where: { name: "Viewer" },
    update: {},
    create: { name: "Viewer", canView: true, canCreate: false, canEdit: false, canDelete: false },
  });

  const editorRole = await prisma.role.upsert({
    where: { name: "Editor" },
    update: {},
    create: { name: "Editor", canView: true, canCreate: true, canEdit: true, canDelete: false },
  });

  await prisma.role.upsert({
    where: { name: "Manager" },
    update: {},
    create: { name: "Manager", canView: true, canCreate: true, canEdit: true, canDelete: true },
  });

  const approverRole = await prisma.role.upsert({
    where: { name: "Approver" },
    update: {},
    create: { name: "Approver", canView: true, canCreate: false, canEdit: false, canDelete: false },
  });

  await prisma.membership.upsert({
    where: {
      userId_departmentId_roleId: { userId: colleague.id, departmentId: operations.id, roleId: editorRole.id },
    },
    update: {},
    create: { userId: colleague.id, departmentId: operations.id, roleId: editorRole.id },
  });

  // Colleague holds two roles in the same department at once — demonstrates
  // the multi-role-per-department model, and lets them both edit and approve
  // the seeded Contact Us form below.
  await prisma.membership.upsert({
    where: {
      userId_departmentId_roleId: { userId: colleague.id, departmentId: operations.id, roleId: approverRole.id },
    },
    update: {},
    create: { userId: colleague.id, departmentId: operations.id, roleId: approverRole.id },
  });

  const existingForm = await prisma.form.findFirst({ where: { ownerId: user.id, slug: "contact-us-demo" } });
  if (existingForm && (!existingForm.departmentId || !existingForm.requiresApproval)) {
    await prisma.form.update({
      where: { id: existingForm.id },
      data: { departmentId: operations.id, requiresApproval: true, approverRoleId: approverRole.id },
    });
  }
  if (!existingForm) {
    await prisma.form.create({
      data: {
        title: "Contact Us",
        description: "A simple contact form — reach out and we'll get back to you.",
        slug: "contact-us-demo",
        status: "PUBLISHED",
        ownerId: user.id,
        departmentId: operations.id,
        requiresApproval: true,
        approverRoleId: approverRole.id,
        fields: {
          create: [
            { type: "TEXT", label: "Full Name", required: true, order: 0, config: { placeholder: "Jane Doe" } },
            { type: "EMAIL", label: "Email Address", required: true, order: 1, config: { placeholder: "jane@example.com" } },
            { type: "PHONE", label: "Phone Number", required: false, order: 2, config: { placeholder: "+1 555 123 4567" } },
            {
              type: "DROPDOWN",
              label: "Reason for Contact",
              required: true,
              order: 3,
              config: {
                options: [
                  { id: "sales", label: "Sales Inquiry", value: "sales" },
                  { id: "support", label: "Support Request", value: "support" },
                  { id: "other", label: "Other", value: "other" },
                ],
              },
            },
            { type: "PARAGRAPH", label: "Message", required: true, order: 4, config: { placeholder: "How can we help?" } },
          ],
        },
      },
    });
  }

  await prisma.template.upsert({
    where: { id: "template-contact-form" },
    update: {},
    create: {
      id: "template-contact-form",
      name: "Contact Form",
      description: "Collect name, email, and a message from site visitors.",
      category: "General",
      fields: [
        { type: "TEXT", label: "Full Name", required: true, order: 0, config: { placeholder: "Jane Doe" } },
        { type: "EMAIL", label: "Email Address", required: true, order: 1, config: { placeholder: "jane@example.com" } },
        { type: "PARAGRAPH", label: "Message", required: true, order: 2, config: { placeholder: "How can we help?" } },
      ],
    },
  });

  console.log("Seed complete.");
  console.log("Super admin login: demo@smartformbuilder.dev / Demo1234!");
  console.log("Editor + Approver (Operations dept) login: colleague@smartformbuilder.dev / Demo1234!");
  console.log('Contact Us requires approval — submit it publicly, then approve/reject from "Approvals" as colleague.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
