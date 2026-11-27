# Purpose

Owns GitHub Actions workflows for backend pipeline automation.

## Ownership

- Daily pipeline, manual dispatch, and publishing automation live here.
- The manual frontend-export rebuild updates generated PWA exports from the committed backend data only. It must not fetch sources, enrich AniList, or replace the daily pipeline.

## Local Contracts

- Read the root AGENTS.md first.
- Pipeline workflows must not report success after producing incomplete or inconsistent frontend exports.
- The daily pipeline does not check out or write to the private legacy history archive. After validation it removes dated raw snapshots older than 14 days UTC. Publish the normal backend and weekly frontend exports on the existing schedule.
- Normal workflows use a two-commit shallow checkout. Daily status tracking reads compact committed state and does not need full Git history; only the explicit status-history rebuild requires historical commits.
- Keep permissions minimal and explicit.
- `daily-pipeline.yml` is triggered by cron-job.org daily at 00:30 UTC, posting `{"ref":"main"}` to its GitHub workflow-dispatch endpoint. Keep `workflow_dispatch` for manual recovery; do not restore a GitHub `schedule` trigger alongside the external job. The external service stores a dedicated fine-grained token restricted to this repository with Actions write and required Metadata read permissions. Never commit that token or reuse the history-archive deploy key. Changing the clock must not run the pipeline, alter pipeline steps, or regenerate today's exports.

## Work Guidance

- Prefer workflow changes that make failures clearer and reruns safer.
- After changing pipeline automation, verify the next workflow run when practical.

## Verification

- Inspect workflow syntax locally.
- Confirm the relevant GitHub Actions run completes successfully after deployment-related changes.

## Child DOX Index

No child AGENTS.md files.
