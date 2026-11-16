#!/usr/bin/env python3
"""Make a local 1500 x 500 PNG and settings JSON with Python and Chromium."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PALETTES = {'blue': '#8dc4ed', 'orange': '#efb16b', 'green': '#91cbb1'}
QUOTES = {'english': ('“', '”'), 'french': ('«\u202f', '\u202f»'),
          'spanish': ('«', '»'), 'german': ('„', '“'), 'japanese': ('「', '」')}


def find_browser(explicit=None):
    candidates = [explicit] if explicit else [shutil.which(n) for n in
        ('chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge')]
    if not explicit:
        for directory in (Path('/Applications'), Path.home() / 'Applications'):
            candidates += [str(directory / f'{app}.app/Contents/MacOS/{app}') for app in
                           ('Google Chrome', 'Chromium', 'Microsoft Edge')]
        for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
            if os.environ.get(variable):
                candidates += [str(Path(os.environ[variable]) / suffix) for suffix in
                    ('Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe')]
    for candidate in candidates:
        if candidate and Path(shutil.which(candidate) or candidate).is_file():
            return str(Path(shutil.which(candidate) or candidate).resolve())
    raise ValueError('Install Chrome, Chromium or Edge, or pass --browser PATH.')


def make_page(settings, images):
    payload = json.dumps({'settings': settings, 'images': images}, ensure_ascii=True).replace('<', r'\u003c')
    return '''<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1500px;height:500px;overflow:hidden}canvas{display:block}</style><canvas width="1500" height="500"></canvas><script>
const {settings:s,images}=PAYLOAD,c=document.querySelector('canvas'),x=c.getContext('2d');
Promise.all(images.map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src}))).then(async imgs=>{
await document.fonts.ready;x.fillStyle='#111b29';x.fillRect(0,0,1500,500);x.fillStyle=s.accent;x.fillRect(70,76,32,3);x.font='500 21px system-ui';x.fillText(s.project,70,115,890);
let size=60;do{x.font=`italic 600 ${size}px system-ui`;if(x.measureText(s.caption).width<=890)break;size--}while(size>12);
x.fillText(s.caption,70,255,890);x.fillStyle='#9ba9b9';x.font='400 21px system-ui';x.fillText(s.version,70,335,890);x.fillStyle='#26384b';x.fillRect(70,382,890,1);x.fillStyle=s.accent;x.fillRect(70,382,64,2);
const slot=440/imgs.length;imgs.forEach((i,n)=>{const scale=Math.min((slot-12)/i.width,340/i.height);x.drawImage(i,1010+n*slot+(slot-i.width*scale)/2,250-i.height*scale/2,i.width*scale,i.height*scale)});
document.documentElement.dataset.bannerStatus='ready';
}).catch(()=>document.documentElement.dataset.bannerStatus='failed');</script>'''.replace('PAYLOAD', payload)


def render(options, browser, output):
    metadata_path = output.with_suffix('.json')
    if output.exists() or metadata_path.exists():
        raise ValueError('Output exists; choose another --out: ' + str(output))
    image_paths = options.image_path or [ROOT / 'assets/demo-prism.png']
    images, hashes = [], []
    for path in image_paths:
        data = path.read_bytes()
        if data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError('Choose a PNG image: ' + str(path))
        images.append('data:image/png;base64,' + base64.b64encode(data).decode())
        hashes.append(hashlib.sha256(data).hexdigest())
    style = random.choice(tuple(QUOTES)) if options.quote_style == 'random' else options.quote_style
    q = QUOTES[style]
    settings = dict(format='version-banner-generator-v1', project=options.project,
                    name=options.name or 'Prism', version=options.version, palette=options.palette,
                    accent=PALETTES[options.palette], quoteStyle=style,
                    caption=q[0] + (options.name or 'Prism') + q[1] + ' edition', width=1500, height=500,
                    image=image_paths[0].name, imageSha256=hashes[0],
                    images=[{'image': p.name, 'sha256': h} for p, h in zip(image_paths, hashes)],
                    titleFont='system-ui', titleStyle='semibold italic')
    with tempfile.TemporaryDirectory(prefix='version-banner-') as tmp:
        work = Path(tmp);page = work / 'banner.html';png = work / 'banner.png'
        page.write_text(make_page(settings, images), encoding='utf-8')
        result = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run',
            '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1',
            '--window-size=1500,500', '--virtual-time-budget=3000',
            '--run-all-compositor-stages-before-draw', '--user-data-dir=' + str(work / 'profile'),
            '--dump-dom', '--screenshot=' + str(png), page.as_uri()], capture_output=True, timeout=60)
        if result.returncode or b'data-banner-status="ready"' not in result.stdout or not png.is_file():
            raise ValueError('Browser did not finish rendering: ' + result.stderr.decode(errors='replace')[-1000:])
        data = png.read_bytes()
        if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (1500, 500):
            raise ValueError('Expected a 1500 x 500 PNG.')
        output.parent.mkdir(parents=True, exist_ok=True)
        # Reserve both paths before writing so existing user files are protected.
        with metadata_path.open('x', encoding='utf-8') as recipe:
            with output.open('xb') as destination:
                destination.write(data)
            json.dump(settings, recipe, ensure_ascii=False, indent=2)
            recipe.write('\n')
    print('Banner saved: ' + str(output))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default='MY MODKIT')
    parser.add_argument('--name', default='')
    parser.add_argument('--image-path', type=Path, action='append', help='PNG; repeat for a teamup')
    parser.add_argument('--version', default='CONCEPT')
    parser.add_argument('--palette', choices=PALETTES, default='blue')
    parser.add_argument('--quote-style', choices=('random', *QUOTES), default='random')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--batch', action='store_true')
    parser.add_argument('--browser')
    options = parser.parse_args()
    output = options.out or ROOT / ('build/future-banners' if options.batch else 'build/release-banner.png')
    jobs = [(p, output / (p + '-banner.png')) for p in PALETTES] if options.batch else [(options.palette, output)]
    try:
        for _, path in jobs:
            if path.exists() or path.with_suffix('.json').exists():
                raise ValueError('Output exists; choose another --out: ' + str(path))
        browser = find_browser(options.browser)
        for palette, path in jobs:
            options.palette = palette
            render(options, browser, path.resolve())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        parser.exit(1, str(error) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
