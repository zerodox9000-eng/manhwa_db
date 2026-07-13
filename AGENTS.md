# DOX Framework

Source: https://github.com/agent0ai/dox.git at `5cb5ba55bd1c0f7c1b31fe655fe36e2febb760d2`.

- DOX is the AGENTS.md hierarchy installed here.
- Agents must follow DOX instructions across any edits.

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees.
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it.

## Read Before Editing

1. Read this root AGENTS.md.
2. Identify every file or folder you expect to touch.
3. Walk from the repository root to each target path.
4. Read every AGENTS.md found along each route.
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there.
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules.
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX.

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Project Contract

- This repo is the backend database and export pipeline for the frontend PWA in sibling repo `MANHWA CODEX 1`.
- Frontend-consumable files must be published under `db/exports/frontend/`.
- The frontend must not depend on backend raw, processed, enrichment, cache, or state files.
- GitHub is the source of truth when syncing local backend state unless the user says otherwise.
- Keep local repo layout clear: backend is `manhwa_db`; frontend is `MANHWA CODEX 1`; do not recreate duplicate backend folders.
- Do not push backend changes unless the user asks to ship or explicitly gives live/deploy approval.
- When pushing backend pipeline/code changes, run the relevant npm checks or pipeline command. Docs-only changes do not require a pipeline run.

## Work Guidance

- Preserve frontend export compatibility unless coordinating a frontend change in the same task.
- Pipeline failures should fail loudly enough to prevent publishing partial or misleading frontend exports.
- AniList enrichment, snapshots, and frontend export generation must stay internally consistent across years.
- Keep generated data changes intentional; do not churn large exports for docs-only or instruction-only edits.
- Keep docs concise, current, and operational. Document stable contracts, not diary entries.

## Verification

- Docs-only changes: no runtime check required; inspect markdown and git diff.
- Pipeline/script changes: run the narrow script when possible, or `npm run daily` only when the task requires full pipeline verification.
- Frontend export changes: verify `db/exports/frontend/` is present and compatible with the PWA data contract.

## Child DOX Index

- `scripts/AGENTS.md`: fetch, update, normalize, enrichment, snapshots, analytics, and frontend-export scripts.
- `db/AGENTS.md`: raw, processed, enriched, snapshot, state, and frontend export data contracts.
- `.github/AGENTS.md`: GitHub Actions pipeline automation.
