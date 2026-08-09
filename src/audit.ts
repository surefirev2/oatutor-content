import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { classifyProblem } from "./classify.ts";
import { buildAuditReport, serializeJson } from "./manifest.ts";
import { loadOverrides } from "./override.ts";
import {
  defaultUpstreamDir,
  loadAllowlist,
  loadLicenceRegistry,
  loadSourcePin,
  repoRoot,
} from "./paths.ts";
import { scanContentPool } from "./scan.ts";
import type { AuditReport } from "./schemas.ts";

export function pinUpstream(input: {
  sha: string;
  root?: string;
  repository?: string;
}): { commit: string; dir: string } {
  const root = input.root ?? repoRoot();
  const sha = input.sha.trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new Error(
      `Refusing non-commit pin ${JSON.stringify(sha)}; pass an immutable git SHA`,
    );
  }
  if (/^(main|master|latest|HEAD)$/i.test(sha)) {
    throw new Error("Refusing branch/tag pin; immutable SHA required");
  }

  const repo =
    input.repository ?? "https://github.com/CAHLR/OATutor-Content.git";
  const dir = defaultUpstreamDir(root);
  mkdirSync(join(root, ".cache"), { recursive: true });

  if (!existsSync(join(dir, ".git"))) {
    const clone = spawnSync(
      "git",
      ["clone", "--filter=blob:none", repo, dir],
      { stdio: "inherit" },
    );
    if (clone.status !== 0) {
      throw new Error("git clone failed");
    }
  } else {
    spawnSync("git", ["-C", dir, "fetch", "--all", "--tags"], {
      stdio: "inherit",
    });
  }

  const co = spawnSync("git", ["-C", dir, "checkout", "--detach", sha], {
    stdio: "inherit",
  });
  if (co.status !== 0) {
    throw new Error(`git checkout ${sha} failed`);
  }

  const rev = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (rev.status !== 0) throw new Error("rev-parse failed");
  const commit = rev.stdout.trim();

  const pinPath = join(root, "provenance", "source.json");
  const pin = {
    repository: "https://github.com/CAHLR/OATutor-Content",
    commit,
    auditedAt: null,
    policyVersion: "1",
  };
  writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`, "utf8");

  return { commit, dir };
}

export function runAudit(input?: {
  root?: string;
  upstreamDir?: string;
}): AuditReport {
  const root = input?.root ?? repoRoot();
  const pin = loadSourcePin(root);
  if (!pin.commit) {
    throw new Error(
      "No pinned upstream commit. Run: make oatutor/pin UPSTREAM_SHA=<sha>",
    );
  }

  const upstreamDir = input?.upstreamDir ?? defaultUpstreamDir(root);
  const contentPool = join(upstreamDir, "content-pool");
  if (!existsSync(contentPool)) {
    throw new Error(`Upstream content-pool not found at ${contentPool}`);
  }

  // Ensure upstream is at pin
  if (existsSync(join(upstreamDir, ".git"))) {
    const rev = spawnSync("git", ["-C", upstreamDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    });
    const head = rev.stdout?.trim();
    if (head && head !== pin.commit && !head.startsWith(pin.commit) && !pin.commit.startsWith(head)) {
      const co = spawnSync(
        "git",
        ["-C", upstreamDir, "checkout", "--detach", pin.commit],
        { stdio: "inherit" },
      );
      if (co.status !== 0) {
        throw new Error(`Could not checkout pinned commit ${pin.commit}`);
      }
    }
  }

  const registry = loadLicenceRegistry(root);
  const allowlist = loadAllowlist(root);
  const overrides = loadOverrides(join(root, "provenance", "overrides"));
  const problems = scanContentPool(contentPool);
  const auditedAt = new Date().toISOString();

  const records = problems.map((p) =>
    classifyProblem(p, {
      repository: pin.repository,
      commit: pin.commit,
      policyVersion: pin.policyVersion,
      registry,
      allowlist,
      overrides,
      nowIso: auditedAt,
    }),
  );

  const report = buildAuditReport({
    policyVersion: pin.policyVersion,
    repository: pin.repository,
    commit: pin.commit,
    auditedAt,
    problems: records,
  });

  const artifacts = join(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(
    join(artifacts, "audit-report.json"),
    serializeJson(report),
    "utf8",
  );

  // Update auditedAt on source pin without losing commit
  const pinPath = join(root, "provenance", "source.json");
  const pinData = JSON.parse(readFileSync(pinPath, "utf8")) as Record<
    string,
    unknown
  >;
  pinData.auditedAt = auditedAt;
  writeFileSync(pinPath, `${JSON.stringify(pinData, null, 2)}\n`, "utf8");

  return report;
}

export function loadAuditReport(root = repoRoot()): AuditReport {
  const path = join(root, "artifacts", "audit-report.json");
  return JSON.parse(readFileSync(path, "utf8")) as AuditReport;
}
