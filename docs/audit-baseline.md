# Full-corpus audit baseline

Pinned upstream: `CAHLR/OATutor-Content` @ `c26295e063749a6f481fb2a3000d6b302e0d149b`

Policy version: `1`

Commands: `make oatutor/pin UPSTREAM_SHA=…` then `make oatutor/audit`

## Go / no-go

**Go** (with caveats): ~1,759 problem bundles classify as `VERIFIED_COMMERCIAL` under the reviewed OpenStax registry + SPDX allowlist. That is large enough to justify maintaining this supply-chain repo and a verified importer.

**Do not treat** early inflated counts as valid — substring matching of `/details/books/college-algebra` against `…college-algebra-2e` was fixed so 2e NC-SA editions no longer false-approve.

## Classification snapshot (post segment-safe matching)

| Status | Count |
|--------|------:|
| VERIFIED_COMMERCIAL | 1,759 |
| REVIEW_REQUIRED | 3,068 |
| BLOCKED | 7,987 |
| **Total scanned** | **12,814** |

### Dominant reason codes

| Reason | Count |
|--------|------:|
| license-conflict | 7,200 |
| approved-cc-by | 1,759 |
| figure-unverified | 1,458 |
| missing-license | 903 |
| upstream-noncommercial | 787 |
| unknown-source | 707 |

### Verified corpus composition (registry)

Primarily OpenStax Introductory Statistics, College Physics 2e, University Physics Volume 1, and a smaller Precalculus (1e URL shape) set — all with allowlisted `CC-BY-*` effective registry licences and no unverified figures.

### Major blocked bands

Elementary Algebra 2e, Intermediate Algebra 2e, College Algebra 2e, Precalculus 2e (effective `CC-BY-NC-SA-4.0`).

## Implications for math-desktop

The `oatutor.pilot.v1` fixture attributes Elementary Algebra **2e** as CC BY and **must not** be treated as commercially verified. Re-source from verified `content-pool/` or obtain separate permission.

## Reproducing

```bash
make oatutor/pin UPSTREAM_SHA=c26295e063749a6f481fb2a3000d6b302e0d149b
make oatutor/audit
make oatutor/report
make oatutor/build
make oatutor/verify
```
