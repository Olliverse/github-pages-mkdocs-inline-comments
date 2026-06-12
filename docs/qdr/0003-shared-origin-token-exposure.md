# QDR-003: Token readable by every same-account Pages site

**Status:** open · **Date:** 2026-06-12

## Debt

The widget stores the reviewer's PAT unencrypted in `localStorage` under `ghc:token:<api-host>` ([ADR-001](../adr/0001-static-pat-auth.md)). ADR-001 records the XSS-on-the-docs-site exposure — but the actual exposure is wider:

- GitHub Pages **project sites are path-scoped**: every project site of one account lives on the single origin `https://<account>.github.io`. `localStorage` is origin-scoped, so **any other Pages site published by the same user or org can read the token** — no XSS on the docs site required, publishing a sibling repo's Pages site is enough.
- The storage key is scoped by API host, not by repo or site, so sibling sites don't even have to guess: cooperating widget instances on one account deliberately share the token, and hostile ones can enumerate all keys regardless.
- Cross-account sites (`other.github.io`) are separate origins and cannot read it; `github.io` being on the Public Suffix List additionally prevents cookie widening (irrelevant to `localStorage`, which has no widening mechanism).
- A custom domain on the docs repo isolates its origin — but an *account-level* custom domain propagates to all project sites and re-merges them.

## Impact

- The trust boundary is not "the docs site" but "**everything the account ever publishes to Pages**" — including forgotten experiments and forks with Pages enabled, and any third-party script any of those sites embeds.
- Blast radius of a stolen token stays bounded by the fine-grained PAT scope: Issues read/write on the docs repo only — spam, edits, and closing issues as the reviewer; no code, no other repos.

## Mitigation candidates

Decision deliberately left open — see [ADR-005](../adr/0005-token-storage-hardening.md) for the options (sessionStorage, repo-scoped keys, custom domain, short-lived credentials) and their trade-offs.

## Status

Accepted for the MVP: the minimal token scope is the load-bearing damage bound, and the README instructs reviewers accordingly. Revisit before recommending the widget for org accounts with many Pages sites.
