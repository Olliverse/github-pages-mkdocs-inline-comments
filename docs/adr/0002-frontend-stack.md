# ADR-002: Frontend widget stack — vanilla TypeScript, esbuild, zero runtime dependencies

**Status:** accepted · **Date:** 2026-06-11

## Context

The comment widget is JavaScript injected by the MkDocs plugin into arbitrary docs sites. Its responsibilities are small (selection handling, a popover, quote-selector anchoring, GitHub API calls) but security-sensitive: it handles the reviewer's PAT ([ADR-001](0001-static-pat-auth.md)). Anything bundled into it ships to every site using the plugin, so the supply chain must stay auditable.

The Python side needs no decision of its own: MkDocs' native plugin API (`BasePlugin` + typed config + `mkdocs.plugins` entry point) is the only sanctioned mechanism, packaged with hatchling and a `src/` layout. `pip install` must not require Node.

Considered for the widget: a UI framework (React/Preact/Vue) vs. vanilla TypeScript; npm dependencies vs. zero-dep; building the JS during wheel build vs. committing the build output.

## Decision

- **Vanilla TypeScript, no runtime framework.** The UI surface (floating button, popover, highlights) does not justify a framework's weight or dependency tree.
- **esbuild as the only build tool**, source in `frontend/`, output bundled to `src/mkdocs_github_comments/assets/ghc.js` + `ghc.css`.
- **Zero runtime npm dependencies.** The one functional candidate — Hypothesis' MIT-licensed `dom-anchor-text-quote` for TextQuoteSelector anchoring — is vendored/ported into the source tree instead of imported, keeping the dependency count at zero.
- **Build output is committed.** Installing or building the Python package never invokes Node; CI rebuilds the bundle from the TypeScript source and fails on diff, so the committed artifact cannot drift.

## Consequences

- **+** Fully auditable bundle for PAT-handling code; no transitive npm tree to review.
- **+** Wheel build and `pip install` stay Node-free and dumb.
- **+** Minimal payload injected into every docs page.
- **−** Hand-written DOM code instead of framework conveniences; accepted at this UI size.
- **−** Committed artifacts require the CI rebuild-and-diff guard to stay honest.
- **→** If the widget grows real UI complexity (threads, filtering, settings panels), revisit with Preact as the candidate — separate ADR.
