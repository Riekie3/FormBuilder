import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { formsRouter } from "./routes/forms.routes";
import { publicRouter } from "./routes/public.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/forms", formsRouter);
  app.use("/api/public", publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
