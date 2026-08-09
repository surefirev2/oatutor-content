import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  ApprovedManifestSchema,
  type ApprovedManifest,
} from "./schemas.ts";
import { loadAllowlist, loadLicenceRegistry, loadSourcePin } from "./paths.ts";
import { isKnownSpdxId } from "./spdx.ts";
import { securityScanProblemDir } from "./security-scan.ts";

export type VerifyResult = {
  ok: boolean;
  errors: string[];
};

/**
 * CI invariants for the verified repository.
 */
export function verifyRepository(root: string): VerifyResult {
  const errors: string[] = [];

  try {
    loadAllowlist(root);
  } catch (e) {
    errors.push(`allowlist: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const reg = loadLicenceRegistry(root);
    const ids = new Set<string>();
    for (const e of reg.entries) {
      if (ids.has(e.id)) errors.push(`duplicate registry id: ${e.id}`);
      ids.add(e.id);
      if (!isKnownSpdxId(e.license)) {
        errors.push(`registry ${e.id}: invalid SPDX ${e.license}`);
      }
    }
  } catch (e) {
    errors.push(`registry: ${e instanceof Error ? e.message : String(e)}`);
  }

  let pin;
  try {
    pin = loadSourcePin(root);
  } catch (e) {
    errors.push(`source.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  const contentPool = join(root, "content-pool");
  const manifestPath = join(root, "provenance", "approved-manifest.json");

  let manifest: ApprovedManifest | undefined;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest = ApprovedManifestSchema.parse(raw);
  } catch (e) {
    errors.push(
      `approved-manifest: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!existsSync(contentPool)) {
    errors.push("content-pool directory missing");
    return { ok: errors.length === 0, errors };
  }

  const dirs = readdirSync(contentPool).filter((n) => {
    if (n === ".gitkeep") return false;
    try {
      return statSync(join(contentPool, n)).isDirectory();
    } catch {
      return false;
    }
  });

  const manifestIds = new Set(manifest?.problems.map((p) => p.id) ?? []);
  const dirSet = new Set(dirs);

  if (dirs.length === 0 && (manifest?.problems.length ?? 0) === 0) {
    return { ok: errors.length === 0, errors };
  }

  for (const id of dirs) {
    if (!manifestIds.has(id)) {
      errors.push(`content-pool/${id} has no approved-manifest record`);
    }
  }
  for (const id of manifestIds) {
    if (!dirSet.has(id)) {
      errors.push(`manifest references missing content-pool/${id}`);
    }
  }

  if (manifest) {
    const seen = new Set<string>();
    for (const p of manifest.problems) {
      if (seen.has(p.id)) errors.push(`duplicate manifest id: ${p.id}`);
      seen.add(p.id);
      if (p.decision.status !== "VERIFIED_COMMERCIAL") {
        errors.push(
          `manifest entry ${p.id} is not VERIFIED_COMMERCIAL (${p.decision.status})`,
        );
      }
    }
    if (
      pin?.commit &&
      manifest.upstream.commit &&
      pin.commit !== manifest.upstream.commit
    ) {
      errors.push(
        `source.json commit ${pin.commit} != manifest commit ${manifest.upstream.commit}`,
      );
    }
  }

  const sample = dirs.slice(0, Math.min(dirs.length, 50));
  for (const id of sample) {
    for (const issue of securityScanProblemDir(join(contentPool, id))) {
      errors.push(`security ${id}: ${issue}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
