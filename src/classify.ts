import { buildAttribution } from "./attribution.ts";
import { hostPathKey, parseUrlLabel } from "./parse-oer-url.ts";
import type { ParsedProblem } from "./parse-problem.ts";
import { resolveSource } from "./resolve-source.ts";
import type {
  AuditRecord,
  CommercialAllowlist,
  LicenceRegistry,
  Override,
  ReasonCode,
  Status,
} from "./schemas.ts";
import {
  correctToSpdx,
  reasonForApprovedSpdx,
  reasonForRejectedSpdx,
  satisfiesAllowlist,
} from "./spdx.ts";

export type ClassifyContext = {
  repository: string;
  commit: string | null;
  policyVersion: string;
  registry: LicenceRegistry;
  allowlist: CommercialAllowlist;
  overrides: Map<string, Override>;
  nowIso?: string;
};

function assetsBase(problem: ParsedProblem, figureStatus: "none" | "review") {
  const child = "verified-with-parent" as const;
  return {
    problem: "verified" as const,
    steps: problem.hasSteps ? child : ("none" as const),
    hints: problem.hasHints ? child : ("none" as const),
    scaffolds: problem.hasScaffolds ? child : ("none" as const),
    figures: figureStatus === "none" ? ("none" as const) : ("review" as const),
  };
}

function record(
  problem: ParsedProblem,
  ctx: ClassifyContext,
  partial: {
    status: Status;
    reasonCode: ReasonCode;
    detail?: string;
    resolvedSource: AuditRecord["resolvedSource"];
    attribution: AuditRecord["attribution"];
    assets: AuditRecord["assets"];
    declaredLicenseSpdx: string | null;
    sourceUrl?: string;
    override?: AuditRecord["override"];
  },
): AuditRecord {
  const oer = parseUrlLabel(problem.oer);
  return {
    id: problem.id,
    upstream: {
      repository: ctx.repository,
      commit: ctx.commit,
      path: problem.relativePath,
    },
    oatutor: {
      declaredLicense: problem.license,
      declaredLicenseSpdx: partial.declaredLicenseSpdx,
      oer: problem.oer,
      sourceUrl: partial.sourceUrl ?? oer.url,
      courseName: problem.courseName,
    },
    resolvedSource: partial.resolvedSource,
    assets: partial.assets,
    decision: {
      status: partial.status,
      reasonCode: partial.reasonCode,
      policyVersion: ctx.policyVersion,
      verifiedAt: ctx.nowIso ?? new Date().toISOString(),
      detail: partial.detail,
    },
    attribution: partial.attribution,
    override: partial.override,
  };
}

/**
 * Classify one problem bundle under policy v1.
 */
