#!/usr/bin/env python3
"""Render cello recordings for the static app.

Usage: python3 scripts/render-audio.py references/cello_solo.sf2
Requires FluidSynth and ffmpeg. The soundfont and outputs stay outside Git.
"""

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPEN_STRING_PITCHES = (36, 43, 50, 57)
SEMITONES_PER_STRING = 24
SAMPLE_RATE = 44100
VELOCITY = 90
DURATION_SECONDS = 2.6


def variable_length(value: int) -> bytes:
    """Encode a nonnegative MIDI delta time as a variable-length quantity."""
    if value < 0:
        raise ValueError("MIDI delta times cannot be negative")
    result = [value & 127]
    value >>= 7
    while value:
        result.insert(0, (value & 127) | 128)
        value >>= 7
    return bytes(result)


def midi_file(pitch: int, program: int) -> bytes:
    # 480 ticks/quarter at 500,000 us/quarter: 1.6-second bow + 1-second release.
    events = b"\x00\xff\x51\x03\x07\xa1\x20"
    events += bytes([0, 0xC0, program, 0, 0x90, pitch, VELOCITY])
    events += variable_length(1536) + bytes([0x80, pitch, 0])
    events += variable_length(960) + b"\xff\x2f\x00"
    header = b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480)
    track = b"MTrk" + struct.pack(">I", len(events)) + events
    return header + track


def render_note(soundfont: Path, pitch: int, program: int, temporary: Path, output: Path) -> None:
    midi = temporary / f"{pitch}.mid"
    wav = temporary / f"{pitch}.wav"
    midi.write_bytes(midi_file(pitch, program))
    # Preserve stderr so failures explain themselves instead of hiding renderer output.
    subprocess.run(
        [
            "fluidsynth", "-ni", "-r", str(SAMPLE_RATE), "-g", "0.7",
            "-o", "synth.reverb.active=0", "-o", "synth.chorus.active=0",
            "-F", str(wav), str(soundfont), str(midi),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(wav),
            "-t", str(DURATION_SECONDS), "-af", "afade=t=out:st=2.1:d=0.5",
            "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k",
            str(output / f"{pitch}.mp3"),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("soundfont", type=Path)
    parser.add_argument("--program", type=int, choices=range(128), default=0,
                        help="Zero-based SF2 preset number (0–127)")
    args = parser.parse_args()
    if not args.soundfont.is_file():
        parser.error("Soundfont file does not exist")
    for tool in ("fluidsynth", "ffmpeg"):
        if not shutil.which(tool):
            parser.error(f"{tool} is required")

    soundfont = args.soundfont.resolve()
    output = ROOT / "public" / "audio"
    output.mkdir(parents=True, exist_ok=True)
    pitches = sorted({
        base + offset
        for base in OPEN_STRING_PITCHES
        for offset in range(SEMITONES_PER_STRING + 1)
    })
    with tempfile.TemporaryDirectory(prefix="celloh-render-") as directory:
        for pitch in pitches:
            render_note(soundfont, pitch, args.program, Path(directory), output)
            print(f"Rendered {pitch}", flush=True)

    manifest = {
        "source": "Ethan Winer Cello Solo",
        "url": "https://ethanwiner.com/ewsf2.html",
        "soundfontSha256": hashlib.sha256(soundfont.read_bytes()).hexdigest(),
        "program": args.program,
        "velocity": VELOCITY,
        "pitches": pitches,
        "durationSeconds": DURATION_SECONDS,
        "sampleRate": SAMPLE_RATE,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
