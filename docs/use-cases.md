# Use cases — MVP

The MVP delivers exactly two use cases. Everything else — rendering existing annotations as highlights, reply threads, OAuth sign-in, fix-loop tooling — is explicitly out of scope and listed at the bottom.

**Actor** in both cases: the **Reviewer** — a person reading the rendered docs site in a browser who has (or can create) a GitHub account with access to the target repository.

## UC-1: Store a PAT

**Goal:** the widget can authenticate API calls as the reviewer.

**Precondition:** the reviewer has a fine-grained PAT scoped to the target repository with Issues read/write ([ADR-001](adr/0001-static-pat-auth.md)). The widget links to the token-creation page of the configured GitHub instance.

**Trigger:** the reviewer opens the widget's settings, or attempts UC-2 without a stored token.

**Main flow:**

1. Reviewer opens the token form and pastes the PAT.
2. Widget validates the token with `GET /user` against the configured API base URL.
3. Widget stores the token in `localStorage` and displays the authenticated login as confirmation.

**Alternative flows:**

- *Invalid token / no repo access:* widget shows the API error; nothing is stored.
- *Sign out:* reviewer clears the token; widget removes it from `localStorage` and returns to the unauthenticated state.

**Postcondition:** subsequent API calls carry the token as an `Authorization` header to the configured API base URL — the token never leaves the browser in any other way.

## UC-2: Create an inline comment

**Goal:** an inline finding on the rendered page becomes a GitHub issue carrying the anchor metadata.

**Precondition:** UC-1 completed (token stored); the page was built with the plugin, so it carries its source path (`src_uri`) and the widget assets.

**Trigger:** the reviewer selects text inside the page's content area.

**Main flow:**

1. A floating action button appears next to the selection.
2. Reviewer clicks it; a popover with a comment field opens, showing the selected text as a quote.
3. Reviewer writes the comment and sends.
4. Widget computes the TextQuoteSelector (exact quote, prefix, suffix) for the selection.
5. Widget creates the issue via `POST /repos/{owner}/{repo}/issues`: self-describing title (page + quote excerpt), human-readable body plus the machine-readable annotation block (see annotation format spec), the configured label. One issue per annotation ([ADR-004](adr/0004-one-issue-per-annotation.md)).
6. Widget confirms success and links the created issue.

**Alternative flows:**

- *No stored token:* the popover shows the UC-1 token form first, then resumes with the draft intact.
- *API error:* widget shows the error and preserves selection and draft for retry.
- *Selection cleared before sending:* button and popover disappear; nothing happens.

**Postcondition:** an open, labeled issue authored by the reviewer exists, containing everything a consumer needs to locate the finding in the markdown source.

## Out of scope (MVP)

- Displaying existing annotations as highlights on the page
- Replies / threads on annotations
- OAuth "Sign in with GitHub" (v2 path, [ADR-001](adr/0001-static-pat-auth.md))
- Consumer/fix-loop tooling (a prompt convention around `gh issue` suffices, [ADR-003](adr/0003-issues-as-comment-store.md))
- Editing or retracting annotations from the page (use the issue on GitHub directly)
