#!/usr/bin/env python3
"""Exercise real Chromium output, quote styles, recipes, batch and overwrite protection."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / 'tools/make-banner.py'


def main():
    with tempfile.TemporaryDirectory(prefix='banner-smoke-') as tmp:
        directory = Path(tmp)
        image_hash = hashlib.sha256((ROOT / 'assets/demo-prism.png').read_bytes()).hexdigest()
        for style in ('english', 'french', 'spanish', 'german', 'japanese'):
            output = directory / (style + '.png')
            subprocess.run([sys.executable, str(CLI), '--quote-style', style, '--out', str(output)], check=True)
            recipe = json.loads(output.with_suffix('.json').read_text(encoding='utf-8'))
            assert recipe['quoteStyle'] == style and recipe['imageSha256'] == image_hash
            assert struct.unpack('>II', output.read_bytes()[16:24]) == (1500, 500)
        subprocess.run([sys.executable, str(CLI), '--batch', '--out', str(directory / 'batch')], check=True)
        assert len(list((directory / 'batch').glob('*.png'))) == 3
        existing = directory / 'english.png'; before = existing.read_bytes()
        result = subprocess.run([sys.executable, str(CLI), '--out', str(existing)], capture_output=True)
        assert result.returncode and existing.read_bytes() == before
        # A settings sidecar also protects its matching output, before browser launch.
        sidecar = directory / 'reserved.json'; sidecar.write_text('{}')
        result = subprocess.run([sys.executable, str(CLI), '--out', str(sidecar.with_suffix('.png'))], capture_output=True)
        assert result.returncode and not sidecar.with_suffix('.png').exists()
        assert sidecar.read_text() == '{}'
    print('PASS: five quote styles, dimensions, recipes, batch and overwrite protection.')


if __name__ == '__main__':
    main()
