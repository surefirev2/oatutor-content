# Commercial-use verification policy (v1)

## Purpose

This repository admits only OATutor content that passes Epiphanie's commercial-use policy.
If content is present under `content-pool/` on the default branch, automated systems may treat it as approved for commercial ingestion under the recorded licence and attribution requirements.

`math-desktop` and other Epiphanie services MUST NOT ingest content directly from `CAHLR/OATutor-Content`.

## Classification statuses

| Status | Meaning |
|--------|---------|
| `VERIFIED_COMMERCIAL` | Provenance and effective licence allow commercial use under this policy |
| `REVIEW_REQUIRED` | Cannot determine commercial status reliably |
| `BLOCKED` | Known rights conditions make the item unsuitable for the commercial pipeline |

## Default commercial allowlist

Only these SPDX identifiers may enter the default verified corpus:

- `CC0-1.0`
- `CC-BY-4.0`
- `CC-BY-3.0`

ShareAlike licences (e.g. `CC-BY-SA-4.0`) allow commercial use under CC but are **excluded** from the default corpus (`sharealike-policy-excluded`) until a separate policy covers SA obligations.

Non-commercial and no-derivatives CC variants are blocked.

## Grain

Verification is at the **problem bundle** level. If any required asset fails (including figures without independent verification), the whole bundle fails.

## Effective licence

The effective licence is the reviewed registry entry for the resolved source edition.
OATutor's declared `license` field never overrides a more restrictive registered source licence.

## Figures

Problems containing figure/media assets are `REVIEW_REQUIRED` (`figure-unverified`) unless figure provenance is independently verified (v1: not supported automatically).

## Overrides

Human overrides require a durable evidence reference, approver, reason, and may include an expiry date.
Do not store confidential contracts in this repository.

## Policy version

This document is policy version `1`, recorded in `provenance/source.json` as `policyVersion`.
