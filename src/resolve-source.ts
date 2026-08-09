import type { LicenceRegistry, LicenceRegistryEntry } from "./schemas.ts";

export type SourceResolution =
  | { kind: "match"; entry: LicenceRegistryEntry }
  | { kind: "ambiguous"; entries: LicenceRegistryEntry[] }
  | { kind: "none" };

/**
 * True when `pattern` occurs in `haystack` as a path segment prefix:
 * next char must be end, `/`, `?`, or `#` so `/college-algebra` does not
 * match `/college-algebra-2e`.
 */
export function patternMatches(haystack: string, pattern: string): boolean {
  const h = haystack.toLowerCase();
  const p = pattern.toLowerCase().replace(/\/+$/, "");
  if (!p) return false;
  let from = 0;
  while (from <= h.length) {
    const idx = h.indexOf(p, from);
    if (idx < 0) return false;
    const after = h[idx + p.length];
    if (after === undefined || after === "/" || after === "?" || after === "#") {
      return true;
    }
    from = idx + 1;
  }
  return false;
}

/**
 * Resolve a source URL against reviewed registry patterns.
 * Longer (more specific) pattern matches win; multiple distinct entries → ambiguous.
 */
export function resolveSource(
  sourceUrl: string | undefined,
  registry: LicenceRegistry,
): SourceResolution {
  if (!sourceUrl) return { kind: "none" };

  let haystack: string;
  try {
    const u = new URL(sourceUrl);
    haystack = `${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    haystack = sourceUrl.toLowerCase();
  }

  type Hit = { entry: LicenceRegistryEntry; pattern: string };
  const hits: Hit[] = [];

  for (const entry of registry.entries) {
    for (const pattern of entry.sourcePatterns) {
      if (patternMatches(haystack, pattern)) {
        hits.push({
          entry,
          pattern: pattern.toLowerCase().replace(/\/+$/, ""),
        });
      }
    }
  }

  if (hits.length === 0) return { kind: "none" };

  hits.sort((a, b) => b.pattern.length - a.pattern.length);
  const bestLen = hits[0]!.pattern.length;
  const top = hits.filter((h) => h.pattern.length === bestLen);
  const uniqueIds = new Map<string, LicenceRegistryEntry>();
  for (const h of top) {
    uniqueIds.set(h.entry.id, h.entry);
  }

  if (uniqueIds.size === 1) {
    return { kind: "match", entry: [...uniqueIds.values()][0]! };
  }
  return { kind: "ambiguous", entries: [...uniqueIds.values()] };
}
