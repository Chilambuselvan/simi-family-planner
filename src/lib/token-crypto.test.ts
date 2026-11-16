import { describe, expect, it } from "vitest";
import { decryptWith, encryptWith } from "./token-crypto";

describe("token encryption", () => {
  it("round-trips and never stores the plaintext", () => {
    const enc = encryptWith("k1", "1//refresh-token");
    expect(enc).not.toContain("refresh-token");
    expect(decryptWith("k1", enc)).toBe("1//refresh-token");
  });
  it("fails with the wrong key", () => {
    expect(() => decryptWith("k2", encryptWith("k1", "x"))).toThrow();
  });
  it("passes through legacy plaintext values", () => {
    expect(decryptWith("k1", "ya29.legacy")).toBe("ya29.legacy");
  });
});
