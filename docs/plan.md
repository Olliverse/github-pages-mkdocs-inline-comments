# Improvement Plan

Findings from the first real end-to-end session on the live site (2026-06-12), plus the backlog consciously deferred during code and security review. Each item ships as its own conventional commit; any frontend change rebuilds the committed bundle (CI enforces this).

Visual design reference: the internal doubleSlash plugin [mkdocs-gitlab-comments](https://gitlab.doubleslash.de/doubleSlash/coc-fg/tt-devops/docs-as-code/mkdocs-gitlab-comments) — same problem space (inline comments on MkDocs Material, stored in the forge's issue tracker), with a mature, theme-aware UI that several of the shipped items borrow from.

## Shipped (2026-06-12)

- **Theme-responsive widget** — dark mode was broken because theme proxies declared on `:root` could not see Material's `--md-*` vars (which live on `[data-md-color-scheme]`); tokens now resolve in Material's scope, with literal light-theme fallbacks on `:root` for non-Material themes.
- **Post-create lands in the annotation view** — after a successful create the popover transitions into the standard detail view (edit / resolve / retract) instead of a confirmation dead end.
- **Visual polish from the reference design** — radius scale, layered elevation shadows with slate variants, a distinct active-highlight state, accent hover ghosts.
- From the deferred review backlog:
    - `scope` shipped in the JSON payload (backward-compatible datamodel addition).
    - Parse hardening for an unclosed `<details>` block in an issue body.
    - Composer draft keyed by selection instead of by page.
    - 429 rate-limit responses surfaced in the UI.
    - Keyboard access for popover and panel (Escape, tab order); focus trap deliberately waived — see below.
    - Popover width constant deduplicated (single source of truth in TS; CSS keeps only the viewport `max-width` guard).
    - PyPI-ready `pyproject.toml` metadata and a CI Python version matrix.

## Remaining

- **Optimistic rendering on create** (stretch, reference plugin pattern) — insert a temp annotation with a sentinel id before the API call returns, reconcile or roll back on response. Only worth it if create latency is felt in practice.
- **Parse recovery breadth** — the unclosed-`<details>` recovery only tries the last open tag; the failure mode is in the safe direction (annotation skipped, nothing corrupted), but recovery should iterate candidates last→first.
- **Drafts map growth** — selection-keyed composer drafts are never evicted within a page session; bounded only by page lifetime, worth a cap or eviction on annotation create/close.
- **Duplicate tab stops on multi-segment highlights** — every `<mark>` of an annotation that spans formatting boundaries is focusable; consider `tabindex` on the first mark only.
- **PyPI release** — the publish itself plus release-please wiring.

## Decided, not debt

- **No focus trap in the popover** — the popover is non-modal (the page behind it stays interactive), so per the ARIA APG non-modal pattern Tab is intentionally allowed to leave it; Escape closes and returns focus. A deliberate waiver, not an open accessibility gap.

## Informational

- `color-mix()` needs Chrome 111+ / Safari 16.2+; on older browsers borders and hover ghosts degrade to transparent while surfaces and text stay readable.
