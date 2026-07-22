import rateLimit from "express-rate-limit";
import { env } from "../env";

// Rate limiting is a production/dev concern — the test suite legitimately
// registers many users per file (e.g. approval-workflow tests each need
// several accounts), so it's skipped under NODE_ENV=test rather than forcing
// tests to throttle themselves or share state across `beforeEach` resets.
const skipInTests = () => env.NODE_ENV === "test";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: "Too many attempts. Please try again later." },
});

export const publicSubmissionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: "Too many submissions. Please slow down." },
});
