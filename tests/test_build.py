import json
import re
from pathlib import Path

from mkdocs.commands.build import build
from mkdocs.config import load_config

FIXTURE = Path(__file__).parent / "fixture"
TAG_RE = re.compile(r'<script type="application/json" id="ghc-config">(.*?)</script>', re.S)


def ghc_config(html):
    match = TAG_RE.search(html)
    assert match, "ghc-config tag missing"
    return json.loads(match.group(1))


def test_build_injects_widget(tmp_path):
    cfg = load_config(str(FIXTURE / "mkdocs.yml"), site_dir=str(tmp_path))
    build(cfg)

    assert (tmp_path / "assets/ghc/ghc.js").is_file()
    assert (tmp_path / "assets/ghc/ghc.css").is_file()

    index = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert re.search(r'<script src="[^"]*assets/ghc/ghc\.js" defer></script>', index)
    assert 'assets/ghc/ghc.css' in index
    data = ghc_config(index)
    assert data["src"] == "docs/index.md"
    assert data["repo"] == "acme/widget-fixture"
    assert data["label"] == "docs-review"
    assert data["apiBaseUrl"] == "https://api.github.com"
    assert data["client"].startswith("mkdocs-inline-comments/")

    sub = (tmp_path / "sub/page/index.html").read_text(encoding="utf-8")
    data = ghc_config(sub)
    assert data["src"] == "docs/sub/page.md"
    assert data["page"] == "sub/page/"
