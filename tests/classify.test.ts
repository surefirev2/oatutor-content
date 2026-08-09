import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { classifyProblem } from "../src/classify.ts";
import type {
  CommercialAllowlist,
  LicenceRegistry,
  Override,
} from "../src/schemas.ts";
import type { ParsedProblem } from "../src/parse-problem.ts";
import { resolveSource } from "../src/resolve-source.ts";
import { correctToSpdx, satisfiesAllowlist } from "../src/spdx.ts";
import { buildVerifiedTree } from "../src/build-tree.ts";
import { buildAuditReport } from "../src/manifest.ts";
import { parseProblemDir } from "../src/parse-problem.ts";

const registry: LicenceRegistry = {
  policyVersion: "1",
  entries: [
    {
      id: "openstax:precalculus:1",
      title: "Precalculus",
      publisher: "OpenStax",
      license: "CC-BY-4.0",
      sourcePatterns: ["/books/precalculus/", "/details/books/precalculus"],
      attributionTemplate:
        "Adapted from OpenStax Precalculus ({{sourceUrl}}), {{license}}.",
    },
    {
      id: "openstax:elementary-algebra-2e",
      title: "Elementary Algebra 2e",
      publisher: "OpenStax",
      license: "CC-BY-NC-SA-4.0",
      sourcePatterns: [
        "/books/elementary-algebra-2e/",
        "/details/books/elementary-algebra-2e",
      ],
      attributionTemplate: "Source Elementary Algebra 2e {{license}}.",
    },
    {
      id: "openstax:elementary-algebra",
      title: "Elementary Algebra",
      publisher: "OpenStax",
      license: "CC-BY-4.0",
      sourcePatterns: [
        "/books/elementary-algebra/",
        "/details/books/elementary-algebra",
      ],
      attributionTemplate: "Source Elementary Algebra {{license}}.",
    },
  ],
};

const allowlist: CommercialAllowlist = {
  policyVersion: "1",
  licenses: ["CC0-1.0", "CC-BY-4.0", "CC-BY-3.0"],
};

function base(partial: Partial<ParsedProblem> & { id: string }): ParsedProblem {
  return {
    dirPath: `/tmp/${partial.id}`,
    relativePath: `content-pool/${partial.id}`,
    malformed: false,
    hasSteps: true,
    hasHints: false,
    hasScaffolds: false,
    hasFigures: false,
    figurePaths: [],
    ...partial,
  };
}

const ctx = {
  repository: "https://github.com/CAHLR/OATutor-Content",
  commit: "abc123",
  policyVersion: "1",
  registry,
  allowlist,
  overrides: new Map<string, Override>(),
  nowIso: "2026-08-09T20:00:00.000Z",
};

describe("spdx helpers", () => {
  it("corrects CC BY 4.0 labels and creativecommons URLs", () => {
    expect(
      correctToSpdx(
        "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
      ),
    ).toBe("CC-BY-4.0");
    expect(
      correctToSpdx("https://creativecommons.org/licenses/by-nc-sa/4.0/"),
    ).toBe("CC-BY-NC-SA-4.0");
  });

  it("allowlist rejects NC-SA", () => {
    expect(satisfiesAllowlist("CC-BY-4.0", allowlist.licenses)).toBe(true);
    expect(satisfiesAllowlist("CC-BY-NC-SA-4.0", allowlist.licenses)).toBe(
      false,
    );
  });
});

describe("resolveSource", () => {
  it("maps known OpenStax first-edition style URLs", () => {
    const r = resolveSource(
      "https://openstax.org/books/precalculus/pages/1-1",
      registry,
    );
    expect(r.kind).toBe("match");
    if (r.kind === "match") expect(r.entry.id).toBe("openstax:precalculus:1");
  });

  it("prefers 2e over base elementary algebra", () => {
    const r = resolveSource(
      "https://openstax.org/details/books/elementary-algebra-2e",
      registry,
    );
    expect(r.kind).toBe("match");
    if (r.kind === "match") {
      expect(r.entry.id).toBe("openstax:elementary-algebra-2e");
    }
  });

  it("does not treat 2e details URL as 1e book", () => {
    const r = resolveSource(
      "https://openstax.org/details/books/college-algebra-2e",
      {
        policyVersion: "1",
        entries: [
          {
            id: "ca1",
            title: "College Algebra",
            publisher: "OpenStax",
            license: "CC-BY-4.0",
            sourcePatterns: ["/details/books/college-algebra"],
            attributionTemplate: "t",
          },
          {
            id: "ca2",
            title: "College Algebra 2e",
            publisher: "OpenStax",
            license: "CC-BY-NC-SA-4.0",
            sourcePatterns: ["/details/books/college-algebra-2e"],
            attributionTemplate: "t",
          },
        ],
      },
    );
    expect(r.kind).toBe("match");
    if (r.kind === "match") expect(r.entry.id).toBe("ca2");
  });
});

