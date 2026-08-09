#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pinUpstream, runAudit, loadAuditReport } from "../src/audit.ts";
import { formatReportSummary, serializeJson } from "../src/manifest.ts";
import { repoRoot } from "../src/paths.ts";
import type { AuditReport } from "../src/schemas.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

const sha = arg("--sha") ?? process.env.UPSTREAM_SHA;
if (!sha) {
  console.error("Usage: update-upstream.ts --sha <new-immutable-sha>");
  process.exit(1);
}

const root = repoRoot();
const artifacts = join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });

let previous: AuditReport | null = null;
const prevPath = join(artifacts, "audit-report.json");
if (existsSync(prevPath)) {
  previous = loadAuditReport(root);
}

const oldCommit = previous?.upstream.commit ?? null;
const pin = pinUpstream({ sha });
const report = runAudit();

const prevIds = new Map(
  (previous?.problems ?? []).map((p) => [p.id, p] as const),
);
const nextIds = new Map(report.problems.map((p) => [p.id, p] as const));

const added = [...nextIds.keys()].filter((id) => !prevIds.has(id));
const removed = [...prevIds.keys()].filter((id) => !nextIds.has(id));
const modified: string[] = [];
const regressions: string[] = [];
const newlyVerified: string[] = [];
const newlyBlocked: string[] = [];
const newlyReview: string[] = [];

for (const [id, next] of nextIds) {
  const prev = prevIds.get(id);
  if (!prev) {
    if (next.decision.status === "VERIFIED_COMMERCIAL") newlyVerified.push(id);
    if (next.decision.status === "BLOCKED") newlyBlocked.push(id);
    if (next.decision.status === "REVIEW_REQUIRED") newlyReview.push(id);
    continue;
  }
  const prevKey = JSON.stringify({
    s: prev.decision.status,
    r: prev.decision.reasonCode,
    lic: prev.resolvedSource?.license,
    oer: prev.oatutor.oer,
  });
  const nextKey = JSON.stringify({
    s: next.decision.status,
    r: next.decision.reasonCode,
    lic: next.resolvedSource?.license,
    oer: next.oatutor.oer,
  });
  if (prevKey !== nextKey) {
    modified.push(id);
    if (
      prev.decision.status === "VERIFIED_COMMERCIAL" &&
      next.decision.status !== "VERIFIED_COMMERCIAL"
    ) {
      regressions.push(id);
    }
  }
}

const updateReport = {
  oldCommit,
  newCommit: pin.commit,
  scanned: report.counts.total,
  upstream: {
    added: added.length,
    removed: removed.length,
    modified: modified.length,
  },
  classificationOfAdditions: {
    VERIFIED_COMMERCIAL: newlyVerified.length,
    REVIEW_REQUIRED: newlyReview.length,
    BLOCKED: newlyBlocked.length,
  },
  regressions,
  counts: report.counts,
  reasonCounts: report.reasonCounts,
};

writeFileSync(
  join(artifacts, "update-report.json"),
  serializeJson(updateReport),
  "utf8",
);

const lines = [
  "OATutor verified-content update",
  "",
  "Source:",
  `  old: ${oldCommit ?? "(none)"}`,
  `  new: ${pin.commit}`,
  "",
  `Scanned: ${report.counts.total}`,
  "",
  "Upstream changes:",
  `  +${added.length} problems`,
  `  ~${modified.length} problems`,
  `  -${removed.length} problems`,
  "",
  "Classification of additions:",
  `  +${newlyVerified.length} VERIFIED_COMMERCIAL`,
  `  +${newlyReview.length} REVIEW_REQUIRED`,
  `  +${newlyBlocked.length} BLOCKED`,
  "",
  `Regressions (lost VERIFIED): ${regressions.length}`,
  ...regressions.slice(0, 20).map((id) => `  - ${id}`),
  "",
  formatReportSummary(report),
];

const text = lines.join("\n");
writeFileSync(join(artifacts, "update-report.txt"), text, "utf8");
console.log(text);
console.log("Wrote artifacts/update-report.json and update-report.txt");
console.log("No automatic merge — review and run make oatutor/build if OK.");
