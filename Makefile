# Makefile
.PHONY: init
init:
	pre-commit install

.PHONY: run-pre-commit
run-pre-commit:
	pre-commit run --all-files
