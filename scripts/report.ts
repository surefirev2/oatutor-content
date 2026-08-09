#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAuditReport, runAudit } from "../src/audit.ts";
import { formatReportSummary } from "../src/manifest.ts";
import { repoRoot } from "../src/paths.ts";

const root = repoRoot();
const path = join(root, "artifacts", "audit-report.json");
const report = existsSync(path) ? loadAuditReport(root) : runAudit();
console.log(formatReportSummary(report));
