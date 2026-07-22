import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

export const app = createApp();

export async function resetDb() {
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.field.deleteMany();
  await prisma.form.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function makeSuperAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: true } });
}
