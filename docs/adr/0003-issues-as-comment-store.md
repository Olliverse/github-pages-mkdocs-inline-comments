# ADR-003: GitHub Issues as the comment store

**Status:** proposed · **Date:** 2026-06-11

## Context

Every inline annotation the widget creates must be stored somewhere on GitHub so that (a) it is authored by the reviewer's account, (b) it carries the machine-readable anchor metadata, and (c) an agent can later list open findings via `gh`, fix them, and mark them done. GitHub offers two candidate primitives: Issues and Discussions (the giscus model).

## Option A: Issues

**Pros**

- First-class `gh` CLI support: `gh issue list --label docs-review --state open --json number,body` is the entire consumer query; create/close/comment equally native.
- Real work-item lifecycle: open/closed (and reopen) maps exactly onto finding/fixed — the semantics this tool exists for.
- Plain REST: the widget creates an annotation with a single `POST /repos/{owner}/{repo}/issues`; no ID lookups, no GraphQL client.
- Commit-message automation: `fixes #123` in the fixing commit closes the finding for free.
- Labels, assignees, milestones, and Projects integration give triage and filtering without building anything.
- Identical behavior on github.com and GHES.

**Cons**

- Review annotations land in the issue tracker and mix with real bugs/features; a dedicated label keeps queries clean but issue counts and default lists still show the noise.
- A thorough review pass produces dozens of issues — high volume by issue-tracker standards.
- Linear comment threads only (no nesting); irrelevant for short finding→fix exchanges.
- Noise concern is amplified if the same repo has many non-review issue users; escape hatch is pointing the plugin at a separate review repo, at the cost of one more config value.

## Option B: Discussions

**Pros**

- Semantically "comments on content", not work items — the issue tracker stays clean.
- Proven as a docs-comment backend by giscus; categories group review threads; nested replies support real conversations.
- Threads can be marked "answered".

**Cons**

- GraphQL-only: no REST endpoints exist for repository discussions, so the widget needs mutation documents plus `repositoryId`/`categoryId` lookups before its first write.
- No `gh discussion` subcommand exists, and the gh maintainers explicitly declined to add one — every consumer interaction is a hand-rolled `gh api graphql` query.
- No work-item lifecycle: "answered"/locked is the only state; nothing equivalent to open→closed→reopen, no `fixes #N` automation, no Projects integration.
- Discussions must be enabled per repo and categories created manually before the plugin works.

## Decision

**Issues.** The deciding factor is the consumer loop: this tool's purpose is review-finding → agent-fix → done, which is precisely the issue lifecycle, natively scriptable today. Discussions optimize for conversation, which is not the use case, and their GraphQL-only/no-CLI reality taxes both the widget and every consumer. The tracker-noise con is accepted and mitigated by the mandatory `docs-review` label plus the optional separate-repo escape hatch.

## Consequences

- Widget write path stays one REST call (aligned with the zero-dep budget of [ADR-002](0002-frontend-stack.md)).
- The fix loop can be a prompt convention around `gh issue` with no custom tooling.
- Plugin config gains an optional `issues_repo` override for teams that want annotations out of their main tracker.
- If a public comment-section use case ever emerges, giscus can be added alongside; it does not compete with this decision.
