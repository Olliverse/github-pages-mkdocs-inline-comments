# github-pages-mkdocs-inline-comments

An mkdocs plugin idea: inline commenting on rendered GitHub Pages docs. Reviewers select text on a published docs page and leave a comment directly there; each comment is stored as a GitHub issue with text-anchor metadata pointing at the commented passage. Because the findings live in GitHub, they can be retrieved via the `gh` CLI, handed to an AI agent that fixes the docs, and closed when resolved.

**Status:** design phase — no code yet. The design (ADRs, use cases, quality debt records) lives in [`docs/`](docs/) and is published at <https://olliverse.github.io/github-pages-mkdocs-inline-comments/>.

## Local docs

```sh
docker compose up -d
```

Serves the design site at <http://localhost:18000/> with live reload; stop with `docker compose down`.

## License

[Apache-2.0](LICENSE)