describe("classifyProblem", () => {
  it("VERIFIED when OATutor CC BY + upstream CC BY", () => {
    const rec = classifyProblem(
      base({
        id: "p1",
        license: "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: "https://openstax.org/books/precalculus/pages/1-1 <OpenStax Precalculus>",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("VERIFIED_COMMERCIAL");
    expect(rec.decision.reasonCode).toBe("approved-cc-by");
    expect(rec.attribution?.text).toContain("Precalculus");
  });

  it("BLOCKED when OATutor CC BY + Elementary Algebra 2e NC-SA", () => {
    const rec = classifyProblem(
      base({
        id: "p2",
        license: "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: "https://openstax.org/books/elementary-algebra-2e/pages/1 <EA 2e>",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("BLOCKED");
    expect(["license-conflict", "upstream-noncommercial"]).toContain(
      rec.decision.reasonCode,
    );
  });

  it("REVIEW when unknown OER URL", () => {
    const rec = classifyProblem(
      base({
        id: "p3",
        license: "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: "https://example.com/unknown-book/page <Unknown>",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("REVIEW_REQUIRED");
    expect(rec.decision.reasonCode).toBe("unknown-source");
  });

  it("REVIEW when figure present", () => {
    const rec = classifyProblem(
      base({
        id: "p4",
        license: "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: "https://openstax.org/books/precalculus/pages/1-1 <Precalc>",
        hasFigures: true,
        figurePaths: ["/tmp/p4/fig.png"],
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("REVIEW_REQUIRED");
    expect(rec.decision.reasonCode).toBe("figure-unverified");
  });

  it("REVIEW when blank license", () => {
    const rec = classifyProblem(
      base({
        id: "p5",
        license: "",
        oer: "https://openstax.org/books/precalculus/pages/1-1 <Precalc>",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("REVIEW_REQUIRED");
    expect(rec.decision.reasonCode).toBe("missing-license");
  });

  it("REVIEW when missing OER", () => {
    const rec = classifyProblem(
      base({
        id: "p6",
        license: "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: "",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("REVIEW_REQUIRED");
    expect(rec.decision.reasonCode).toBe("missing-oer");
  });

  it("override VERIFIED with evidence", () => {
    const overrides = new Map<string, Override>([
      [
        "p7",
        {
          id: "p7",
          decision: "VERIFIED_COMMERCIAL",
          reason: "Separate commercial permission",
          evidence: { type: "legal-approval", reference: "LEGAL-2026-0042" },
          approvedBy: "legal@example.com",
          approvedAt: "2026-08-09T00:00:00.000Z",
          reasonCode: "approved-explicit-permission",
        },
      ],
    ]);
    const rec = classifyProblem(
      base({
        id: "p7",
        license: "",
        oer: "https://example.com/custom <Custom>",
      }),
      { ...ctx, overrides },
    );
    expect(rec.decision.status).toBe("VERIFIED_COMMERCIAL");
    expect(rec.decision.reasonCode).toBe("approved-explicit-permission");
    expect(rec.override?.reference).toBe("LEGAL-2026-0042");
  });

  it("malformed → REVIEW", () => {
    const rec = classifyProblem(
      base({
        id: "p8",
        malformed: true,
        malformReason: "missing-problem-json",
      }),
      ctx,
    );
    expect(rec.decision.status).toBe("REVIEW_REQUIRED");
    expect(rec.decision.reasonCode).toBe("malformed-source");
  });
});

describe("integration build", () => {
  it("copies only 3 verified of 6 synthetic problems", () => {
    const root = join(tmpdir(), `oatutor-test-${Date.now()}`);
    const upPool = join(root, "upstream", "content-pool");
    const destPool = join(root, "content-pool");
    const manifestPath = join(root, "approved-manifest.json");

    const ids = [
      "approved-1",
      "approved-2",
      "approved-3",
      "blocked-1",
      "blocked-2",
      "review-1",
    ];
    for (const id of ids) {
      const dir = join(upPool, id);
      mkdirSync(dir, { recursive: true });
      const isBlocked = id.startsWith("blocked");
      const isReview = id.startsWith("review");
      const body = {
        id,
        license: isReview
          ? ""
          : "https://creativecommons.org/licenses/by/4.0/ <CC BY 4.0>",
        oer: isBlocked
          ? "https://openstax.org/books/elementary-algebra-2e/pages/x <EA2e>"
          : isReview
            ? "https://example.com/unknown <U>"
            : "https://openstax.org/books/precalculus/pages/x <P>",
      };
      writeFileSync(join(dir, `${id}.json`), JSON.stringify(body), "utf8");
    }

    const problems = ids.map((id) => parseProblemDir(join(upPool, id), upPool));
    const records = problems.map((p) => classifyProblem(p, ctx));
    const report = buildAuditReport({
      policyVersion: "1",
      repository: "https://github.com/CAHLR/OATutor-Content",
      commit: "test",
      auditedAt: "2026-08-09T20:00:00.000Z",
      problems: records,
    });

    expect(report.counts.VERIFIED_COMMERCIAL).toBe(3);
    expect(report.counts.BLOCKED).toBe(2);
    expect(report.counts.REVIEW_REQUIRED).toBe(1);

    const { copied } = buildVerifiedTree({
      report,
      upstreamContentPool: upPool,
      destContentPool: destPool,
      manifestPath,
      generatedAt: "2026-08-09T20:00:00.000Z",
    });
    expect(copied).toBe(3);

    const out = readdirSync(destPool).filter((n) => n !== ".gitkeep");
    expect(out.sort()).toEqual(["approved-1", "approved-2", "approved-3"]);

    rmSync(root, { recursive: true, force: true });
  });
});
