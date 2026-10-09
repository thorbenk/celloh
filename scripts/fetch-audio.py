#!/usr/bin/env python3
"""Install the pinned GitHub Release audio bundle without requiring renderer tools."""

import argparse
import hashlib
import io
import json
import re
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PITCHES = list(range(36, 82))
EXPECTED_FILES = {f"{pitch}.mp3" for pitch in PITCHES} | {"manifest.json"}


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "CellOh-audio-build"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def verify_directory(directory: Path, soundfont_sha256: str) -> None:
    """Reject incomplete recordings and bundles made from a different soundfont."""
    if {path.name for path in directory.iterdir()} != EXPECTED_FILES:
        raise ValueError("Audio must contain exactly 46 MP3s and manifest.json")
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest["pitches"] != PITCHES or manifest["soundfontSha256"] != soundfont_sha256:
        raise ValueError("Audio manifest does not match the expected pitches and soundfont")
    for name in EXPECTED_FILES:
        path = directory / name
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"Missing or empty audio file: {name}")


def install_bundle(data: bytes, checksum: str, output: Path, soundfont_sha256: str) -> None:
    """Check the checksum and all contents before replacing any local recordings."""
    if not re.fullmatch(r"[0-9a-f]{64}", checksum):
        raise ValueError("Invalid audio bundle SHA-256")
    if hashlib.sha256(data).hexdigest() != checksum:
        raise ValueError("Audio bundle SHA-256 mismatch")

    with tempfile.TemporaryDirectory(prefix="celloh-audio-") as directory:
        temporary = Path(directory)
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            members = archive.getmembers()
            if len(members) != len(EXPECTED_FILES) or {m.name for m in members} != EXPECTED_FILES:
                raise ValueError("Audio archive contains missing, duplicate, or unexpected files")
            for member in members:
                if not member.isfile():
                    raise ValueError(f"Audio archive entry must be a regular file: {member.name}")
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError(f"Cannot read audio archive entry: {member.name}")
                with source:
                    (temporary / member.name).write_bytes(source.read())
        verify_directory(temporary, soundfont_sha256)
        output.mkdir(parents=True, exist_ok=True)
        for name in sorted(EXPECTED_FILES):
            (output / name).write_bytes((temporary / name).read_bytes())
        verify_directory(output, soundfont_sha256)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Validate existing audio without downloading")
    args = parser.parse_args()
    config = json.loads((ROOT / "audio-release.json").read_text())
    output = ROOT / "public" / "audio"
    if args.verify:
        verify_directory(output, config["soundfontSha256"])
        print("Verified all 46 cello recordings.")
        return

    repository, tag = config["repository"], config["tag"]
    if not re.fullmatch(r"[\w-]+/[\w.-]+", repository) or not re.fullmatch(r"audio-v[1-9][0-9]*", tag):
        raise ValueError("Invalid audio release repository or tag")
    filename = f"cello-{tag}.tar.gz"
    base = f"https://github.com/{repository}/releases/download/{tag}"
    checksum_text = download(f"{base}/{filename}.sha256").decode("ascii")
    fields = checksum_text.split()
    if len(fields) != 2 or fields[1] != filename:
        raise ValueError("Audio checksum file does not name the expected bundle")
    install_bundle(download(f"{base}/{filename}"), fields[0], output, config["soundfontSha256"])
    print(f"Installed {tag}: 46 verified cello recordings.")


if __name__ == "__main__":
    main()
