#!/usr/bin/env node
import { pinUpstream } from "../src/audit.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

const sha = arg("--sha") ?? process.env.UPSTREAM_SHA;
if (!sha) {
  console.error("Usage: pin.ts --sha <immutable-commit-sha>");
  process.exit(1);
}

const result = pinUpstream({ sha });
console.log(`Pinned upstream @ ${result.commit}`);
console.log(`Clone: ${result.dir}`);
