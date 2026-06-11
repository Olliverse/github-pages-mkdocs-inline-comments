# Use cases — MVP

The MVP delivers the six use cases below, ordered as a review session actually runs: authenticate, see what's already there, create findings, then maintain them. Everything else is explicitly out of scope and listed at the bottom.

**Actor** in all cases: the **Reviewer** — a person reading the rendered docs site in a browser who has (or can create) a GitHub account with access to the target repository.

## UC-1: Store a PAT

**Goal:** the widget can authenticate API calls as the reviewer.

**Precondition:** the reviewer has a fine-grained PAT scoped to the target repository with Issues read/write ([ADR-001](adr/0001-static-pat-auth.md)). The widget links to the token-creation page of the configured GitHub instance.

**Trigger:** the reviewer opens the widget's settings, or attempts any other use case without a stored token.

**Main flow:**

1. Reviewer opens the token form and pastes the PAT.
2. Widget validates the token with `GET /user` against the configured API base URL.
3. Widget stores the token in `localStorage` and displays the authenticated login as confirmation.

**Alternative flows:**

- *Invalid token / no repo access:* widget shows the API error; nothing is stored.
- *Sign out:* reviewer clears the token; widget removes it from `localStorage` and returns to the unauthenticated state.

**Postcondition:** subsequent API calls carry the token as an `Authorization` header to the configured API base URL — the token never leaves the browser in any other way.

## UC-2: View the page's comments

**Goal:** the reviewer sees the open annotations for the current page — as inline highlights in the text and as a list panel — the entry point for UC-4/5/6.

**Precondition:** UC-1 completed (reading issues on access-controlled repos requires the token anyway).

**Trigger:** page load (highlights) or opening the widget's comments panel.

**Main flow:**

1. Widget fetches open issues with the configured label from the API and filters them to the current page's `src_uri` via the annotation block.
2. Each annotation's TextQuoteSelector is re-anchored against the rendered content; the matched range is highlighted.
3. Clicking a highlight opens the annotation's detail popover: quote, comment, author, issue link, and the UC-4/5/6 actions.
4. The panel lists the same annotations: quoted text, comment, author, issue link.

**Alternative flows:**

- *No stored token:* nothing is fetched on page load — the widget stays fully silent by design ([QDR-002](qdr/0002-silent-unauthenticated-state.md)); opening the panel starts UC-1.
- *Selector does not anchor* (quoted text edited or removed): no highlight; the annotation still appears in the panel, marked as not anchorable (anchor orphan, [QDR-001](qdr/0001-orphaned-annotations.md)).
- *No open annotations:* no highlights; panel shows an empty state.
- *API error:* page renders without highlights; panel shows the error.

**Postcondition:** none (read only).

## UC-3: Create an inline comment

**Goal:** an inline finding on the rendered page becomes a GitHub issue carrying the anchor metadata.

**Precondition:** UC-1 completed; the page was built with the plugin, so it carries its source path (`src_uri`) and the widget assets.

**Trigger:** the reviewer selects text inside the page's content area.

**Main flow:**

1. A floating action button appears next to the selection.
2. Reviewer clicks it; a popover with a comment field opens, showing the selected text as a quote.
3. Reviewer writes the comment and sends.
4. Widget computes the TextQuoteSelector (exact quote, prefix, suffix) for the selection.
5. Widget creates the issue via `POST /repos/{owner}/{repo}/issues`: self-describing title (page + quote excerpt), human-readable body plus the machine-readable annotation block (see annotation format spec), the configured label. One issue per annotation ([ADR-004](adr/0004-one-issue-per-annotation.md)).
6. Widget confirms success, links the created issue, and renders the new highlight.

**Alternative flows:**

- *No stored token:* the popover shows the UC-1 token form first, then resumes with the draft intact.
- *API error:* widget shows the error and preserves selection and draft for retry.
- *Selection cleared before sending:* button and popover disappear; nothing happens.

**Postcondition:** an open, labeled issue authored by the reviewer exists, containing everything a consumer needs to locate the finding in the markdown source.

## UC-4: Update a comment

**Goal:** correct or sharpen the comment text of an existing annotation.

**Precondition:** UC-2 shows the annotation; the reviewer is its author (or has write access — enforced by the API, not the widget).

**Main flow:**

1. Reviewer chooses *edit* on the annotation (panel entry or highlight popover) and changes the comment text.
2. Widget updates the issue via `PATCH /repos/{owner}/{repo}/issues/{number}`, regenerating the human-readable body; the annotation block and anchor stay untouched.

**Alternative flows:**

- *API rejects (no permission):* widget shows the error; nothing changes.

**Postcondition:** the issue body carries the new comment text; anchor metadata is unchanged.

## UC-5: Resolve a comment

**Goal:** mark a finding as done.

**Precondition:** UC-2 shows the annotation.

**Main flow:**

1. Reviewer chooses *resolve* on the annotation (panel entry or highlight popover).
2. Widget closes the issue via `PATCH` with `state: closed`, `state_reason: completed`.
3. Highlight and panel entry disappear.

**Postcondition:** the finding no longer appears as actionable to any consumer. (The usual path remains the fix loop closing via `fixes #N` commits — manual resolve covers "fixed otherwise" and "obsolete".)

## UC-6: Delete (retract) a comment

**Goal:** withdraw an annotation that should not have been made.

**Note:** the REST API cannot truly delete issues (only the GraphQL `deleteIssue` mutation can, and it requires repo admin rights). Retraction is therefore mapped to closing with `state_reason: not_planned` — distinguishable from a resolved finding, invisible to consumers, but with an audit trail.

**Main flow:**

1. Reviewer chooses *delete* on the annotation (panel entry or highlight popover) and confirms.
2. Widget closes the issue via `PATCH` with `state: closed`, `state_reason: not_planned`.
3. Highlight and panel entry disappear.

**Postcondition:** the annotation is closed as not-planned; consumers ignore it; repo admins may hard-delete it on GitHub if required.

## Out of scope (MVP)

- Replies / threads on annotations
- OAuth "Sign in with GitHub" (v2 path, [ADR-001](adr/0001-static-pat-auth.md))
- Consumer/fix-loop tooling (a prompt convention around `gh issue` suffices, [ADR-003](adr/0003-issues-as-comment-store.md))
- Orphan reconciliation for deleted/moved pages (tracked as [QDR-001](qdr/0001-orphaned-annotations.md))
- In-page discoverability for unauthenticated reviewers (tracked as [QDR-002](qdr/0002-silent-unauthenticated-state.md))
