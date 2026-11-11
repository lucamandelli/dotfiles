import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "native_worker_setup", Path(__file__).parents[1] / "native-worker-setup.py"
)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class CodexHookTest(unittest.TestCase):
    def test_preserves_hooks_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            codex = home / ".codex"
            codex.mkdir()
            path = codex / "hooks.json"
            existing = {"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "other"}]}], "Other": []}}
            path.write_text(json.dumps(existing))
            setup.configure_codex_hook(home, codex)
            first = json.loads(path.read_text())
            setup.configure_codex_hook(home, codex)
            self.assertEqual(first, json.loads(path.read_text()))
            self.assertEqual(first["hooks"]["Other"], [])
            self.assertEqual(first["hooks"]["Stop"][0], existing["hooks"]["Stop"][0])
            self.assertEqual(first["hooks"]["Stop"][1]["hooks"][0]["command"], str(home / ".local/bin/plannotator"))

    def test_existing_relative_hook_is_not_duplicated(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            existing = {"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "plannotator"}]}]}}
            path = home / "hooks.json"
            path.write_text(json.dumps(existing))
            setup.configure_codex_hook(home, home)
            self.assertEqual(json.loads(path.read_text()), existing)

    def test_refuses_to_replace_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            target = home / "other.json"
            target.write_text("{}")
            (home / "hooks.json").symlink_to(target)
            with self.assertRaises(RuntimeError):
                setup.configure_codex_hook(home, home)
            self.assertEqual(target.read_text(), "{}")


if __name__ == "__main__":
    unittest.main()
