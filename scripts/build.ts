#!/usr/bin/env node
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadAuditReport, runAudit } from "../src/audit.ts";
import { buildVerifiedTree } from "../src/build-tree.ts";
import {
  defaultUpstreamDir,
  loadSourcePin,
  repoRoot,
} from "../src/paths.ts";

const root = repoRoot();
const reportPath = join(root, "artifacts", "audit-report.json");
const report = existsSync(reportPath) ? loadAuditReport(root) : runAudit();
const pin = loadSourcePin(root);
const upstreamPool = join(defaultUpstreamDir(root), "content-pool");

const result = buildVerifiedTree({
  report,
  upstreamContentPool: upstreamPool,
  destContentPool: join(root, "content-pool"),
  manifestPath: join(root, "provenance", "approved-manifest.json"),
});

console.log(
  `Built verified tree: ${result.copied} bundles @ ${pin.commit ?? "unpinned"}`,
);
console.log(`Manifest: ${result.manifestPath}`);
