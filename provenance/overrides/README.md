# Human overrides (evidence references only — no confidential contracts)

Overrides are JSON files in this directory matching `*.json`.

Example:

```json
{
  "id": "abc123",
  "decision": "VERIFIED_COMMERCIAL",
  "reason": "Separate commercial permission from rights holder",
  "evidence": {
    "type": "legal-approval",
    "reference": "LEGAL-2026-0042"
  },
  "approvedBy": "legal@example.com",
  "approvedAt": "2026-08-09T00:00:00.000Z"
}
```
