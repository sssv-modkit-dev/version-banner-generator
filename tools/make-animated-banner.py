#!/usr/bin/env python3
"""Make an animated 1500 x 500 banner (GIF + lossless WebP + still PNG + settings)
from a JSON spec: theme, two-tone title, geometric border, spotlight beams and
animated subjects with optional palette cycling. See docs/ANIMATED.md."""
import argparse
import importlib.util
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import banner_fx as fx  # noqa: E402

_spec = importlib.util.spec_from_file_location('make_banner', Path(__file__).with_name('make-banner.py'))
mb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mb)


def static_page(text, theme):
    payload = json.dumps({'t': text, 'th': theme}, ensure_ascii=True).replace('<', r'<')
    return """<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1500px;height:500px;overflow:hidden}canvas{display:block}</style><canvas width="1500" height="500"></canvas><script>
const {t,th}=PAYLOAD,c=document.querySelector('canvas'),x=c.getContext('2d');
document.fonts.ready.then(()=>{x.fillStyle=th.background;x.fillRect(0,0,1500,500);
const L=t.layout==='center',cx=750,max=L?t.width:890,left=L?cx-max/2:70,ys=L?t.rows:{bar:76,project:115,title:[255],version:335,rule:382};
const put=(txt,y,font,colour)=>{x.font=font;x.fillStyle=colour;const w=x.measureText(txt).width;x.fillText(txt,L?cx-w/2:left,y)};
x.fillStyle=t.accent;x.fillRect(L?cx-16:left,ys.bar,32,3);
put(t.project,ys.project,'600 21px system-ui',t.project_colour);
t.lines.forEach((line,n)=>{let size=line.size,w;const f=(s,sz)=>`italic ${s.weight||600} ${sz}px system-ui`;
 do{w=line.segments.reduce((a,s)=>{x.font=f(s,size);return a+x.measureText(s.text).width},0);if(w<=max)break;size--}while(size>14);
 let px=L?cx-w/2:left;for(const s of line.segments){x.font=f(s,size);x.fillStyle=s.colour;x.fillText(s.text,px,ys.title[n]);px+=x.measureText(s.text).width}});
put(t.version,ys.version,'400 21px system-ui',t.subtitle_colour);
x.fillStyle=th.main[1];x.fillRect(L?cx-max/2:left,ys.rule,max,1);x.fillStyle=t.accent;x.fillRect(L?cx-32:left,ys.rule,64,2);
document.documentElement.dataset.bannerStatus='ready';}).catch(()=>document.documentElement.dataset.bannerStatus='failed');</script>""".replace('PAYLOAD', payload)


def render_static(text, theme, browser):
    with tempfile.TemporaryDirectory(prefix='animated-banner-') as tmp:
        work = Path(tmp)
        page, png = work / 'static.html', work / 'static.png'
        page.write_text(static_page(text, theme), encoding='utf-8')
        r = subprocess.run([browser, '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                            '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1500,500',
                            '--virtual-time-budget=3000', '--run-all-compositor-stages-before-draw',
                            '--user-data-dir=' + str(work / 'profile'), '--dump-dom', '--screenshot=' + str(png),
                            page.as_uri()], capture_output=True, timeout=60)
        if r.returncode or b'data-banner-status="ready"' not in r.stdout or not png.is_file():
            raise ValueError('Browser did not finish rendering the text layer.')
        im = Image.open(png).convert('RGB')
        im.load()
    if im.size != (fx.W, fx.H):
        raise ValueError('Expected a 1500 x 500 text layer.')
    return im


def title_lines(spec, theme, quotes):
    """Title lines (each a list of toned parts), wrapped in the chosen culture's
    quotation marks; the suffix (' edition') joins the last line, muted."""
    lines = spec['title']
    if isinstance(lines, str):
        lines = [{'parts': [{'text': lines}]}]
    q = mb.QUOTES[quotes]
    edge = fx.tone(theme, spec.get('quote_tone', 'text.accent'))
    out = []
    for n, line in enumerate(lines):
        segs = [{'text': p['text'], 'colour': fx.tone(theme, p.get('tone', 'text.accent')),
                 'weight': p.get('weight', 600)} for p in line['parts']]
        if n == 0:
            segs.insert(0, {'text': q[0], 'colour': edge})
        if n == len(lines) - 1:
            segs.append({'text': q[1], 'colour': edge})
            if spec.get('suffix', ' edition'):
                segs.append({'text': spec.get('suffix', ' edition'), 'colour': fx.tone(theme, 'text.muted'), 'weight': 400})
        out.append({'segments': segs, 'size': line.get('size', 60)})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('spec', type=Path, help='JSON spec (paths inside it are relative to the spec file)')
    ap.add_argument('--out', type=Path, required=True, help='Output base name; writes .gif .webp .png .json')
    ap.add_argument('--seed', type=int, help='Override the spec seed (theme, quotes, border, palette timing)')
    ap.add_argument('--theme', help='Override the spec theme (name or random)')
    ap.add_argument('--browser')
    a = ap.parse_args()
    spec = json.loads(a.spec.read_text(encoding='utf-8'))
    seed = a.seed if a.seed is not None else spec.get('seed', random.randrange(1 << 30))
    rng = random.Random(seed)
    theme_name, theme = fx.load_theme(a.theme or spec.get('theme', 'random'), rng)
    quotes = spec.get('quote_style', 'random')
    if quotes == 'random':
        quotes = rng.choice(sorted(mb.QUOTES))
    outs = [a.out.with_suffix(s) for s in ('.gif', '.webp', '.png', '.json')]
    if any(p.exists() for p in outs):
        ap.exit(1, 'Output exists; choose another --out.\n')
    base = a.spec.resolve().parent
    for s in spec['subjects']:
        s['image'] = str((base / s['image']).resolve())
    text = dict(project=spec.get('project', 'MY MODKIT'), version=spec.get('version', 'CONCEPT'),
                accent=fx.tone(theme, 'text.accent'), project_colour=fx.tone(theme, 'text.project'),
                subtitle_colour=fx.tone(theme, 'text.subtitle'),
                lines=title_lines(spec, theme, quotes), layout=spec.get('layout', 'left'),
                width=spec.get('text_width', 700), rows=spec.get('rows') or {'bar': 64, 'project': 104, 'title': [214, 282], 'version': 336, 'rule': 378})
    static = render_static(text, theme, mb.find_browser(a.browser))
    for sp in spec.get('spotlights', []):
        if 'colour' in sp:
            sp['colour'] = fx.tone(theme, sp['colour'])
    times, frames = [], []
    for t, f in fx.compose(static, theme, spec, rng):
        times.append(t)
        frames.append(f)
    step = times[1] - times[0] if len(times) > 1 else 0.04
    a.out.parent.mkdir(parents=True, exist_ok=True)
    fx.save_animation(frames, outs[0], outs[1], step)
    still = spec.get('still_time', 0)
    frames[min(range(len(times)), key=lambda i: abs(times[i] - still))].save(outs[2])
    record = dict(format='version-banner-animated-v1', seed=seed, theme=theme_name, quote_style=quotes,
                  frames=len(frames), frame_time=step, spec=spec)
    outs[3].write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Animated banner: %s (%d frames, theme %s, quotes %s, seed %d)' % (outs[0], len(frames), theme_name, quotes, seed))


if __name__ == '__main__':
    main()
