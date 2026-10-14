#!/usr/bin/env python3
"""Stage the checksum-pinned cello SoundFont for static hosting (no runtime CDN)."""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'audio-release.json').read_text())
output = ROOT / 'public/soundfont/cello_solo.sf2'


def valid(data: bytes) -> bool:
    return hashlib.sha256(data).hexdigest() == config['soundfontSha256']


def main() -> None:
    if output.is_file() and valid(output.read_bytes()):
        return
    local = ROOT / 'references/cello_solo.sf2'
    if local.is_file() and valid(local.read_bytes()):
        data = local.read_bytes()
    else:
        request = urllib.request.Request(config['soundfontUrl'], headers={'User-Agent': 'CellOh-build'})
        with urllib.request.urlopen(request, timeout=60) as response:
            archive = response.read()
        if hashlib.sha256(archive).hexdigest() != config['archiveSha256']:
            raise ValueError('SoundFont archive checksum mismatch')
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            matches = [name for name in bundle.namelist() if Path(name).name.lower() == 'cello_solo.sf2']
            if len(matches) != 1:
                raise ValueError('Expected exactly one cello SoundFont')
            data = bundle.read(matches[0])
        if not valid(data):
            raise ValueError('SoundFont checksum mismatch')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)


if __name__ == '__main__':
    main()
