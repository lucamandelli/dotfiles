#!/usr/bin/env python3
"""Configure native agents without replacing their mutable, machine-local settings."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def run(*args, check=True, **kwargs):
    return subprocess.run(args, check=check, **kwargs)


def configure_codex_hook(home, codex_home):
    # Preserve other hooks and avoid adding a second Plannotator hook.
    path = codex_home / "hooks.json"
    if path.is_symlink():
        raise RuntimeError(f"Refusing to replace symlink {path}")
    config = json.loads(path.read_text()) if path.exists() else {}
    stop = config.setdefault("hooks", {}).setdefault("Stop", [])
    plannotator = str(home / ".local/bin/plannotator")
    if not any(h.get("type") == "command" and h.get("command") in ("plannotator", plannotator)
               for entry in stop for h in entry.get("hooks", [])):
        stop.append({"hooks": [{"type": "command", "command": plannotator, "timeout": 345600}]})
        with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as tmp:
            try:
                json.dump(config, tmp, indent=2)
                tmp.write("\n")
                tmp.flush()
                os.replace(tmp.name, path)
            finally:
                Path(tmp.name).unlink(missing_ok=True)


def main():
    home = Path.home()
    servers = json.loads(Path(sys.argv[1]).read_text())["mcpServers"]
    codex_home = Path(os.environ.get("CODEX_HOME", home / ".codex"))
    codex_home.mkdir(parents=True, exist_ok=True)

    for name, server in servers.items():
        command = [server["command"], *server["args"]]
        # Claude doesn't update an existing user server. Scope removal so project
        # and local registrations and unrelated user servers remain untouched.
        run("claude", "mcp", "remove", "--scope", "user", name,
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run("claude", "mcp", "add", "--scope", "user", name, "--", *command)
        run("codex", "mcp", "add", name, "--", *command)
        run("grok", "mcp", "add", "--scope", "user", name, "--", *command)

    plugins = json.loads(run("claude", "plugin", "list", "--json", capture_output=True, text=True).stdout)
    if not any(p.get("id") == "plannotator@plannotator" and p.get("scope") == "user" and p.get("enabled") for p in plugins):
        run("claude", "plugin", "install", "--marketplace", "https://github.com/backnotprop/plannotator.git", "plannotator", "--scope", "user")

    # Official Codex integration uses an experimental Stop hook.
    run("codex", "features", "enable", "hooks")
    configure_codex_hook(home, codex_home)


if __name__ == "__main__":
    main()
