import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OverrideSchema, type Override } from "./schemas.ts";

export function loadOverrides(overridesDir: string): Map<string, Override> {
  const map = new Map<string, Override>();
  let names: string[];
  try {
    names = readdirSync(overridesDir);
  } catch {
    return map;
  }

  const now = Date.now();
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith(".")) continue;
    const raw = JSON.parse(
      readFileSync(join(overridesDir, name), "utf8"),
    ) as unknown;
    const ov = OverrideSchema.parse(raw);
    if (ov.expiresAt) {
      const exp = Date.parse(ov.expiresAt);
      if (!Number.isNaN(exp) && exp < now) continue;
    }
    if (!ov.reason?.trim() || !ov.approvedBy?.trim() || !ov.evidence?.reference) {
      throw new Error(`Override ${name} missing required metadata`);
    }
    map.set(ov.id, ov);
  }
  return map;
}
