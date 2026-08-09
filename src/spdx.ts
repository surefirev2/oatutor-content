import { createRequire } from "node:module";
import spdxCorrect from "spdx-correct";
import parse from "spdx-expression-parse";
import satisfies from "spdx-satisfies";
import type { ReasonCode } from "./schemas.ts";

const require = createRequire(import.meta.url);
// CJS JSON package
const licenseIds = require("spdx-license-ids") as string[];
const licenseIdSet = new Set(licenseIds);

/** Try to normalize free-text or URL-ish license strings to an SPDX id. */
export function correctToSpdx(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already a known SPDX id
  if (licenseIdSet.has(trimmed)) return trimmed;

  // Extract from OATutor form: "https://... <CC BY 4.0>" or plain URL
  const labelMatch = trimmed.match(/<([^>]+)>\s*$/);
  const label = labelMatch?.[1]?.trim();
  const urlPart = trimmed.replace(/\s*<[^>]*>\s*$/, "").trim();

  const candidates = [label, urlPart, trimmed].filter(Boolean) as string[];

  for (const c of candidates) {
    if (licenseIdSet.has(c)) return c;
    const fromUrl = spdxFromCreativeCommonsUrl(c);
    if (fromUrl) return fromUrl;
    const corrected = spdxCorrect(c);
    if (corrected && licenseIdSet.has(corrected)) return corrected;
  }

  // Try stripping URL and correcting residual text
  const afterUrl = trimmed
    .replace(/https?:\/\/[^\s<]+/gi, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (afterUrl) {
    const corrected = spdxCorrect(afterUrl);
    if (corrected && licenseIdSet.has(corrected)) return corrected;
  }

  return null;
}

/** Map creativecommons.org licence URLs to SPDX ids. */
export function spdxFromCreativeCommonsUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (!/creativecommons\.org$/i.test(u.hostname) && !/\.creativecommons\.org$/i.test(u.hostname)) {
      return null;
    }
    const path = u.pathname.toLowerCase();
    if (path.includes("/publicdomain/zero/1.0")) return "CC0-1.0";
    const m = path.match(
      /\/licenses\/(by|by-sa|by-nc|by-nc-sa|by-nd|by-nc-nd)\/(\d(?:\.\d)?)/i,
    );
    if (!m) return null;
    const suite = m[1]!.toUpperCase().replace(/-/g, "-");
    const version = m[2]!.includes(".") ? m[2]! : `${m[2]!}.0`;
    // suite is already like BY, BY-SA → CC-BY-4.0
    const id = `CC-${suite}-${version}`.replace(/CC-BY-/i, "CC-BY-");
    // Normalize case: CC-BY-NC-SA-4.0
    const normalized = id
      .replace(/^CC-BY/i, "CC-BY")
      .replace(/NC/gi, "NC")
      .replace(/SA/gi, "SA")
      .replace(/ND/gi, "ND");
    if (licenseIdSet.has(normalized)) return normalized;
    return null;
  } catch {
    return null;
  }
}

export function isKnownSpdxId(id: string): boolean {
  return licenseIdSet.has(id);
}

export function parseSpdxExpression(expr: string): unknown {
  return parse(expr);
}

export function satisfiesAllowlist(
  licenseId: string,
  allowlist: readonly string[],
): boolean {
  // Runtime API: satisfies(expression, string[]). @types/spdx-satisfies is wrong.
  const check = satisfies as unknown as (
    expr: string,
    allowed: string[],
  ) => boolean;
  try {
    return check(licenseId, [...allowlist]);
  } catch {
    return allowlist.includes(licenseId);
  }
}

/** Map non-allowlisted SPDX id families to reason codes. */
export function reasonForRejectedSpdx(licenseId: string): ReasonCode {
  const id = licenseId.toUpperCase();
  if (id.includes("NC")) return "upstream-noncommercial";
  if (id.includes("ND")) return "upstream-no-derivatives";
  if (id.includes("SA")) return "sharealike-policy-excluded";
  return "unknown-license";
}

export function reasonForApprovedSpdx(licenseId: string): ReasonCode {
  const id = licenseId.toUpperCase();
  if (id.startsWith("CC0") || id.includes("PDDL") || id === "CC-PDDC") {
    return "approved-public-domain";
  }
  if (id.startsWith("CC-BY")) return "approved-cc-by";
  return "approved-cc-by";
}

export function licenseUrlForSpdx(licenseId: string): string | undefined {
  if (licenseId === "CC0-1.0") {
    return "https://creativecommons.org/publicdomain/zero/1.0/";
  }
  const m = licenseId.match(
    /^CC-(BY(?:-NC)?(?:-SA)?(?:-ND)?)-(\d\.\d)$/i,
  );
  if (m) {
    return `https://creativecommons.org/licenses/${m[1]!.toLowerCase()}/${m[2]}/`;
  }
  return `https://spdx.org/licenses/${licenseId}.html`;
}
