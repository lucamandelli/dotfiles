import importlib.util
import io
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("review_skills", Path(__file__).parents[1] / "review-skills.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class ReviewSkillsTest(unittest.TestCase):
    def test_install_cached_offline_and_version_mismatch(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"XDG_DATA_HOME": str(Path(directory) / "data")}):
            home = Path(directory)
            binary = home / "installs/hunk/1.2.3/hunk"
            binary.parent.mkdir(parents=True)
            binary.touch()
            archive = io.BytesIO()
            with tarfile.open(fileobj=archive, mode="w:gz") as tar:
                content = b"release skill"
                info = tarfile.TarInfo("hunk-1.2.3/packages/hunk/skills/hunk-review/SKILL.md")
                info.size = len(content)
                tar.addfile(info, io.BytesIO(content))
            link = home / ".agents/skills/hunk-review"
            cached = home / "data/dotfiles/review-skills/hunk-review/1.2.3/SKILL.md"
            with patch.object(setup.subprocess, "check_output", return_value=str(binary)), patch.object(setup, "urlopen", return_value=io.BytesIO(archive.getvalue())) as download:
                setup.install_skill(home, "mise", "hunk")
                setup.install_skill(home, "mise", "hunk")
                self.assertEqual(download.call_count, 1)
                self.assertIn("/v1.2.3.tar.gz", download.call_args.args[0])
            self.assertEqual(link.resolve(), cached.parent)
            self.assertEqual(cached.read_bytes(), b"release skill")
            binary2 = home / "installs/hunk/1.2.4/hunk"
            binary2.parent.mkdir(parents=True)
            binary2.touch()
            with patch.object(setup.subprocess, "check_output", return_value=str(binary2)), patch.object(setup, "urlopen", side_effect=OSError("offline")):
                setup.install_skill(home, "mise", "hunk")
            self.assertFalse(link.is_symlink())
            self.assertTrue(cached.is_file())


if __name__ == "__main__":
    unittest.main()