export function classifyProblem(
  problem: ParsedProblem,
  ctx: ClassifyContext,
): AuditRecord {
  const oer = parseUrlLabel(problem.oer);
  const lic = parseUrlLabel(problem.license);
  const declaredSpdx = correctToSpdx(problem.license) ?? correctToSpdx(lic.url);

  // 1. Malformed
  if (problem.malformed) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "malformed-source",
      detail: problem.malformReason,
      resolvedSource: null,
      attribution: null,
      assets: assetsBase(problem, problem.hasFigures ? "review" : "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  // 2. Explicit override
  const ov = ctx.overrides.get(problem.id);
  if (ov) {
    const resolution = resolveSource(oer.url, ctx.registry);
    const entry = resolution.kind === "match" ? resolution.entry : null;
    let attribution: AuditRecord["attribution"] = null;
    if (ov.decision === "VERIFIED_COMMERCIAL" && entry) {
      attribution = buildAttribution({ entry, sourceUrl: oer.url });
    } else if (ov.decision === "VERIFIED_COMMERCIAL") {
      attribution = {
        required: true,
        text: ov.reason,
        sourceUrl: oer.url,
        license: declaredSpdx ?? undefined,
      };
    }
    return record(problem, ctx, {
      status: ov.decision,
      reasonCode: ov.reasonCode ?? "approved-explicit-permission",
      detail: ov.reason,
      resolvedSource: entry
        ? {
            provider: entry.publisher,
            work: entry.title,
            registryId: entry.id,
            license: entry.license,
          }
        : null,
      attribution,
      assets: assetsBase(problem, problem.hasFigures ? "review" : "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
      override: {
        applied: true,
        reference: ov.evidence.reference,
        approvedBy: ov.approvedBy,
      },
    });
  }

  // 3. Figures
  if (problem.hasFigures) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "figure-unverified",
      detail: `Unverified figures: ${problem.figurePaths.length}`,
      resolvedSource: null,
      attribution: null,
      assets: assetsBase(problem, "review"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  // Missing OER
  if (!problem.oer?.trim() || !oer.url) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: !problem.oer?.trim() ? "missing-oer" : "unknown-source",
      resolvedSource: null,
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  // 4. Resolve source
  const resolution = resolveSource(oer.url, ctx.registry);
  if (resolution.kind === "none") {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "unknown-source",
      detail: hostPathKey(oer.url),
      resolvedSource: null,
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }
  if (resolution.kind === "ambiguous") {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "ambiguous-edition",
      detail: resolution.entries.map((e) => e.id).join(", "),
      resolvedSource: null,
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  const entry = resolution.entry;
  const effective = entry.license;
  const allow = ctx.allowlist.licenses;

  // 5–6. Allowlist gate on effective licence
  if (!satisfiesAllowlist(effective, allow)) {
    const reason = reasonForRejectedSpdx(effective);
    // 7. Conflict if OATutor declared allowlisted but effective is not
    const conflict =
      declaredSpdx !== null && satisfiesAllowlist(declaredSpdx, allow);
    return record(problem, ctx, {
      status: "BLOCKED",
      reasonCode: conflict ? "license-conflict" : reason,
      detail: conflict
        ? `OATutor declares ${declaredSpdx}; effective ${effective}`
        : `effective ${effective}`,
      resolvedSource: {
        provider: entry.publisher,
        work: entry.title,
        registryId: entry.id,
        license: effective,
      },
      attribution: null,
      assets: {
        problem: "blocked",
        steps: problem.hasSteps ? "blocked" : "none",
        hints: problem.hasHints ? "blocked" : "none",
        scaffolds: problem.hasScaffolds ? "blocked" : "none",
        figures: "none",
      },
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  // Missing blank declared license still OK if effective allowlisted? PRD: missing license → REVIEW for incomplete metadata
  if (!problem.license?.trim()) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "missing-license",
      resolvedSource: {
        provider: entry.publisher,
        work: entry.title,
        registryId: entry.id,
        license: effective,
      },
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: null,
      sourceUrl: oer.url,
    });
  }

  // 8. Attribution
  let attribution;
  try {
    attribution = buildAttribution({ entry, sourceUrl: oer.url });
  } catch (e) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "missing-attribution",
      detail: e instanceof Error ? e.message : String(e),
      resolvedSource: {
        provider: entry.publisher,
        work: entry.title,
        registryId: entry.id,
        license: effective,
      },
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  if (!attribution.text.trim()) {
    return record(problem, ctx, {
      status: "REVIEW_REQUIRED",
      reasonCode: "missing-attribution",
      resolvedSource: {
        provider: entry.publisher,
        work: entry.title,
        registryId: entry.id,
        license: effective,
      },
      attribution: null,
      assets: assetsBase(problem, "none"),
      declaredLicenseSpdx: declaredSpdx,
      sourceUrl: oer.url,
    });
  }

  // 9. Verified
  return record(problem, ctx, {
    status: "VERIFIED_COMMERCIAL",
    reasonCode: reasonForApprovedSpdx(effective),
    resolvedSource: {
      provider: entry.publisher,
      work: entry.title,
      registryId: entry.id,
      license: effective,
    },
    attribution,
    assets: assetsBase(problem, "none"),
    declaredLicenseSpdx: declaredSpdx,
    sourceUrl: oer.url,
  });
}
