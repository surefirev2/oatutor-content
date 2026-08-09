# math-desktop consumption boundary

Epiphanie production systems (including **math-desktop**) must consume OATutor
material **only** from a pinned commit of this repository
(`surefirev2/oatutor-content`).

## Forbidden

- Cloning or vendoring `CAHLR/OATutor-Content` for production import
- Scraping live OATutor / OpenStax exercise pages into inventory
- Treating OATutor problem-level `license: CC BY` as commercial proof without an
  entry in this repo’s `approved-manifest.json`

## Required importer behaviour

1. Pin this repo (git submodule, vendor commit SHA, or release tag).
2. Read `provenance/approved-manifest.json`.
3. Import only problem ids present under `content-pool/` **and** listed in the
   manifest with `decision.status = VERIFIED_COMMERCIAL`.
4. Persist provenance fields (`upstreamProblemId`, `upstreamCommit`,
   `verifiedLicense`, attribution text) on every `ProblemTemplate`.
5. Never strip attribution.

## Pilot pack warning

`math-desktop` currently ships `oatutor.pilot.v1` adapted from Elementary Algebra
samples with a CC BY notice. Elementary Algebra **2e** resolves to
**CC-BY-NC-SA-4.0** in this registry and is **BLOCKED**.

That pilot is **not** commercially verified. Until re-sourced from
`content-pool/` (or granted an explicit override evidence record), it must not
be treated as production commercial curriculum.

## CI recommendation (math-desktop)

Fail the build if production import paths reference:

```text
CAHLR/OATutor-Content
github.com/CAHLR/OATutor-Content
raw.githubusercontent.com/CAHLR/OATutor-Content
```

Allowlist comments and historical docs that explicitly state the ban.
