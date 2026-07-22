import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { isSuperAdmin } from "../lib/permissions";
import { asyncHandler, HttpError } from "./errorHandler";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing access token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

// Must run after requireAuth.
export const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  const ok = await isSuperAdmin(req.userId!);
  if (!ok) {
    throw new HttpError(403, "Admin access required");
  }
  next();
});
