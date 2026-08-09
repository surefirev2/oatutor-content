import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CommercialAllowlistSchema,
  LicenceRegistrySchema,
  SourcePinSchema,
  type CommercialAllowlist,
  type LicenceRegistry,
  type SourcePin,
} from "./schemas.ts";
import { isKnownSpdxId } from "./spdx.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function repoRoot(): string {
  return ROOT;
}

export function loadJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadSourcePin(root = ROOT): SourcePin {
  const raw = loadJsonFile(join(root, "provenance", "source.json"));
  return SourcePinSchema.parse(raw);
}

export function loadLicenceRegistry(root = ROOT): LicenceRegistry {
  const raw = loadJsonFile(join(root, "provenance", "licence-registry.json"));
  const registry = LicenceRegistrySchema.parse(raw);
  for (const entry of registry.entries) {
    if (!isKnownSpdxId(entry.license)) {
      throw new Error(
        `Registry entry ${entry.id} has invalid SPDX license: ${entry.license}`,
      );
    }
  }
  return registry;
}

export function loadAllowlist(root = ROOT): CommercialAllowlist {
  const raw = loadJsonFile(join(root, "policy", "commercial-allowlist.json"));
  const list = CommercialAllowlistSchema.parse(raw);
  for (const id of list.licenses) {
    if (!isKnownSpdxId(id)) {
      throw new Error(`Allowlist contains invalid SPDX id: ${id}`);
    }
  }
  return list;
}

/** Default path for upstream clone (not in git). */
export function defaultUpstreamDir(root = ROOT): string {
  return (
    process.env.OATUTOR_UPSTREAM_DIR?.trim() ||
    join(root, ".cache", "OATutor-Content")
  );
}
