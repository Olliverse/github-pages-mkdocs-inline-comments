# Improvement Plan

Findings from the first real end-to-end session on the live site (2026-06-12), plus the backlog consciously deferred during code and security review. Ordered by impact. Each item ships as its own conventional commit; any frontend change rebuilds the committed bundle (CI enforces this).

Visual design reference for items 1 and 3: the internal doubleSlash plugin [mkdocs-gitlab-comments](https://gitlab.doubleslash.de/doubleSlash/coc-fg/tt-devops/docs-as-code/mkdocs-gitlab-comments) — same problem space (inline comments on MkDocs Material, stored in the forge's issue tracker), with a mature, theme-aware UI. Its `gitlab-comments.css` is the template to borrow from.

## 1. Theme-responsive widget (dark mode is broken)

**Symptom:** with Material's `slate` scheme active, the widget surfaces (popover, panel, buttons) stay white.

**Root cause:** `frontend/src/ghc.css` declares the theme proxies on `:root`:

```css
:root {
  --ghc-bg: var(--md-default-bg-color, #ffffff);
  ...
}
```

CSS custom properties resolve `var()` chains in the scope they are *declared* in. Material declares its `--md-*` vars on `[data-md-color-scheme]` (set on `<body>`), so at `:root` scope `--md-default-bg-color` is undefined and the white fallback always wins. The reference plugin documents and solves exactly this pitfall.

**Fix:**

- Keep only theme-agnostic tokens on `:root` (radii, z-index, highlight yellows).
- Declare all theme-derived tokens on `[data-md-color-scheme]` so they resolve in the same scope Material populates: surface, text, muted text from `--md-default-{bg,fg}-color*`; accent from `--md-accent-fg-color` (not `--md-primary-fg-color`, which collapses to the header navy in slate and is unreadable as text).
- Derive borders and hover states via `color-mix(in srgb, var(--md-default-fg-color) N%, transparent)` instead of fixed grays.
- Add an `[data-md-color-scheme="slate"]` block for darker elevation shadows and adjusted highlight colors so marks stay readable on the dark background.

## 2. Post-create lands in the annotation view, not a dead end

**Symptom:** after **Send**, the composer swaps to "Annotation created: #N" with only a *Close* button (`frontend/src/ui/popover.ts`, composer success branch). To edit, resolve or retract the fresh annotation (UC-4–6) the reviewer must close the popover and click the new highlight again.

**What already works:** the controller registers the created annotation locally and re-renders highlights immediately (`frontend/src/controller.ts`, `createAnnotation`) — only the popover ends in a confirmation cul-de-sac.

**Fix:** on successful create, transition the same popover into the standard detail view (`showDetail`) for the new annotation — quote, comment, edit / resolve / retract actions, link to the issue — anchored to the newly rendered mark.

**Stretch (reference plugin pattern):** optimistic rendering — insert a temp annotation with a sentinel id before the API call returns, reconcile or roll back on response. Only worth it if create latency is felt in practice.

## 3. Visual polish borrowed from the reference design

Cherry-pick from `gitlab-comments.css`, adapted to the `ghc` namespace:

- Radius scale (`sm/md/lg`) instead of a single 4px.
- Layered elevation shadows for popover and panel, with separate stronger slate variants.
- An *active* highlight state (the annotation whose popover is open) visually distinct from hover — ring + stronger underline, with a dark-mode variant.
- Hover ghosts for buttons via accent `color-mix` rather than opacity tricks.

## 4. Deferred review backlog

Carried over from the code/security review of the MVP, unchanged in priority:

- Ship `scope` in the JSON payload so consumers stop depending on the title heuristic (datamodel format addition, backward compatible).
- Parse hardening for an unclosed `<details>` block in an issue body.
- Key the composer draft by selection, not by page (switching selections currently carries the draft text over).
- Surface 429 rate-limit responses in the UI (currently detected, silently dropped).
- Keyboard accessibility for popover and panel (focus trap, Escape, tab order).
- Deduplicate the popover width constant between CSS and TS.
- Before PyPI: pyproject metadata (readme, classifiers, project URLs) and a CI Python version matrix.
