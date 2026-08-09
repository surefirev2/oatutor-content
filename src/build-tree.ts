import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AuditReport } from "./schemas.ts";
import { buildApprovedManifest, serializeJson } from "./manifest.ts";
import { writeFileSync } from "node:fs";

/**
 * Copy VERIFIED_COMMERCIAL problem dirs into dest content-pool.
 * Returns count of copied bundles.
 */
export function buildVerifiedTree(input: {
  report: AuditReport;
  upstreamContentPool: string;
  destContentPool: string;
  manifestPath: string;
  generatedAt?: string;
}): { copied: number; manifestPath: string } {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const verified = input.report.problems.filter(
    (p) => p.decision.status === "VERIFIED_COMMERCIAL",
  );

  mkdirSync(input.destContentPool, { recursive: true });

  // Remove existing problem dirs (keep .gitkeep)
  for (const name of readdirSync(input.destContentPool)) {
    if (name === ".gitkeep") continue;
    rmSync(join(input.destContentPool, name), { recursive: true, force: true });
  }

  for (const p of verified) {
    const src = join(input.upstreamContentPool, p.id);
    const dest = join(input.destContentPool, p.id);
    if (!existsSync(src) || !statSync(src).isDirectory()) {
      throw new Error(`Verified problem missing upstream dir: ${src}`);
    }
    cpSync(src, dest, { recursive: true });
  }

  const manifest = buildApprovedManifest(input.report, generatedAt);
  writeFileSync(input.manifestPath, serializeJson(manifest), "utf8");

  return { copied: verified.length, manifestPath: input.manifestPath };
}
