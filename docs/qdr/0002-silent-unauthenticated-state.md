# QDR-002: Silent unauthenticated state — the widget is undiscoverable

**Status:** open · **Date:** 2026-06-11

## Debt

By design, without a stored token the widget fetches nothing and renders nothing on page load: anonymous readers get a plain docs site — no nagging, no API traffic. The deliberate flip side:

- A reviewer who doesn't already know the widget exists gets no hint from the page itself. Onboarding relies entirely on out-of-band knowledge.
- A *broken* setup (expired or revoked token) degrades into the same silence on page load — indistinguishable from "no comments on this page" until the panel is opened and the API error surfaces.

## Impact

- Review capability is invisible to new reviewers; adoption depends on someone telling them.
- An expired token can silently hide existing annotations, making a review look further along than it is.

## Mitigation candidates

- A discreet, always-rendered entry point (small icon in footer or header) — minimal presence, restores discoverability.
- A URL parameter (e.g. `?review=1`) that opens the panel/token form directly — gives review requests a shareable onboarding link.
- Distinguish *no token* (stay silent) from *token present but rejected* (visible badge or console warning) so broken setups don't masquerade as empty reviews.
- A setup page on the docs site itself that review requests can link to.

## Status

Accepted for the MVP: silence is the chosen default; onboarding happens out-of-band. Revisit after the first real review pass — the no-token/invalid-token distinction is the cheapest candidate and addresses the worse half of the debt.
