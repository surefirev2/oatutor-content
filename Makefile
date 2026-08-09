.PHONY: init run-pre-commit test typecheck \
	oatutor/pin oatutor/audit oatutor/report oatutor/build oatutor/verify \
	oatutor/update oatutor/rebuild-check

init:
	pre-commit install

run-pre-commit:
	pre-commit run --all-files

test:
	npm test

typecheck:
	npm run typecheck

# Pin upstream: make oatutor/pin UPSTREAM_SHA=<sha>
oatutor/pin:
	@test -n "$(UPSTREAM_SHA)" || (echo "UPSTREAM_SHA is required" && exit 1)
	npm run pin -- --sha "$(UPSTREAM_SHA)"

oatutor/audit:
	npm run audit

oatutor/report:
	npm run report

oatutor/build:
	npm run build:content

oatutor/verify:
	npm run verify

# Update: make oatutor/update UPSTREAM_SHA=<new-sha>
oatutor/update:
	@test -n "$(UPSTREAM_SHA)" || (echo "UPSTREAM_SHA is required" && exit 1)
	npm run update -- --sha "$(UPSTREAM_SHA)"

# Rebuild verified tree and fail if working tree drifts (requires upstream cache).
oatutor/rebuild-check:
	npm run build:content
	git diff --exit-code -- content-pool provenance/approved-manifest.json
