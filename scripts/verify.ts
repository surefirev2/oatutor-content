#!/usr/bin/env node
import { repoRoot } from "../src/paths.ts";
import { verifyRepository } from "../src/verify.ts";

const result = verifyRepository(repoRoot());
if (!result.ok) {
  console.error("verify failed:");
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("verify ok");
