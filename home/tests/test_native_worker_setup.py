import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace


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


class PluginTest(unittest.TestCase):
    def test_installs_over_https_and_skips_enabled_user_plugin(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            servers = home / "servers.json"
            servers.write_text('{"mcpServers": {}}')
            plugins = []
            calls = []

            def fake_run(*args, **kwargs):
                calls.append(args)
                if args == ("claude", "plugin", "list", "--json"):
                    return SimpleNamespace(stdout=json.dumps(plugins))
                if args[:3] == ("claude", "plugin", "install"):
                    plugins.append({"id": "plannotator@plannotator", "scope": "user", "enabled": True})
                return SimpleNamespace(stdout="")

            with patch.object(setup.Path, "home", return_value=home), patch.dict(setup.os.environ, {"CODEX_HOME": str(home / ".codex")}), patch.object(setup.sys, "argv", ["setup", str(servers)]), patch.object(setup, "run", side_effect=fake_run):
                setup.main()
                setup.main()

            installs = [call for call in calls if call[:3] == ("claude", "plugin", "install")]
            self.assertEqual(installs, [("claude", "plugin", "install", "--marketplace", "https://github.com/backnotprop/plannotator.git", "plannotator", "--scope", "user")])


if __name__ == "__main__":
    unittest.main()
