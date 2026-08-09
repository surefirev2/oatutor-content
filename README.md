# template-template

Template repository that syncs selected files to dependent repos via GitHub Actions. The workflow runs [surefirev2/repo-sync-action](https://github.com/surefirev2/repo-sync-action); config lives in [`.github/template-sync.yml`](.github/template-sync.yml). On push to `main` (or when opening a PR), the action clones each configured downstream repo, copies only the allowlisted paths, and opens or updates a PR with the changes.

## How it works

- **Config:** [`.github/template-sync.yml`](.github/template-sync.yml) defines `repositories` and `include_paths` (and optional `repo_include_paths` per repo). Paths can be exact or globs (e.g. `.github/workflows/*`), which expand to all tracked files under that directory in this repo.
- **Workflow:** [`.github/workflows/sync.yaml`](.github/workflows/sync.yaml) runs on push/PR to `main` and on `workflow_dispatch`. It checks out the repo, creates a GitHub App token, and runs `surefirev2/repo-sync-action`. Sync logic lives in the action repo.

## Setup

- **GitHub App:** The sync workflow needs a GitHub App token (`vars.APP_ID`, `secrets.PRIVATE_KEY`) with `contents: write` and `pull-requests: write` so it can push branches and open/update PRs in dependent repos.
- **Dependents:** Add repo names (or globs resolved via `gh repo list`) under `repositories` in `.github/template-sync.yml`. Use `include_paths` for the default file set and `repo_include_paths` for per-repo overrides.

## Docs

- [repo-sync-action README](https://github.com/surefirev2/repo-sync-action#readme) — usage, inputs, outputs.
- [Config schema](https://github.com/surefirev2/repo-sync-action/blob/main/docs/template-sync-config-schema.md) — `.github/template-sync.yml` format and allowlist/blacklist behavior.
- [Sync options](https://github.com/surefirev2/repo-sync-action/blob/main/docs/template-sync-options.md) — triggers, dry-run, draft PRs, permissions.

## Development

- **Pre-commit:** [`.pre-commit-config.yaml`](.pre-commit-config.yaml) runs YAML/JSON checks and basic hygiene. Install hooks with `pre-commit install`.
