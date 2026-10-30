# Render-based release banners: brief for coding agents

Build a reusable, mostly hands-off release-banner generator for my game-modding
project. Inspect my repository, its working instructions, existing viewer and
asset tools before making changes. Preserve unrelated work.

Use renders of actual game models rather than AI-generated approximations. Reuse
the project's rendering code where practical. Begin with one verified character
and a polished banner, then expand the preset library.

## Visual direction

- Minimalist wide banner, approximately 1500 x 500 pixels.
- Plain dark background, one recognizable character head or other game feature,
  and plenty of space. Keep the character clear of the text.
- Small project name, prominent release name, and a secondary version number.
- Format the complete release title in medium or semibold italic, coloured to
  match the palette: *“Release Name” edition*. No colon.
- Use matched opening and closing quotation marks. Randomly choose a convention
  per banner: English “name”, French « name », Spanish «name», German „name“,
  or Japanese 「name」. These are selected conventions, not exhaustive language rules.
- Allow the quotation style to be pinned. Hold the choice steady during preview
  edits rather than changing it every time the page redraws.
- Add only restrained finishing details, such as a fine rule and short accent line.

For animal-themed games, a possible naming system is **invented colour adjective
+ body part + animal**, for example *“Ceruleanish Ear Bear” edition*. Adapt the
names to my game's characters, locations or equipment. Keep version numbers
separate and never invent a released version.

## Hands-off workflow

1. Inspect available model parts and visually identify suitable heads or features.
   Save verified labels and flag uncertain selections. Do not infer anatomy solely
   from a joint number or filename. Some heads include the body; others require
   separate eyes, jaws, beaks or ears. Variants may use different meshes.
2. Save render presets containing asset identity, selected parts, camera angle,
   framing, lighting, colours and transparent-background settings. Record which
   presets have actually been checked.
3. Generate a finished PNG with one command, without manual uploads, repeated
   camera adjustment or copying icons between applications.
4. Support batches of future release concepts, clearly labelled as concepts.
5. Recolour the character and/or named feature to match the palette, preserving
   shading and recognizable eyes, teeth and other details. Prefer material,
   vertex-colour or geometric selections. Cached transparent renders can bootstrap
   the workflow; asset-specific image masks are an explicitly limited fallback,
   not a general anatomy detector. Never apply one game's masks to another game.
6. Preserve original assets and refuse silent overwrites. Record resolved random
   choices, input identity and render settings so a banner can be reproduced.
7. Keep the implementation lightweight. Reuse the project's supported languages
   and avoid unnecessary dependencies or external services.

Target workflow:

**Choose release settings -> render a verified preset -> compose the banner ->
export PNG plus its resolved settings.**

## Architecture for a reusable repository

Separate the generic compositor from each game's adapter:

- **Core compositor:** layout, typography, palette, matched quotes, image placement,
  PNG export and reproducibility metadata. It accepts a transparent raster image
  and ordinary release settings; it should not know ROM offsets or game anatomy.
- **Game adapter:** obtains the local model/render, selects verified geometry,
  applies game-specific recolours and supplies the transparent image to the core.
- **Presets and batches:** declarative release recipes and render settings, with
  asset-specific details retained privately where appropriate.

Use one composition implementation for preview and automated export where
practical. Allow an adapter to use cached renders, but describe that honestly;
it is not equivalent to automatically rendering arbitrary game models.
The standalone repository should not require the original modkit or bundle its
game-derived inputs. Include a synthetic or independently authored example.

## Verification and delivery

- Inspect exported banners at README display size. Check title fit, italic weight,
  quote glyphs, transparency, cropping and contrast.
- Exercise representative quote and recolour options, including preservation of
  protected details. Report unsupported features instead of silently ignoring them.
- Test a viewer through a local web server bound to `127.0.0.1`, using an allowed
  browser origin. Check documented test setup before choosing how to open it.
  Respect browser access denials; do not route around them.
- Distinguish offline mesh identification, live WebGL testing and in-game testing.
  Do not claim one proves the others.
- Keep ROMs, extracted models, textures, private indexes and research files private.
  Review any specifically selected raster artwork separately before publication.
  Do not imply that game imagery inherits the generator's software licence.
- Deliver the command, available presets, limitations, README-ready PNG and embed
  snippet. Publish only when authorized by the project owner.

## What inspired this brief

This approach grew from an SSSV modkit prototype: a cached game-head render,
minimal composition, palette-matched recolouring and batch generation. Its working
generator uses Windows PowerShell/System.Drawing and bear-specific raster masks.
A separate offline review identified more head meshes, but that did not establish
a finished renderer or verified camera presets for every animal.

Treat the generalized architecture above as an implementation brief, not a claim
that every integration already exists. Inspect the target game and build on its
actual capabilities.

## Suggested post text

We turned an actual in-game head render into a hands-off release-banner generator,
with palette-matched recolours, playful edition names and quotation styles from
different languages. I've attached a Markdown brief you can feed to your coding
bot to adapt the idea to your own modding project and asset tools.
