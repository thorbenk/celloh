"""Exercise archive validation before audio is installed into the deployment."""

import hashlib
import io
import json
import runpy
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPERS = runpy.run_path(str(ROOT / "scripts" / "fetch-audio.py"))
INSTALL = HELPERS["install_bundle"]
SOUNDFONT_SHA256 = "1" * 64


def bundle(extra: str | None = None, missing: str | None = None, wrong_source: bool = False) -> bytes:
    manifest = {
        "pitches": list(range(36, 82)),
        "soundfontSha256": "2" * 64 if wrong_source else SOUNDFONT_SHA256,
    }
    files = {f"{pitch}.mp3": b"sample" for pitch in range(36, 82)}
    files["manifest.json"] = json.dumps(manifest).encode()
    if extra:
        files[extra] = b"unexpected"
    if missing:
        del files[missing]
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode="w:gz") as archive:
        for name, data in files.items():
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
    return result.getvalue()


class AudioBundleTests(unittest.TestCase):
    def test_complete_bundle_installs(self) -> None:
        data = bundle()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "audio"
            INSTALL(data, hashlib.sha256(data).hexdigest(), target, SOUNDFONT_SHA256)
            self.assertEqual(len(list(target.iterdir())), 47)
            self.assertEqual((target / "36.mp3").read_bytes(), b"sample")

    def test_corruption_does_not_replace_existing_audio(self) -> None:
        data = bundle()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / "36.mp3").write_bytes(b"existing")
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                INSTALL(data + b"corrupt", hashlib.sha256(data).hexdigest(), target, SOUNDFONT_SHA256)
            self.assertEqual((target / "36.mp3").read_bytes(), b"existing")

    def test_missing_and_unsafe_entries_are_rejected_before_install(self) -> None:
        for data in (bundle(missing="81.mp3"), bundle(extra="../outside")):
            with self.subTest(), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / "audio"
                with self.assertRaisesRegex(ValueError, "unexpected files"):
                    INSTALL(data, hashlib.sha256(data).hexdigest(), target, SOUNDFONT_SHA256)
                self.assertFalse(target.exists())

    def test_wrong_soundfont_is_rejected(self) -> None:
        data = bundle(wrong_source=True)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "audio"
            with self.assertRaisesRegex(ValueError, "manifest"):
                INSTALL(data, hashlib.sha256(data).hexdigest(), target, SOUNDFONT_SHA256)
            self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
