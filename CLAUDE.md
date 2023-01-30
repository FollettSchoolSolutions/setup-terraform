# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is a FSS fork of the [`hashicorp/setup-terraform`](https://github.com/hashicorp/setup-terraform) GitHub Action. The FSS fork adds a `fail_on_detected_diff` input that fails the job when `terraform plan` returns exit code 2 (changes detected via `-detailed-exitcode`). On the `fss_main` branch, `fail_on_detected_diff` is hardcoded to `true` and cannot be disabled.

## Commands

```sh
npm install          # install dependencies
npm test             # lint (semistandard) + jest with coverage
npm run lint         # lint with auto-fix
npm run build        # bundle with ncc: produces dist/index.js and wrapper/dist/index.js
```

Run a single test:
```sh
npx jest --testPathPattern="setup-terraform" --coverage=false
```

Local GitHub Actions testing (requires `act`):
```sh
act -j exitcode --env-file act.env
```

## Architecture

The action runs in two phases:

**Phase 1 — Setup** (`index.js` → `lib/setup-terraform.js`, bundled to `dist/index.js`):
- Downloads the requested Terraform version via `@hashicorp/js-releases`
- Installs the wrapper (unless `terraform_wrapper: false`): renames `terraform` to `terraform-bin` and copies the wrapper script in its place
- Writes HCP Terraform credentials to `~/.terraformrc` if token is provided

**Phase 2 — Wrapper** (`wrapper/terraform.js`, bundled to `wrapper/dist/index.js`):
- Replaces the `terraform` binary on PATH; every subsequent `terraform` call in the workflow runs this script
- Captures stdout/stderr via `OutputListener` (`wrapper/lib/output-listener.js`) and sets them as step outputs
- Resolves the actual binary path via `wrapper/lib/terraform-bin.js` (reads `TERRAFORM_CLI_PATH` env var set during setup)
- Handles exit code 2 (plan with diff): if `fail_on_detected_diff=true`, fails the step; otherwise passes through

**Build**: Both phases use `@vercel/ncc` to bundle all dependencies into a single file. The `dist/` outputs must be committed — CI has a `check-dist` job that validates they match the source.

## Key FSS changes vs upstream

- `fail_on_detected_diff` input in `action.yml` (default `false`)
- Exit code 2 handling in `wrapper/terraform.js` — currently hardcoded to `failOnDetectedDiff = true` on the `fss_main` branch (there is a TODO comment to fix this)
- `-detailed-exitcode` flag is injected into `args` automatically when `fail_on_detected_diff=true`

## Linting

Uses `semistandard` (StandardJS + semicolons). Config in `package.json` under `"semistandard"`. The `dist/` directories are excluded.

## Changelog

Uses `changie` for changelog management. Changes go in `.changes/unreleased/`, releases use `.changes/<version>.md`.

## After making source changes

Always run `npm run build` before committing — the `dist/` files are what the action actually executes and must stay in sync with source.