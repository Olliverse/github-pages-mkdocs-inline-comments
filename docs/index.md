# github-pages-mkdocs-inline-comments

Hello! This is the design site for an MkDocs plugin that brings **inline review comments to rendered GitHub Pages**: select text on a published docs page, write a comment, send — and the finding lands as a GitHub issue, anchored to the exact passage. Because findings live in GitHub, they can be pulled via the `gh` CLI, handed to an AI agent that fixes the docs, and closed when resolved.

**Status:** design phase — no code yet.

## Where to look

- [Use Cases](use-cases.md) — the six things the MVP delivers, in session order
- [Data Model](datamodel.md) — the annotation format: how an issue body encodes the anchor, and the contract for consumers
- ADRs — the decisions: static PAT auth, zero-dep widget stack, issues as comment store, one issue per annotation
- QDRs — debt we accepted consciously: orphaned annotations, the silent unauthenticated state
