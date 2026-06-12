import json
import re

import pytest
from mkdocs.config.defaults import MkDocsConfig
from mkdocs.exceptions import ConfigurationError
from mkdocs.structure.files import File, Files
from mkdocs.structure.pages import Page

from mkdocs_inline_comments.plugin import InlineCommentsPlugin

TAG_RE = re.compile(r'<script type="application/json" id="ghc-config">(.*?)</script>', re.S)


def make_plugin(**options):
    plugin = InlineCommentsPlugin()
    errors, warnings = plugin.load_config(options)
    assert not errors, errors
    assert not warnings, warnings
    return plugin


def make_mkdocs_config(tmp_path, config_dir=None, docs_dir=None, **overrides):
    config_dir = config_dir or tmp_path
    config_dir.mkdir(parents=True, exist_ok=True)
    docs = docs_dir or (config_dir / "docs")
    docs.mkdir(parents=True, exist_ok=True)
    config_file = config_dir / "mkdocs.yml"
    config_file.touch()
    cfg = MkDocsConfig(config_file_path=str(config_file))
    cfg.load_dict({"site_name": "fixture", "docs_dir": str(docs), **overrides})
    errors, _ = cfg.validate()
    assert not errors, errors
    return cfg


def page_payload(plugin, cfg, src_uri="use-cases.md"):
    file = File(src_uri, cfg.docs_dir, cfg.site_dir, cfg.use_directory_urls)
    page = Page("Title", file, cfg)
    html = plugin.on_page_content("<p>body</p>", page=page, config=cfg, files=Files([]))
    match = TAG_RE.search(html)
    assert match, html
    return json.loads(match.group(1))


def test_defaults():
    plugin = make_plugin()
    assert plugin.config.enabled is True
    assert plugin.config.label == "docs-review"
    assert plugin.config.api_base_url == "https://api.github.com"
    assert plugin.config.issues_repo is None
    assert plugin.config.src_prefix is None
    assert plugin.config.token_url is None
    assert plugin.config.content_selector is None


def test_issues_repo_derived_from_repo_url(tmp_path):
    plugin = make_plugin()
    cfg = make_mkdocs_config(tmp_path, repo_url="https://github.com/acme/widget.git")
    plugin.on_config(cfg)
    payload = page_payload(plugin, cfg)
    assert payload["repo"] == "acme/widget"


def test_explicit_issues_repo_wins(tmp_path):
    plugin = make_plugin(issues_repo="acme/reviews")
    cfg = make_mkdocs_config(tmp_path, repo_url="https://github.com/acme/widget")
    plugin.on_config(cfg)
    assert page_payload(plugin, cfg)["repo"] == "acme/reviews"


def test_error_without_repo(tmp_path):
    plugin = make_plugin()
    cfg = make_mkdocs_config(tmp_path)
    with pytest.raises(ConfigurationError):
        plugin.on_config(cfg)


def test_src_prefix_derived(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    payload = page_payload(plugin, cfg)
    assert payload["src"] == "docs/use-cases.md"
    assert payload["page"] == "use-cases/"


def test_src_prefix_explicit(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget", src_prefix="documentation/handbook")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    assert page_payload(plugin, cfg)["src"] == "documentation/handbook/use-cases.md"


def test_src_prefix_outside_config_dir_errors(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget")
    cfg = make_mkdocs_config(tmp_path, config_dir=tmp_path / "site", docs_dir=tmp_path / "docs")
    with pytest.raises(ConfigurationError):
        plugin.on_config(cfg)


def test_token_url_github_com(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    assert page_payload(plugin, cfg)["tokenUrl"] == "https://github.com/settings/personal-access-tokens/new"


def test_token_url_ghes(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget", api_base_url="https://ghe.example.com/api/v3")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    payload = page_payload(plugin, cfg)
    assert payload["apiBaseUrl"] == "https://ghe.example.com/api/v3"
    assert payload["tokenUrl"] == "https://ghe.example.com/settings/personal-access-tokens/new"


def test_token_url_underivable_is_null(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget", api_base_url="https://proxy.example.com/github")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    assert page_payload(plugin, cfg)["tokenUrl"] is None


def test_assets_registered(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    scripts = [str(s) for s in cfg.extra_javascript]
    assert "assets/ghc/ghc.js" in scripts
    assert cfg.extra_javascript[-1].defer is True
    assert "assets/ghc/ghc.css" in [str(s) for s in cfg.extra_css]
    cfg.plugins._current_plugin = "inline-comments"
    files = plugin.on_files(Files([]), config=cfg)
    assert {f.src_uri for f in files} == {"assets/ghc/ghc.js", "assets/ghc/ghc.css"}


def test_payload_escapes_angle_brackets(tmp_path):
    plugin = make_plugin(issues_repo="acme/widget", label="</script><script>alert(1)</script>")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    file = File("use-cases.md", cfg.docs_dir, cfg.site_dir, cfg.use_directory_urls)
    page = Page("Title", file, cfg)
    html = plugin.on_page_content("<p>body</p>", page=page, config=cfg, files=Files([]))
    payload_raw = TAG_RE.search(html).group(1)
    assert "</script><script>" not in payload_raw
    assert json.loads(payload_raw)["label"] == "</script><script>alert(1)</script>"


def test_disabled_is_inert(tmp_path):
    plugin = make_plugin(enabled=False, issues_repo="acme/widget")
    cfg = make_mkdocs_config(tmp_path)
    plugin.on_config(cfg)
    assert cfg.extra_javascript == []
    files = plugin.on_files(Files([]), config=cfg)
    assert len(files) == 0
    file = File("use-cases.md", cfg.docs_dir, cfg.site_dir, cfg.use_directory_urls)
    page = Page("Title", file, cfg)
    assert plugin.on_page_content("<p>body</p>", page=page, config=cfg, files=Files([])) == "<p>body</p>"
