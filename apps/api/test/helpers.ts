import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

export const app = createApp();

export async function resetDb() {
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.field.deleteMany();
  await prisma.form.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
