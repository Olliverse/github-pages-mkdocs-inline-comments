# github-pages-mkdocs-inline-comments

An mkdocs plugin idea: inline commenting on rendered GitHub Pages docs. Reviewers select text on a published docs page and leave a comment directly there; each comment is stored as a GitHub issue with text-anchor metadata pointing at the commented passage. Because the findings live in GitHub, they can be retrieved via the `gh` CLI, handed to an AI agent that fixes the docs, and closed when resolved.

**Status:** MVP implemented — the `mkdocs-inline-comments` plugin and its widget live in this repo and run on the design site itself (not yet on PyPI). The design (ADRs, use cases, quality debt records) lives in [`docs/`](docs/) and is published at <https://olliverse.github.io/github-pages-mkdocs-inline-comments/>.

## Reviewer setup: the access token

The widget authenticates with a **fine-grained personal access token** you create once ([ADR-001](docs/adr/0001-static-pat-auth.md)). Best practice:

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token.
2. **Repository access:** *Only select repositories* → the docs repository alone.
3. **Permissions:** Issues → *Read and write*. Nothing else (Metadata read is added automatically).
4. Set a **short expiration** matching the review period, paste the token into the widget, and **revoke it when the review is done**.

Mind where the token lives: the widget keeps it unencrypted in the browser's `localStorage`, and on GitHub Pages **all project sites of one account share a single origin** — every other Pages site that account publishes can read it ([QDR-003](docs/qdr/0003-shared-origin-token-exposure.md)). The minimal scope above is the damage bound, not a nicety: a stolen token can only touch issues on the one docs repo. Don't paste a broader token, and think twice on org accounts hosting many Pages sites (hardening options are weighed in [ADR-005](docs/adr/0005-token-storage-hardening.md)).

## Local docs

```sh
docker compose up -d
```

Serves the design site at <http://localhost:18000/> with live reload; stop with `docker compose down`.

## License

[Apache-2.0](LICENSE)
