# github-pages-mkdocs-inline-comments

An mkdocs plugin idea: inline commenting on rendered GitHub Pages docs. Readers select text on a published docs page and leave a comment directly there; each comment is stored as a GitHub Issue or Discussion with text-anchor metadata pointing at the commented passage. Because the findings live in GitHub, they can be retrieved via the `gh` CLI, handed to an AI agent that fixes the docs, and closed when resolved.

Status: design phase — see docs/

## Local docs

```sh
pip install -r requirements.txt
mkdocs serve
```
