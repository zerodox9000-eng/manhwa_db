# Purpose

Owns GitHub Actions workflows for backend pipeline automation.

## Ownership

- Daily pipeline, manual dispatch, and publishing automation live here.
- The manual frontend-export rebuild updates generated PWA exports from the committed backend data only. It must not fetch sources, enrich AniList, or replace the daily pipeline.

## Local Contracts

- Read the root AGENTS.md first.
- Pipeline workflows must not report success after producing incomplete or inconsistent frontend exports.
- Keep permissions minimal and explicit.

## Work Guidance

- Prefer workflow changes that make failures clearer and reruns safer.
- After changing pipeline automation, verify the next workflow run when practical.

## Verification

- Inspect workflow syntax locally.
- Confirm the relevant GitHub Actions run completes successfully after deployment-related changes.

## Child DOX Index

No child AGENTS.md files.
