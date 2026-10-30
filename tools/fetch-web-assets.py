"""One-time maintainer asset refresh. Normal builds never access the network."""
from pathlib import Path
from urllib.request import urlopen
from io import BytesIO
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1] / 'web' / 'assets'
root.mkdir(parents=True, exist_ok=True)
sources = {
    'Lato-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Regular.ttf',
    'Lato-BoldItalic.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-BoldItalic.ttf',
    'Lato-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/lato/OFL.txt',
    'NotoSansJP-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/OFL.txt',
    'fflate.mjs': 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js',
    'fflate-LICENSE.txt': 'https://raw.githubusercontent.com/101arrowz/fflate/v0.8.2/LICENSE',
}
for name, url in sources.items():
    data = urlopen(url, timeout=60).read()
    (root / name).write_bytes(data)
    print(name, len(data))
data = urlopen('https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf', timeout=60).read()
font = TTFont(BytesIO(data))
options = subset.Options()
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[0x300C, 0x300D])
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 2, 3, 4, 6, 16, 17):
        value = {1: 'Lab Quotes', 2: 'Regular', 3: 'Lab Quotes v1', 4: 'Lab Quotes', 6: 'LabQuotes', 16: 'Lab Quotes', 17: 'Regular'}[record.nameID]
        record.string = value.encode(record.getEncoding())
font.save(root / 'LabQuotes.ttf')
print('LabQuotes.ttf: subset containing Japanese corner brackets')
