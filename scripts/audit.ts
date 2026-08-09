#!/usr/bin/env node
import { runAudit } from "../src/audit.ts";
import { formatReportSummary } from "../src/manifest.ts";

const report = runAudit();
console.log(formatReportSummary(report));
console.log("Wrote artifacts/audit-report.json");
