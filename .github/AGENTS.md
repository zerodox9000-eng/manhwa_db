# Purpose

Owns GitHub Actions workflows for backend pipeline automation.

## Ownership

- Daily pipeline, manual dispatch, and publishing automation live here.
- The manual frontend-export rebuild updates generated PWA exports from the committed backend data only. It must not fetch sources, enrich AniList, or replace the daily pipeline.

## Local Contracts

- Read the root AGENTS.md first.
- Pipeline workflows must not report success after producing incomplete or inconsistent frontend exports.
- The daily pipeline checks out the public `zerodox9000-eng/manhwa_history` archive beside the backend checkout. It must verify and publish the complete compressed archive before pruning backend snapshots to the newest 14 files. Archive publication failure must stop the run before backend pruning or publication.
- Cross-repository archive writes use the repository-scoped `HISTORY_ARCHIVE_DEPLOY_KEY` Actions secret. Do not replace it with a broad personal token.
- Normal workflows use a two-commit shallow checkout. Daily status tracking reads compact committed state and does not need full Git history; only the explicit status-history rebuild requires historical commits.
- Keep permissions minimal and explicit.

## Work Guidance

- Prefer workflow changes that make failures clearer and reruns safer.
- After changing pipeline automation, verify the next workflow run when practical.

## Verification

- Inspect workflow syntax locally.
- Confirm the relevant GitHub Actions run completes successfully after deployment-related changes.

## Child DOX Index

No child AGENTS.md files.
