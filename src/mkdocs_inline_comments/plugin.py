from __future__ import annotations

import json
import os
import posixpath
from importlib import metadata, resources
from typing import Optional
from urllib.parse import urlsplit

from mkdocs.config import config_options as c
from mkdocs.config.base import Config
from mkdocs.config.defaults import MkDocsConfig
from mkdocs.exceptions import ConfigurationError
from mkdocs.plugins import BasePlugin
from mkdocs.structure.files import File, Files
from mkdocs.structure.pages import Page

_TOKEN_PATH = "/settings/personal-access-tokens/new"
_ASSET_JS = "assets/ghc/ghc.js"
_ASSET_CSS = "assets/ghc/ghc.css"


def _repo_from_url(repo_url: Optional[str]) -> Optional[str]:
    if not repo_url:
        return None
    path = urlsplit(repo_url).path.strip("/")
    if path.endswith(".git"):
        path = path[: -len(".git")]
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        return None
    return "/".join(parts[:2])


class InlineCommentsConfig(Config):
    enabled = c.Type(bool, default=True)
    label = c.Type(str, default="docs-review")
    api_base_url = c.URL(default="https://api.github.com")
    issues_repo = c.Optional(c.Type(str))
    src_prefix = c.Optional(c.Type(str))
    token_url = c.Optional(c.URL())
    content_selector = c.Optional(c.Type(str))


class InlineCommentsPlugin(BasePlugin[InlineCommentsConfig]):
    _repo: str
    _src_prefix: str
    _token_url: Optional[str]
    _client: str

    def on_config(self, config: MkDocsConfig) -> MkDocsConfig:
        if not self.config.enabled:
            return config
        repo = self.config.issues_repo or _repo_from_url(config.repo_url)
        if not repo:
            raise ConfigurationError(
                "inline-comments: set 'issues_repo' (owner/repo) or a 'repo_url' it can be derived from"
            )
        self._repo = repo
        self._src_prefix = self._derive_src_prefix(config)
        self._token_url = self._derive_token_url()
        try:
            version = metadata.version("mkdocs-inline-comments")
        except metadata.PackageNotFoundError:
            version = "dev"
        self._client = f"mkdocs-inline-comments/{version}"
        script = c.ExtraScriptValue(_ASSET_JS)
        script.defer = True
        config.extra_javascript.append(script)
        config.extra_css.append(_ASSET_CSS)
        return config

    def _derive_src_prefix(self, config: MkDocsConfig) -> str:
        prefix = self.config.src_prefix
        if prefix is None:
            rel = os.path.relpath(config.docs_dir, os.path.dirname(config.config_file_path))
            rel = rel.replace(os.sep, "/")
            if rel == ".":
                prefix = ""
            elif rel.startswith(".."):
                raise ConfigurationError(
                    "inline-comments: docs_dir lies outside the config file directory; set 'src_prefix' explicitly"
                )
            else:
                prefix = rel
        return prefix.strip("/")

    def _derive_token_url(self) -> Optional[str]:
        if self.config.token_url is not None:
            return self.config.token_url
        api = self.config.api_base_url.rstrip("/")
        if api == "https://api.github.com":
            return "https://github.com" + _TOKEN_PATH
        if api.endswith("/api/v3"):
            return api[: -len("/api/v3")] + _TOKEN_PATH
        return None

    def on_files(self, files: Files, *, config: MkDocsConfig) -> Files:
        if not self.config.enabled:
            return files
        pkg = resources.files("mkdocs_inline_comments")
        for name, src_uri in (("ghc.js", _ASSET_JS), ("ghc.css", _ASSET_CSS)):
            content = (pkg / "assets" / name).read_text(encoding="utf-8")
            files.append(File.generated(config, src_uri, content=content))
        return files

    def on_page_content(self, html: str, *, page: Page, config: MkDocsConfig, files: Files) -> str:
        if not self.config.enabled:
            return html
        payload = {
            "ghc": 1,
            "src": posixpath.join(self._src_prefix, page.file.src_uri),
            "page": page.url,
            "repo": self._repo,
            "apiBaseUrl": self.config.api_base_url.rstrip("/"),
            "label": self.config.label,
            "tokenUrl": self._token_url,
            "client": self._client,
            "contentSelector": self.config.content_selector,
        }
        tag = json.dumps(payload).replace("<", "\\u003c")
        return f'{html}\n<script type="application/json" id="ghc-config">{tag}</script>'
