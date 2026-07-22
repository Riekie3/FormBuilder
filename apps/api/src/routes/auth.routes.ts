import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../lib/jwt";
import { generateOpaqueToken, sha256Hex } from "../lib/hash";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";
import { env } from "../env";
import type { AuthUserDto } from "@sfb/shared";

export const authRouter = Router();

const REFRESH_COOKIE_NAME = "sfb_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function issueTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256Hex(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

function toAuthUserDto(user: { id: string; name: string; email: string }): AuthUserDto {
  return { id: user.id, name: user.name, email: user.email };
}

authRouter.post(
  "/register",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, "An account with that email already exists");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash },
    });

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.status(201).json({ user: toAuthUserDto(user), accessToken });
  }),
);

authRouter.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, "Invalid email or password");
    }

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ user: toAuthUserDto(user), accessToken });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new HttpError(401, "Missing refresh token");
    }

    const tokenHash = sha256Hex(token);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      throw new HttpError(401, "Refresh token is invalid or expired");
    }

    // Rotate: revoke the used token and issue a fresh pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new HttpError(401, "Account no longer exists");
    }

    const { accessToken, refreshToken } = await issueTokens(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ user: toAuthUserDto(user), accessToken });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      const tokenHash = sha256Hex(token);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    res.status(204).send();
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    res.json({ user: toAuthUserDto(user) });
  }),
);
