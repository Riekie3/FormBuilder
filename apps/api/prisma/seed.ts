import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo1234!", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@smartformbuilder.dev" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@smartformbuilder.dev",
      passwordHash,
    },
  });

  const existingForm = await prisma.form.findFirst({ where: { ownerId: user.id, slug: "contact-us-demo" } });
  if (!existingForm) {
    await prisma.form.create({
      data: {
        title: "Contact Us",
        description: "A simple contact form — reach out and we'll get back to you.",
        slug: "contact-us-demo",
        status: "PUBLISHED",
        ownerId: user.id,
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

  console.log("Seed complete. Demo login: demo@smartformbuilder.dev / Demo1234!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
