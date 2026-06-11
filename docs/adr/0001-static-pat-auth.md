# ADR-001: Fully static authentication via fine-grained PAT

**Status:** accepted · **Date:** 2026-06-11

## Context

The comment widget runs as JavaScript on a static MkDocs site (GitHub Pages) and must create issues in a GitHub repository **as the reviewing user**. Constraints discovered:

- The Pages site (`*.github.io` or a GHES pages host) is a different origin than the GitHub web UI. The viewer's GitHub/SSO session (e.g. WebEAM-gated GHES Pages) authenticates *reading the static files* only; the session cookie is httpOnly, origin-scoped, and never reachable from page JavaScript.
- The GitHub REST API does not accept cookie authentication at all — calls are token-only. This is deliberate CSRF protection; there is no configuration that bridges "logged in to view" and "page may write as me".
- The OAuth web application flow requires a client secret for the code→token exchange, which a static page cannot hold — it forces a server-side component.
- The OAuth device flow cannot run in the browser: GitHub's `login/*` endpoints do not send CORS headers.
- The REST API itself **does** send `Access-Control-Allow-Origin: *` — verified against api.github.com and a GHES 3.19 instance (`/api/v3`). Direct browser→API calls with a token header work on both.

## Decision

The widget authenticates with a **fine-grained personal access token**, created by the reviewer once, scoped to the docs repository with Issues read/write only. The token is pasted into the widget's settings UI and stored in `localStorage`. The API base URL is plugin configuration, so the same code targets `https://api.github.com` and GHES `https://<host>/api/v3`.

No backend is deployed. GitHub is the backend: Issues are the data store, the REST API is the write path.

Token handling is encapsulated behind a small auth interface in the widget so an alternative credential source can be swapped in without touching annotation logic.

## Consequences

- **+** Zero infrastructure: nothing to host, operate, or secure beyond the docs repo itself.
- **+** Works identically on github.com and GitHub Enterprise Server.
- **+** Issues are authored by the reviewer's real account; the normal GitHub permission model applies.
- **−** One-time setup friction per reviewer: create token, paste it. Mitigated by deep-linking to the token settings page from the widget.
- **−** The token sits in `localStorage` and is exposed to any XSS on the docs site. Accepted for trusted, access-controlled docs sites combined with the minimal token scope; not acceptable for sites embedding untrusted third-party scripts.
- **→** A one-click "Sign in with GitHub" (GitHub App + stateless ~50-line token-exchange worker, the giscus model) remains a compatible v2 option behind the same auth interface.
