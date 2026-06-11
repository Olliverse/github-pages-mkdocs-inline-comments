# QDR-001: Orphaned annotations on deleted or moved pages

**Status:** open · **Date:** 2026-06-11

## Debt

An annotation issue references its page URL and markdown source path. When that page is deleted, renamed, or moved, nothing reacts: the issue stays open forever, pointing at a source that no longer exists. The same family includes *anchor orphans* — the page survives, but an edit removed the quoted text, so the selector no longer matches.

## Impact

- Breaks the consumer contract of [ADR-004](../adr/0004-one-issue-per-annotation.md): "one open issue = one actionable finding" — the open list accumulates unactionable entries.
- The fix loop must defensively handle missing files and unmatched quotes.
- Reviewers lose trust in the open count as a review-progress signal.

## Candidate remediation: reconcile on deploy

The Pages deploy workflow runs on every docs change and already holds a `GITHUB_TOKEN` with issues write access — it is the one place that knows both the authoritative file set and has credentials, with zero new infrastructure. An opt-in reconcile step after `mkdocs build`:

1. List open issues with the configured label.
2. Parse each annotation's source path and compare against the built file set.
3. Orphans get labeled `orphaned` plus an explanatory comment — or closed as `not_planned` (policy open, below).

Packaging options: a console command shipped with the plugin (`mkdocs-github-comments reconcile`) or a documented `gh` one-liner in the workflow. Local builds never call the API.

## Open decisions

- Auto-close orphans vs. label-and-keep-open for human triage.
- Rename handling: git rename detection could re-point the annotation's source path instead of orphaning it.
- Whether anchor orphans (quote gone, page exists) are reconciled too — requires markdown-level quote matching in CI, significantly more logic.

Until decided and built: accepted debt in the MVP.
