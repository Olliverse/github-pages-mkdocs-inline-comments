# ADR-004: One issue per annotation

**Status:** proposed · **Date:** 2026-06-11

## Context

[ADR-003](0003-issues-as-comment-store.md) selected Issues as the comment store but left the granularity open. A review pass over a docs site produces many inline annotations; they could map onto issues in three ways:

- **A — one issue per annotation:** every inline comment is its own issue.
- **B — one issue per page:** the first annotation on a page opens an issue; further annotations on that page become comments on it.
- **C — one issue per review pass:** a session-scoped issue collects all annotations as comments or a checklist.

## Option A: one issue per annotation

**Pros**

- Each finding has the full native lifecycle: closed independently when fixed, reopenable, `fixes #N` per commit works atomically.
- The consumer contract is maximally simple: one open issue = one actionable finding; `--json number,body` returns self-contained work items.
- Per-finding assignment and labeling; partial progress of a review pass is directly visible in open/closed counts.

**Cons**

- Highest issue volume — a thorough pass creates dozens of issues.
- No built-in page- or session-level overview.

## Option B: one issue per page

**Pros**

- Less tracker noise; all discussion about one page lives in one thread.

**Cons**

- Issues close whole: there is no native way to mark three of five findings on a page as fixed. State per finding must be hand-rolled — parsing comments, editing task-list checkboxes in the body (racy with concurrent writers), or encoding state in reactions.
- `fixes #N` automation becomes wrong: one fixed finding would close the page's remaining findings.
- The consumer loop degrades from "list open issues" to a custom state machine over comment threads.

## Option C: one issue per review pass

Same structural cons as B, amplified: the unit of closure (an entire review) is even further from the unit of work (a finding). Additionally couples the widget to a session concept it otherwise doesn't need.

## Decision

**A — one issue per annotation.** The lifecycle argument that selected Issues in ADR-003 only holds at finding granularity; B and C reintroduce exactly the hand-rolled state tracking on top of GitHub that ADR-003 chose Issues to avoid. The volume con is accepted and already contained by the mandatory `docs-review` label and the optional `issues_repo` override.

## Consequences

- The annotation format (spec) describes exactly one annotation per issue body; no aggregation logic in widget or consumer.
- Page- or pass-level overviews can later be layered on as an optional tracking issue with a `- [ ] #123` task list — GitHub auto-checks entries when referenced issues close. Sugar, not core, and fully compatible with A.
- Issue titles must be self-describing (page + quote excerpt) since they are read in lists of many.
