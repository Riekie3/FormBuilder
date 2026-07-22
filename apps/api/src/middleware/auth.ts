import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";

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
