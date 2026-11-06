# Version Banner Generator

![Example release banner](assets/demo-banner.png)

Make a 1500 × 500 banner from your own images. Add a title, choose colours,
arrange the pictures, and download a PNG.

**[Open the banner editor](https://sssv-modkit-dev.github.io/version-banner-generator/)**

## How to use it

1. Open the editor. Try the included artwork or choose a PNG or JPEG.
2. Pick the sprite or image area you want to use. Adjust the cut if needed.
3. Edit the text, colours and layout.
4. Download your banner, or make several at once and download a ZIP.

Your images stay on your device. Nothing is uploaded.

Simple View has the basics. Advanced View lets you adjust exact cuts, combine
several images, and change more text and layout settings. Switching views keeps
your work. You can save settings to reopen later with the original images.

The editor can suggest sprite cuts and remove some flat backgrounds. Check the
result and adjust it when needed. Animated previews download as still PNGs.

See the [help page](web/help.html) for all controls.

## Run it locally

You need Node 22+ and Python 3.12+. From the repository root:

```sh
node tools/build-web.mjs
python tools/serve-web.py
```

Open <http://127.0.0.1:8765/>.

## Windows command-line tool

There is also a separate PowerShell tool for making banners from transparent PNGs:

```powershell
powershell -NoProfile -File tools/make-banner.ps1
```

It uses the included demo image and saves `build/release-banner.png` plus a JSON
file recording the settings. Choose another output path if the files already exist.

To use your own image and text:

```powershell
powershell -NoProfile -File tools/make-banner.ps1 -Project 'MY GAME MODKIT' -Name 'Jadeish Crown Raven' -Version 'v0.2.0' -Palette green -ImagePath private/raven-head.png -Out build/raven-v0.2.png
```

Use `-Batch -Out build/concepts` to make three example banners. The available
palettes are `blue`, `orange` and `green`; they change text and accents, not your
image. Use `-QuoteStyle` to choose quotation marks. Long titles shrink to fit.
Font differences between computers can change the result.

The JSON file records the settings; the command-line tool cannot reopen it
automatically yet.

## Development

[Development guide](docs/BANNER-LAB.md) · [Adding game-specific rendering](docs/ADAPTERS.md)

The tool takes images. Automatic rendering of game models is future work.
Keep private images in `private/` or outside the repository.

To check the Windows tool:

```powershell
powershell -NoProfile -File tools/smoke-test.ps1
```

## License

Original code, documentation and demo artwork use [CC0 1.0 Universal](LICENSE).
Bundled fonts use SIL OFL 1.1 and fflate uses MIT; see
[third-party credits](web/assets/README.md).
Images you bring to the editor keep their own rights and licenses.
