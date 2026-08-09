# OATutor content (commercially verified)

This repository is a mechanically derived subset of [CAHLR/OATutor-Content](https://github.com/CAHLR/OATutor-Content).

Content is included under `content-pool/` only when it has satisfied this project's commercial-use verification policy (see [policy/POLICY.md](policy/POLICY.md)).

**Absence from this repository does not imply that the corresponding upstream content is incorrectly licensed or infringing.** It means only that the content has not satisfied this project's verification requirements for commercial Epiphanie use.

Original attribution and provenance are preserved where required.

The authoritative upstream project remains [CAHLR/OATutor-Content](https://github.com/CAHLR/OATutor-Content).

Epiphanie systems (including `math-desktop`) **must not** import OATutor content from any source other than a pinned revision of this repository.

## Trust invariant

> If content exists under `content-pool/` on the default branch, Epiphanie's automated content systems may treat it as approved for commercial ingestion under the recorded licence and attribution requirements.

## Architecture

```text
CAHLR/OATutor-Content @ pinned SHA
        → audit (SPDX + licence registry)
        → VERIFIED_COMMERCIAL | REVIEW_REQUIRED | BLOCKED
        → content-pool/ (verified only)
        → Epiphanie importer
```

## Requirements

- Node.js 20+
- git (for pinning upstream)

## Commands

```bash
npm install

# Pin upstream OATutor commit (clones to .cache/ if needed)
make oatutor/pin UPSTREAM_SHA=<full-sha>

# Classify every problem (writes artifacts/audit-report.json)
make oatutor/audit

# Human-readable summary
make oatutor/report

# Copy only VERIFIED_COMMERCIAL into content-pool/
make oatutor/build

# CI invariants (empty content-pool is OK)
make oatutor/verify

# Tests
make test
```

## Provenance data

| Path | Role |
|------|------|
| [provenance/source.json](provenance/source.json) | Pinned upstream commit + policy version |
| [provenance/licence-registry.json](provenance/licence-registry.json) | Reviewed edition → SPDX licence mappings |
| [provenance/approved-manifest.json](provenance/approved-manifest.json) | Audit records for items in `content-pool/` |
| [policy/commercial-allowlist.json](policy/commercial-allowlist.json) | SPDX IDs allowed in default corpus |

## Development

```bash
make init          # pre-commit install
make test
npm run typecheck
```
