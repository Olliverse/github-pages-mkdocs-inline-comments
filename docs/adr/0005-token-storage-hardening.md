# ADR-005: Token storage hardening

**Status:** open — no decision yet · **Date:** 2026-06-12

## Context

[QDR-003](../qdr/0003-shared-origin-token-exposure.md) established that the PAT in `localStorage` is readable by every Pages site of the same account, because all project sites share the origin `<account>.github.io`. The damage is bounded by the fine-grained token scope, but the storage choice deserves a deliberate decision. Candidates, with what they actually buy:

### A. `sessionStorage` instead of `localStorage`

`sessionStorage` is origin-scoped **and per-tab**: a hostile sibling site opened in another tab gets a different storage instance and reads nothing. Exposure shrinks to same-tab navigation (the docs tab navigating to a sibling site keeps the storage alive) and XSS on the docs site itself.

- **+** Strongest cheap isolation; no infrastructure, ~one-line change behind the existing `TokenProvider` seam.
- **−** Reviewer pastes the token again per tab and per browser restart — meaningful friction for the paste-a-PAT flow, and it multiplies the number of times the token transits the clipboard.

### B. Repo-scoped storage keys (`ghc:token:<api-host>:<repo>`)

Honest assessment: **not a security boundary.** `localStorage` is shared per origin; any same-origin script can enumerate all keys. Repo-scoping only prevents *cooperating* widget instances on sibling sites from sharing one token — which is also its cost: today's key means one sign-in covers all docs sites of an account, which is arguably a feature.

- **+** Limits accidental reuse; a leaked token from a low-trust site's storage is at least a different token (if reviewers mint per-repo PATs).
- **−** Zero protection against a hostile sibling; loses single-sign-on across an account's docs sites.

### C. Custom domain for the docs site

A per-repo custom domain is a genuinely separate origin — full isolation from `<account>.github.io`, keeping `localStorage` UX.

- **+** Real origin isolation without code changes.
- **−** Per-site DNS setup, out of the plugin's control; an *account-level* custom domain silently re-merges all project sites onto one origin again.

### D. Short-lived credentials (GitHub App sign-in, the giscus model)

The ADR-001 v2 note: a GitHub App with a stateless token-exchange worker yields short-lived, auto-refreshed tokens — theft loses most of its value. Eliminates the PAT paste entirely.

- **+** Best end state; also fixes the onboarding friction of ADR-001.
- **−** Requires hosting a (tiny) backend component, which ADR-001 deliberately avoided for the MVP.

## Decision

None yet. The MVP ships option-none (status quo, debt recorded in QDR-003); the README's token best practice is the interim mitigation. Decide after real multi-reviewer usage shows whether the per-tab friction of (A) is acceptable or (D) is worth the infrastructure.

## Consequences

Open — to be filled with the decision.
