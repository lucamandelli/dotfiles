#!/usr/bin/env python3
"""Install review skills from the source tags matching the mise binaries."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen

TOOLS = {
    "hunk": ("modem-dev/hunk", "hunk-review", "packages/hunk/skills/hunk-review"),
    "gh-stack": ("github/gh-stack", "gh-stack", "skills/gh-stack"),
}


def install_skill(home, mise, tool):
    repo, skill, source = TOOLS[tool]
    data = Path(os.environ.get("XDG_DATA_HOME", home / ".local/share")) / "dotfiles/review-skills" / skill
    links = [home / ".agents/skills" / skill, home / ".claude/skills" / skill]
    try:
        binary = subprocess.check_output([mise, "which", tool], text=True).strip()
        version = Path(binary).resolve(strict=True).parent.name
        if not re.fullmatch(r"[0-9][A-Za-z0-9.+_-]*", version):
            raise ValueError(f"invalid version: {version}")
        target = data / version
        if not (target / "SKILL.md").is_file():
            data.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=data) as tmp:
                tmp = Path(tmp)
                archive = tmp / "source.tar.gz"
                with urlopen(f"https://github.com/{repo}/archive/refs/tags/v{version}.tar.gz", timeout=30) as response, archive.open("wb") as output:
                    shutil.copyfileobj(response, output)
                with tarfile.open(archive, "r:gz") as tar:
                    prefix = f"{repo.split('/')[-1]}-{version}/{source}/"
                    for member in tar:
                        if member.name.startswith(prefix) and member.isfile():
                            relative = Path(member.name[len(prefix):])
                            if relative.is_absolute() or ".." in relative.parts:
                                raise ValueError("invalid archive path")
                            output = tmp / "skill" / relative
                            output.parent.mkdir(parents=True, exist_ok=True)
                            with tar.extractfile(member) as content, output.open("wb") as dest:
                                shutil.copyfileobj(content, dest)
                if not (tmp / "skill/SKILL.md").is_file():
                    raise ValueError("skill missing from release archive")
                if target.exists():
                    shutil.rmtree(target)
                (tmp / "skill").rename(target)
        for link in links:
            link.parent.mkdir(parents=True, exist_ok=True)
            temporary = link.with_name(link.name + ".new")
            temporary.unlink(missing_ok=True)
            temporary.symlink_to(target)
            temporary.replace(link)
    except (OSError, ValueError, subprocess.SubprocessError, tarfile.TarError) as error:
        # Retain cached copies, but never expose a skill for a different binary.
        for link in links:
            if link.is_symlink() and link.resolve().is_relative_to(data):
                link.unlink()
        print(f"{skill} skill unavailable: {error}", file=sys.stderr)


def main():
    for tool in TOOLS:
        install_skill(Path.home(), sys.argv[1], tool)


if __name__ == "__main__":
    main()
