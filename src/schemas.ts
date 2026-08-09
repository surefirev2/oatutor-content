import { z } from "zod";

/** Commercial verification statuses (PRD §5). */
export const StatusSchema = z.enum([
  "VERIFIED_COMMERCIAL",
  "REVIEW_REQUIRED",
  "BLOCKED",
]);
export type Status = z.infer<typeof StatusSchema>;

/** Machine-readable reason codes (PRD §21). */
export const ReasonCodeSchema = z.enum([
  "approved-cc-by",
  "approved-public-domain",
  "approved-explicit-permission",
  "upstream-noncommercial",
  "upstream-no-derivatives",
  "sharealike-policy-excluded",
  "unknown-source",
  "unknown-license",
  "ambiguous-edition",
  "license-conflict",
  "missing-attribution",
  "figure-unverified",
  "malformed-source",
  "manual-review",
  "missing-oer",
  "missing-license",
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const SourcePinSchema = z.object({
  repository: z.string().url(),
  commit: z.string().nullable(),
  auditedAt: z.string().nullable(),
  policyVersion: z.string(),
  note: z.string().optional(),
});
export type SourcePin = z.infer<typeof SourcePinSchema>;

export const LicenceRegistryEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  license: z.string().min(1),
  sourcePatterns: z.array(z.string().min(1)).min(1),
  attributionTemplate: z.string().min(1),
  notes: z.string().optional(),
});
export type LicenceRegistryEntry = z.infer<typeof LicenceRegistryEntrySchema>;

export const LicenceRegistrySchema = z.object({
  policyVersion: z.string(),
  entries: z.array(LicenceRegistryEntrySchema),
});
export type LicenceRegistry = z.infer<typeof LicenceRegistrySchema>;

export const CommercialAllowlistSchema = z.object({
  policyVersion: z.string(),
  description: z.string().optional(),
  licenses: z.array(z.string().min(1)).min(1),
});
export type CommercialAllowlist = z.infer<typeof CommercialAllowlistSchema>;

export const EvidenceSchema = z.object({
  type: z.string().min(1),
  reference: z.string().min(1),
});

export const OverrideSchema = z.object({
  id: z.string().min(1),
  decision: StatusSchema,
  reason: z.string().min(1),
  evidence: EvidenceSchema,
  approvedBy: z.string().min(1),
  approvedAt: z.string().min(1),
  expiresAt: z.string().optional(),
  reasonCode: ReasonCodeSchema.optional(),
});
export type Override = z.infer<typeof OverrideSchema>;

export const AttributionSchema = z.object({
  required: z.boolean(),
  text: z.string(),
  sourceUrl: z.string().optional(),
  licenseUrl: z.string().optional(),
  license: z.string().optional(),
});
export type Attribution = z.infer<typeof AttributionSchema>;

export const AssetStatusSchema = z.enum([
  "verified",
  "verified-with-parent",
  "review",
  "none",
  "blocked",
]);

export const AuditRecordSchema = z.object({
  id: z.string(),
  upstream: z.object({
    repository: z.string(),
    commit: z.string().nullable(),
    path: z.string(),
  }),
  oatutor: z.object({
    declaredLicense: z.string().optional(),
    declaredLicenseSpdx: z.string().nullable().optional(),
    oer: z.string().optional(),
    sourceUrl: z.string().optional(),
    courseName: z.string().optional(),
  }),
  resolvedSource: z
    .object({
      provider: z.string(),
      work: z.string(),
      registryId: z.string(),
      license: z.string(),
    })
    .nullable(),
  assets: z.object({
    problem: AssetStatusSchema,
    steps: AssetStatusSchema,
    hints: AssetStatusSchema,
    scaffolds: AssetStatusSchema,
    figures: AssetStatusSchema,
  }),
  decision: z.object({
    status: StatusSchema,
    reasonCode: ReasonCodeSchema,
    policyVersion: z.string(),
    verifiedAt: z.string(),
    detail: z.string().optional(),
  }),
  attribution: AttributionSchema.nullable(),
  override: z
    .object({
      applied: z.literal(true),
      reference: z.string(),
      approvedBy: z.string(),
    })
    .optional(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export const AuditReportSchema = z.object({
  policyVersion: z.string(),
  upstream: z.object({
    repository: z.string(),
    commit: z.string().nullable(),
  }),
  auditedAt: z.string(),
  counts: z.object({
    total: z.number().int().nonnegative(),
    VERIFIED_COMMERCIAL: z.number().int().nonnegative(),
    REVIEW_REQUIRED: z.number().int().nonnegative(),
    BLOCKED: z.number().int().nonnegative(),
  }),
  reasonCounts: z.record(z.string(), z.number().int().nonnegative()),
  unresolvedSourcePatterns: z.array(
    z.object({
      hostPath: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  problems: z.array(AuditRecordSchema),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;

export const ApprovedManifestSchema = z.object({
  policyVersion: z.string(),
  upstream: z.object({
    repository: z.string(),
    commit: z.string().nullable(),
  }),
  generatedAt: z.string().nullable(),
  problems: z.array(AuditRecordSchema),
});
export type ApprovedManifest = z.infer<typeof ApprovedManifestSchema>;
