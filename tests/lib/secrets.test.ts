import { afterEach, describe, expect, it, vi } from "vitest";
import { runSecret } from "@/lib/server/http";

afterEach(() => vi.unstubAllEnvs());

describe("runSecret", () => {
  it("prefers RUN_TOKEN_SECRET when set", () => {
    vi.stubEnv("RUN_TOKEN_SECRET", "explicit-run-secret-123456");
    vi.stubEnv("DB_SERVER_SECRET", "db-secret-abcdefghijklmnop");
    expect(runSecret()).toBe("explicit-run-secret-123456");
  });

  it("derives a distinct, stable key from DB_SERVER_SECRET when RUN_TOKEN_SECRET is unset", () => {
    vi.stubEnv("RUN_TOKEN_SECRET", "");
    vi.stubEnv("DB_SERVER_SECRET", "db-secret-abcdefghijklmnop");
    const a = runSecret();
    expect(a).toBe(runSecret());
    expect(a).not.toContain("db-secret");
    expect(a.length).toBeGreaterThanOrEqual(32);
    vi.stubEnv("DB_SERVER_SECRET", "another-db-secret-qrstuvwxyz");
    expect(runSecret()).not.toBe(a);
  });

  it("refuses to run in production without any secret", () => {
    vi.stubEnv("RUN_TOKEN_SECRET", "");
    vi.stubEnv("DB_SERVER_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => runSecret()).toThrow();
  });
});
