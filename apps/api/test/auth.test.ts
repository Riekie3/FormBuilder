import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

const credentials = { name: "Ada Lovelace", email: "ada@example.com", password: "correcthorse123" };

describe("auth", () => {
  it("registers a new user and returns an access token + user profile", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/sfb_refresh=/);
  });

  it("rejects registering the same email twice", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(409);
  });

  it("rejects login with a wrong password", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token and rejects the old one on replay", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/auth/register").send(credentials);
    const originalCookie = registerRes.headers["set-cookie"];

    const refreshRes = await agent.post("/api/auth/refresh").send();
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf("string");

    // Replaying the pre-rotation cookie must now fail — it was revoked.
    const staleRes = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
    expect(staleRes.status).toBe(401);
  });

  it("rejects /me without a bearer token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the profile for /me with a valid bearer token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = registerRes.body.accessToken as string;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
  });
});
