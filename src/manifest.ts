import type { AuditRecord, AuditReport, ApprovedManifest } from "./schemas.ts";
import { hostPathKey } from "./parse-oer-url.ts";

function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, replacer, 2)}\n`;
}

function replacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = obj[k];
    }
    return sorted;
  }
  return value;
}

export function serializeJson(value: unknown): string {
  return stableStringify(value);
}

export function buildAuditReport(input: {
  policyVersion: string;
  repository: string;
  commit: string | null;
  auditedAt: string;
  problems: AuditRecord[];
}): AuditReport {
  const sorted = [...input.problems].sort((a, b) => a.id.localeCompare(b.id));
  const counts = {
    total: sorted.length,
    VERIFIED_COMMERCIAL: 0,
    REVIEW_REQUIRED: 0,
    BLOCKED: 0,
  };
  const reasonCounts: Record<string, number> = {};
  const unresolved = new Map<string, number>();

  for (const p of sorted) {
    counts[p.decision.status] += 1;
    reasonCounts[p.decision.reasonCode] =
      (reasonCounts[p.decision.reasonCode] ?? 0) + 1;
    if (
      p.decision.status === "REVIEW_REQUIRED" &&
      (p.decision.reasonCode === "unknown-source" ||
        p.decision.reasonCode === "ambiguous-edition")
    ) {
      const key =
        hostPathKey(p.oatutor.sourceUrl) ?? p.decision.detail ?? "unknown";
      unresolved.set(key, (unresolved.get(key) ?? 0) + 1);
    }
  }

  const unresolvedSourcePatterns = [...unresolved.entries()]
    .map(([hostPath, count]) => ({ hostPath, count }))
    .sort((a, b) => b.count - a.count || a.hostPath.localeCompare(b.hostPath));

  return {
    policyVersion: input.policyVersion,
    upstream: {
      repository: input.repository,
      commit: input.commit,
    },
    auditedAt: input.auditedAt,
    counts,
    reasonCounts,
    unresolvedSourcePatterns,
    problems: sorted,
  };
}

export function buildApprovedManifest(
  report: AuditReport,
  generatedAt: string,
): ApprovedManifest {
  const problems = report.problems
    .filter((p) => p.decision.status === "VERIFIED_COMMERCIAL")
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    policyVersion: report.policyVersion,
    upstream: report.upstream,
    generatedAt,
    problems,
  };
}

export function formatReportSummary(report: AuditReport): string {
  const lines: string[] = [];
  const commit = report.upstream.commit ?? "(unpinned)";
  lines.push(`Upstream: ${report.upstream.repository} @ ${commit}`);
  lines.push("");
  lines.push(`Problems scanned:       ${report.counts.total}`);
  lines.push("");
  lines.push(
    `VERIFIED_COMMERCIAL:     ${report.counts.VERIFIED_COMMERCIAL}`,
  );
  lines.push(`REVIEW_REQUIRED:         ${report.counts.REVIEW_REQUIRED}`);
  lines.push(`BLOCKED:                 ${report.counts.BLOCKED}`);
  lines.push("");
  lines.push("Reasons:");
  const reasons = Object.entries(report.reasonCounts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  for (const [code, n] of reasons) {
    lines.push(`  ${code.padEnd(32)} ${n}`);
  }
  if (report.unresolvedSourcePatterns.length) {
    lines.push("");
    lines.push("Top unresolved source patterns:");
    for (const row of report.unresolvedSourcePatterns.slice(0, 25)) {
      lines.push(`  ${String(row.count).padStart(5)}  ${row.hostPath}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
