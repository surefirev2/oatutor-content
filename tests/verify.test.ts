import { describe, expect, it } from "vitest";
import { repoRoot } from "../src/paths.ts";
import { verifyRepository } from "../src/verify.ts";

describe("verify repository invariants", () => {
  it("passes for committed content-pool + approved-manifest", () => {
    const result = verifyRepository(repoRoot());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
