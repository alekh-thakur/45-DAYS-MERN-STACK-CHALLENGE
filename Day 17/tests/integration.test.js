const request = require("supertest");
const app = require("../src/app.js");

describe("API integration", () => {
  test("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("POST /register with valid email", async () => {
    const res = await request(app).post("/register").send({ email: "a@b.com" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "User registered");
  });

  test("POST /register with invalid email", async () => {
    const res = await request(app).post("/register").send({ email: "bad-email" });
    expect(res.status).toBe(400);
  });
});
