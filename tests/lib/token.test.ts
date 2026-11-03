import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "@/lib/server/token";

const SECRET = "test-secret-0123456789";

describe("signed tokens", () => {
  const payload = { v: 1, date: "2026-11-03", device: "dev-1", actions: [{ t: "respin" }] };

  it("round-trips a payload", () => {
    expect(verifyToken(signToken(payload, SECRET), SECRET)).toEqual(payload);
  });

  it("rejects a tampered payload", () => {
    const t = signToken(payload, SECRET);
    const [body, sig] = t.split(".");
    const flipped = body.slice(0, -2) + (body.at(-2) === "A" ? "B" : "A") + body.at(-1);
    expect(verifyToken(`${flipped}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects the wrong secret and garbage", () => {
    expect(verifyToken(signToken(payload, SECRET), "other-secret")).toBeNull();
    expect(verifyToken("not-a-token", SECRET)).toBeNull();
    expect(verifyToken("", SECRET)).toBeNull();
  });

  it("keeps the original date, so a run started before midnight finishes on its own day", () => {
    const yesterday = { ...payload, date: "2026-11-02" };
    expect(verifyToken<typeof yesterday>(signToken(yesterday, SECRET), SECRET)?.date).toBe("2026-11-02");
  });
});
