# SPDX-License-Identifier: MIT
"""MkDocs hooks for the documentation site (mkdocs.yml `hooks:`).

Facts the repository already holds are read from it at build time, so a page never repeats them by hand:

- `<!-- authority-key -->` and `<!-- authority-fingerprint -->` become the registry's authority key (authority.pub)
  and its fingerprint, the first 64 bits of SHA-256 over the raw Ed25519 key as four groups of four hex digits,
  the form the app shows when a registry is added;
- `<!-- tool-facts -->` on a catalogue page (`docs/catalogue/<tool folder>.md`) becomes the tool's version, tool API,
  author, surfaces, remote use, licence and registry listing, from its tool.json, its script and registry.json;
- `<!-- registry-format -->` becomes registry.json's `format`.

The house style that Vale cannot see is checked here, as warnings, which `mkdocs build --strict` turns into
failures:

- every page ends with a `## Next` section;
- no process codes or story framing (docs-and-comments rule of the APRScaching repository);
- no box-drawing diagrams in fenced blocks: diagrams are Mermaid;
- a list starts after a blank line, or MkDocs renders its items as paragraph text;
- every tool directory has its catalogue page, listed in the catalogue index, and a catalogue page's
  **Permissions** table names exactly the permissions its manifest asks for.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
from pathlib import Path

log = logging.getLogger("mkdocs.plugins.site-checks")

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
REPO = "https://github.com/apachler/aprscaching-tools"

_tools: dict[str, dict] = {}
_registry: dict = {}
_authority = ""


def _b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def fingerprint(key: str) -> str:
    digest = hashlib.sha256(_b64url(key)).hexdigest()[:16]
    return " ".join(digest[i : i + 4] for i in range(0, 16, 4))


def _spdx(script: Path) -> str:
    if not script.exists():
        return ""
    for line in script.read_text(encoding="utf8").splitlines()[:5]:
        m = re.search(r"SPDX-License-Identifier:\s*(\S+)", line)
        if m:
            return m.group(1)
    return ""


def on_config(config):
    global _registry, _authority
    _tools.clear()
    for d in sorted(p for p in TOOLS.iterdir() if (p / "tool.json").is_file()):
        manifest = json.loads((d / "tool.json").read_text(encoding="utf8"))
        manifest["_licence"] = _spdx(d / manifest.get("entry", "tool.js"))
        _tools[d.name] = manifest
    _registry = json.loads((ROOT / "registry.json").read_text(encoding="utf8"))
    _authority = (ROOT / "authority.pub").read_text(encoding="utf8").strip()
    return config


def on_files(files, config):
    for name in _tools:
        if not files.get_file_from_path(f"catalogue/{name}.md"):
            log.warning("tools/%s has no catalogue page docs/catalogue/%s.md", name, name)
    return files


def _facts(name: str) -> str:
    m = _tools[name]
    entry = next((e for e in _registry.get("entries", []) if e.get("name") == m.get("name")), None)
    surfaces = ", ".join(f"`{s}`" for s in (m.get("surfaces") or ["web"]))
    remote = "Connected peers may run the commands it opens to them" if m.get("remote") else "The operator's alone"
    listed = (
        f"Listed, as version {entry['version']}" if entry and entry.get("version") else "Not listed"
    )
    rows = [
        ("Manifest name", f"`{m.get('name')}`"),
        ("Version", m.get("version", "")),
        ("Tool API", f"`{m.get('api', '')}`, the minimum it needs"),
        ("Author", m.get("author", "")),
        ("Shows on", surfaces),
        ("Commands", remote),
        ("Licence", m.get("_licence") or "see its README"),
        ("In the project registry", listed),
        ("Source", f"[`tools/{name}/`]({REPO}/tree/dev/tools/{name})"),
    ]
    return "| | |\n|---|---|\n" + "\n".join(f"| {k} | {v} |" for k, v in rows) + "\n"


_PROCESS = re.compile(
    r"\b(M[0-9]|Stage [0-9][A-Z]?|Phase [A-Z0-9]|Slice [A-Z]|SR-[A-Z]+-[0-9]+|ADR-[0-9]+[a-z]?|[HWT][1-6][a-e]?)\b"
)
_STORY = re.compile(
    r"\b(for now|previously|used to|originally|reborn|greenfield|the previous)\b", re.I
)
_BOX = re.compile(r"[─-╿]")
_LIST = re.compile(r"^(\s*)([-*+]|[0-9]+\.)\s")


def _check(markdown: str, where: str) -> None:
    lines = markdown.splitlines()
    fence = None
    fence_lang = ""
    prev = ""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        m = re.match(r"^\s*(```+|~~~+)(\S*)", line)
        if m:
            if fence is None:
                fence, fence_lang = m.group(1), m.group(2)
            elif stripped.startswith(fence):
                fence = None
            prev = line
            continue
        if fence is not None:
            if fence_lang != "mermaid" and _BOX.search(line):
                log.warning("%s:%d: a box-drawing character in a fenced block; draw diagrams in Mermaid", where, i)
            prev = line
            continue
        text = re.sub(r"`[^`]*`", "", line)
        text = re.sub(r"\]\([^)]*\)", "]", text)
        if _PROCESS.search(text):
            log.warning("%s:%d: a process code (%s); name the thing", where, i, _PROCESS.search(text).group(0))
        if _STORY.search(text):
            log.warning("%s:%d: story framing (%s); say what is, in the present", where, i, _STORY.search(text).group(0))
        if _LIST.match(line) and prev.strip() and not _LIST.match(prev) and not prev.startswith((" ", "\t", "|", "#", "<!--")):
            if not _LIST.match(line).group(1):
                log.warning("%s:%d: a list right after a paragraph; put a blank line before it", where, i)
        prev = line
    headings = [l for l in lines if l.startswith("## ")]
    if not headings or headings[-1].strip() != "## Next":
        log.warning("%s: the page does not end with a '## Next' section", where)


def _permissions_table(markdown: str) -> list[str] | None:
    m = re.search(r"^## Permissions\s*$(.*?)(?=^## |\Z)", markdown, re.M | re.S)
    if not m:
        return None
    return re.findall(r"^\|\s*`([a-z]+)`\s*\|", m.group(1), re.M)


def on_page_markdown(markdown, page, config, files):
    where = page.file.src_uri
    markdown = markdown.replace("<!-- authority-key -->", _authority)
    markdown = markdown.replace("<!-- authority-fingerprint -->", fingerprint(_authority))
    markdown = markdown.replace("<!-- registry-format -->", str(_registry.get("format", "")))

    m = re.fullmatch(r"catalogue/([a-z0-9-]+)\.md", where)
    tool = m.group(1) if m and m.group(1) != "index" else None
    if tool:
        if tool not in _tools:
            log.warning("%s: a catalogue page for '%s', which tools/ does not have", where, tool)
        else:
            manifest = _tools[tool]
            title = re.search(r"^# (.+)$", markdown, re.M)
            if not title or title.group(1).strip() != manifest.get("title"):
                log.warning("%s: the title is not the manifest's title '%s'", where, manifest.get("title"))
            listed = _permissions_table(markdown)
            asked = manifest.get("permissions", [])
            if listed is None:
                log.warning("%s: no '## Permissions' section", where)
            elif sorted(listed) != sorted(asked):
                log.warning("%s: the Permissions table lists %s; the manifest asks for %s", where, listed, asked)
            if any(p in asked for p in ("tx", "beacon")) and "## What it transmits" not in markdown:
                log.warning("%s: a tool holding tx or beacon needs a '## What it transmits' section", where)
            if "<!-- tool-facts -->" not in markdown:
                log.warning("%s: no <!-- tool-facts --> marker", where)
            markdown = markdown.replace("<!-- tool-facts -->", _facts(tool))

    if where == "catalogue/index.md":
        for name in _tools:
            if f"({name}.md)" not in markdown:
                log.warning("%s: the catalogue index does not link %s.md", where, name)
        # each row's permissions column must match the manifest
        for name, perms in re.findall(r"^\| \[[^\]]+\]\(([a-z0-9-]+)\.md\) \|.*\| ((?:`[a-z]+` ?)+)\|$", markdown, re.M):
            listed = re.findall(r"`([a-z]+)`", perms)
            if name in _tools and sorted(listed) != sorted(_tools[name].get("permissions", [])):
                log.warning("%s: the row for %s lists %s; the manifest asks for %s", where, name, listed,
                            _tools[name].get("permissions"))

    _check(markdown, where)
    return markdown


def on_post_page(output, page, config):
    # Mermaid loads only on a page with a diagram, from the site's own copy (scripts/fetch-mermaid.mjs). Material
    # draws the diagrams with the `mermaid` global once it exists, and fetches nothing from a CDN.
    if 'class="mermaid"' not in output:
        return output
    depth = page.url.count("/")
    src = "../" * depth + "assets/vendor/mermaid.min.js"
    if not (Path(config["docs_dir"]) / "assets" / "vendor" / "mermaid.min.js").exists():
        log.warning("%s: no assets/vendor/mermaid.min.js; run node scripts/fetch-mermaid.mjs", page.file.src_uri)
    setup = "../" * depth + "javascripts/mermaid-setup.js"
    tags = f'<script src="{src}"></script>\n<script src="{setup}"></script>\n'
    return output.replace("</head>", tags + "</head>", 1)
